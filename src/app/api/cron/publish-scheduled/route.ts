import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  extendInstagramToken,
  createReelContainer,
  getContainerStatus,
  publishContainer,
  getMediaPermalink,
} from "@/lib/social/instagram";
import {
  refreshTikTokToken,
  queryCreatorInfo,
  initTikTokVideoPost,
  uploadTikTokVideoFromUrl,
  fetchPublishStatus,
} from "@/lib/social/tiktok";

// Subir chunks a TikTok + polling puede tardar: pedir el máximo del plan Pro
export const maxDuration = 300;

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 5;
const POLL_TRIES = 5;
const POLL_INTERVAL_MS = 5_000;
const STALE_PUBLISHING_MS = 24 * 3_600_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type PostRow = {
  id: string;
  user_id: string;
  platform: string;
  title: string;
  status: string;
  scheduled_at: string | null;
  platform_post_id: string | null;
  storage_path: string | null;
  file_size: number | null;
  attempts: number;
  settings: Record<string, unknown>;
  calendar_event_id: string | null;
  updated_at: string;
};

type ConnRow = {
  id: string;
  user_id: string;
  platform: string;
  account_id: string;
  account_name: string | null;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
};

async function signedVideoUrl(path: string): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from("publish-videos")
    .createSignedUrl(path, 7_200);
  if (error || !data?.signedUrl) throw new Error("No se pudo firmar la URL del vídeo.");
  return data.signedUrl;
}

async function markPublished(post: PostRow, platformPostId: string | null, permalink: string | null) {
  await supabaseAdmin
    .from("scheduled_posts")
    .update({
      status: "published",
      platform_post_id: platformPostId,
      settings: { ...post.settings, ...(permalink ? { permalink } : {}) },
      error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", post.id);
  if (post.storage_path) {
    await supabaseAdmin.storage.from("publish-videos").remove([post.storage_path]).catch(() => {});
  }
}

// El estado "publishing" persiste entre ejecuciones del cron: si el contenedor de
// IG o el publish de TikTok siguen procesándose al agotar el polling, el siguiente
// run lo retoma por platform_post_id en vez de re-subir.
async function keepPublishing(post: PostRow, platformPostId: string) {
  await supabaseAdmin
    .from("scheduled_posts")
    .update({ status: "publishing", platform_post_id: platformPostId, updated_at: new Date().toISOString() })
    .eq("id", post.id);
}

async function markFailedOrRetry(post: PostRow, message: string) {
  const attempts = post.attempts + 1;
  if (attempts >= MAX_ATTEMPTS) {
    await supabaseAdmin
      .from("scheduled_posts")
      .update({ status: "failed", error: message.slice(0, 500), attempts, updated_at: new Date().toISOString() })
      .eq("id", post.id);
    if (post.calendar_event_id) {
      await supabaseAdmin.from("calendar_events").delete().eq("id", post.calendar_event_id);
    }
    if (post.storage_path) {
      await supabaseAdmin.storage.from("publish-videos").remove([post.storage_path]).catch(() => {});
    }
  } else {
    // Reintento desde cero en el siguiente run (contenedor/publish_id nuevos)
    await supabaseAdmin
      .from("scheduled_posts")
      .update({
        status: "scheduled",
        platform_post_id: null,
        error: message.slice(0, 500),
        attempts,
        updated_at: new Date().toISOString(),
      })
      .eq("id", post.id);
  }
}

async function getConnection(userId: string, platform: string): Promise<ConnRow | null> {
  const { data } = await supabaseAdmin
    .from("social_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("platform", platform)
    .single();
  return data as ConnRow | null;
}

async function publishInstagram(post: PostRow): Promise<void> {
  const conn = await getConnection(post.user_id, "instagram");
  if (!conn) throw new Error("Instagram desconectado: reconecta tu cuenta.");

  // El token largo de Meta dura ~60 días; renovarlo cuando queden menos de 7
  let token = conn.access_token;
  if (conn.expires_at && new Date(conn.expires_at).getTime() < Date.now() + 7 * 86_400_000) {
    const renewed = await extendInstagramToken(token);
    token = renewed.accessToken;
    await supabaseAdmin
      .from("social_connections")
      .update({ access_token: token, expires_at: renewed.expiresAt.toISOString(), updated_at: new Date().toISOString() })
      .eq("id", conn.id);
  }

  let containerId = post.platform_post_id;
  if (!containerId) {
    if (!post.storage_path) throw new Error("El vídeo ya no está disponible.");
    const videoUrl = await signedVideoUrl(post.storage_path);
    containerId = await createReelContainer({
      igId: conn.account_id,
      accessToken: token,
      videoUrl,
      caption: post.title,
    });
    await keepPublishing(post, containerId);
  }

  for (let i = 0; i < POLL_TRIES; i++) {
    const status = await getContainerStatus(containerId, token);
    if (status === "FINISHED") {
      const mediaId = await publishContainer({ igId: conn.account_id, containerId, accessToken: token });
      const permalink = await getMediaPermalink(mediaId, token);
      await markPublished(post, mediaId, permalink);
      return;
    }
    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(`Instagram no pudo procesar el vídeo (${status}). Comprueba formato (MP4/MOV, 9:16, ≤15 min).`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  // Sigue procesándose: el siguiente run del cron lo retoma
  await keepPublishing(post, containerId);
}

async function publishTikTok(post: PostRow): Promise<void> {
  const conn = await getConnection(post.user_id, "tiktok");
  if (!conn?.refresh_token) throw new Error("TikTok desconectado: reconecta tu cuenta.");

  // El access token de TikTok caduca en 24h: refrescar siempre
  const tokens = await refreshTikTokToken(conn.refresh_token);
  await supabaseAdmin
    .from("social_connections")
    .update({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: tokens.expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", conn.id);

  let publishId = post.platform_post_id;
  if (!publishId) {
    if (!post.storage_path || !post.file_size) throw new Error("El vídeo ya no está disponible.");

    const creator = await queryCreatorInfo(tokens.accessToken);
    const requested = String(post.settings.privacy_level ?? "PUBLIC_TO_EVERYONE");
    // Apps sin audit de TikTok solo pueden publicar en SELF_ONLY
    const privacyLevel = creator.privacyOptions.includes(requested)
      ? requested
      : creator.privacyOptions[0] ?? "SELF_ONLY";

    const videoUrl = await signedVideoUrl(post.storage_path);
    const init = await initTikTokVideoPost({
      accessToken: tokens.accessToken,
      title: post.title,
      privacyLevel,
      videoSize: post.file_size,
    });
    await uploadTikTokVideoFromUrl(init.uploadUrl, videoUrl, post.file_size);
    publishId = init.publishId;
    await keepPublishing(post, publishId);
  }

  for (let i = 0; i < POLL_TRIES; i++) {
    const status = await fetchPublishStatus(tokens.accessToken, publishId);
    if (status.state === "complete") {
      const conn2 = conn.account_name?.replace(/^@/, "");
      const permalink =
        status.videoId && conn2 ? `https://www.tiktok.com/@${conn2}/video/${status.videoId}` : null;
      await markPublished(post, status.videoId ?? publishId, permalink);
      return;
    }
    if (status.state === "failed") {
      throw new Error(`TikTok rechazó la publicación: ${status.reason}`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  await keepPublishing(post, publishId);
}

export async function GET(request: NextRequest) {
  // Fail closed: sin CRON_SECRET configurado el endpoint queda cerrado
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowIso = new Date().toISOString();

  // Publicaciones atascadas en "publishing" desde hace >24h: darlas por perdidas
  await supabaseAdmin
    .from("scheduled_posts")
    .update({ status: "failed", error: "La plataforma no confirmó la publicación en 24h.", updated_at: nowIso })
    .in("platform", ["instagram", "tiktok"])
    .eq("status", "publishing")
    .lte("updated_at", new Date(Date.now() - STALE_PUBLISHING_MS).toISOString());

  const { data: due, error } = await supabaseAdmin
    .from("scheduled_posts")
    .select("*")
    .in("platform", ["instagram", "tiktok"])
    .or(`and(status.eq.scheduled,or(scheduled_at.is.null,scheduled_at.lte.${nowIso})),status.eq.publishing`)
    .order("scheduled_at", { ascending: true, nullsFirst: true })
    .limit(BATCH_SIZE);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!due?.length) return NextResponse.json({ processed: 0 });

  let published = 0;
  let pending = 0;
  let failed = 0;

  for (const post of due as PostRow[]) {
    try {
      if (post.platform === "instagram") await publishInstagram(post);
      else await publishTikTok(post);

      const { data: fresh } = await supabaseAdmin
        .from("scheduled_posts")
        .select("status")
        .eq("id", post.id)
        .single();
      if (fresh?.status === "published") published++;
      else pending++;
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : "Error desconocido";
      console.error(`publish-scheduled: post ${post.id} (${post.platform}) failed:`, msg);
      await markFailedOrRetry(post, msg);
    }
  }

  return NextResponse.json({ processed: due.length, published, pending, failed });
}
