import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  extendInstagramToken,
  createReelContainer,
  createImageContainer,
  getContainerStatus,
  publishContainer,
  getMediaPermalink,
} from "@/lib/social/instagram";
import {
  refreshTikTokToken,
  queryCreatorInfo,
  initTikTokVideoPost,
  initTikTokPhotoPost,
  uploadTikTokVideoFromUrl,
  fetchPublishStatus,
} from "@/lib/social/tiktok";
import {
  refreshXToken,
  uploadXMediaFromUrl,
  fetchXMediaStatus,
  createTweet,
} from "@/lib/social/x";
import {
  refreshLinkedInToken,
  initializeLinkedInVideoUpload,
  uploadLinkedInVideoFromUrl,
  finalizeLinkedInVideoUpload,
  initializeLinkedInImageUpload,
  uploadLinkedInImageFromUrl,
  getLinkedInVideoStatus,
  createLinkedInMediaPost,
  linkedinPostPermalink,
} from "@/lib/social/linkedin";
import {
  refreshThreadsToken,
  createThreadsVideoContainer,
  createThreadsImageContainer,
  getThreadsContainerStatus,
  publishThreadsContainer,
  getThreadsPermalink,
} from "@/lib/social/threads";
import { publishFacebookVideo, publishFacebookPhoto } from "@/lib/social/facebook";
import { releaseStorageIfUnused, signedMediaProxyUrl } from "@/lib/publish-storage";

// Subir chunks (TikTok/X/LinkedIn) + polling puede tardar: pedir el máximo del plan Pro
export const maxDuration = 300;

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Redes que publica este cron (YouTube publica solo con publishAt nativo)
const CRON_PLATFORMS = ["instagram", "facebook", "tiktok", "x", "linkedin", "threads"];

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
  media_type: string | null;
  group_id: string | null;
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

// El evento de calendario es del grupo entero: solo se borra si ya no queda
// ninguna publicación viva (no fallida) que lo comparta.
async function releaseCalendarEvent(post: PostRow) {
  if (!post.calendar_event_id) return;
  const { data: siblings } = await supabaseAdmin
    .from("scheduled_posts")
    .select("id")
    .eq("calendar_event_id", post.calendar_event_id)
    .neq("id", post.id)
    .neq("status", "failed")
    .limit(1);
  if (!siblings?.length) {
    await supabaseAdmin.from("calendar_events").delete().eq("id", post.calendar_event_id);
  }
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
  await releaseStorageIfUnused(supabaseAdmin, post.storage_path, { excludePostId: post.id });
}

// El estado "publishing" persiste entre ejecuciones del cron: si la red sigue
// procesando el vídeo al agotar el polling, el siguiente run lo retoma por
// platform_post_id en vez de re-subir.
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
    await releaseCalendarEvent(post);
    await releaseStorageIfUnused(supabaseAdmin, post.storage_path, { excludePostId: post.id });
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

async function saveTokens(
  connId: string,
  tokens: { accessToken: string; refreshToken?: string | null; expiresAt: Date }
) {
  await supabaseAdmin
    .from("social_connections")
    .update({
      access_token: tokens.accessToken,
      ...(tokens.refreshToken !== undefined ? { refresh_token: tokens.refreshToken } : {}),
      expires_at: tokens.expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", connId);
}

async function publishInstagram(post: PostRow): Promise<void> {
  const conn = await getConnection(post.user_id, "instagram");
  if (!conn) throw new Error("Instagram desconectado: reconecta tu cuenta.");

  // El token largo de Meta dura ~60 días; renovarlo cuando queden menos de 7
  let token = conn.access_token;
  if (conn.expires_at && new Date(conn.expires_at).getTime() < Date.now() + 7 * 86_400_000) {
    const renewed = await extendInstagramToken(token);
    token = renewed.accessToken;
    await saveTokens(conn.id, renewed);
  }

  let containerId = post.platform_post_id;
  if (!containerId) {
    if (!post.storage_path) throw new Error("El contenido ya no está disponible.");
    const mediaUrl = await signedVideoUrl(post.storage_path);
    containerId =
      post.media_type === "image"
        ? await createImageContainer({
            igId: conn.account_id,
            accessToken: token,
            imageUrl: mediaUrl,
            caption: post.title,
          })
        : await createReelContainer({
            igId: conn.account_id,
            accessToken: token,
            videoUrl: mediaUrl,
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
      throw new Error(
        post.media_type === "image"
          ? `Instagram no pudo procesar la foto (${status}). Debe ser JPEG de hasta 8 MB.`
          : `Instagram no pudo procesar el vídeo (${status}). Comprueba formato (MP4/MOV, 9:16, ≤15 min).`
      );
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
  await saveTokens(conn.id, tokens);

  let publishId = post.platform_post_id;
  if (!publishId) {
    if (!post.storage_path) throw new Error("El contenido ya no está disponible.");

    const creator = await queryCreatorInfo(tokens.accessToken);
    const requested = String(post.settings.privacy_level ?? "PUBLIC_TO_EVERYONE");
    // Apps sin audit de TikTok solo pueden publicar en SELF_ONLY
    const privacyLevel = creator.privacyOptions.includes(requested)
      ? requested
      : creator.privacyOptions[0] ?? "SELF_ONLY";

    if (post.media_type === "image") {
      // Fotos solo por PULL_FROM_URL, y desde nuestro dominio (verificado en TikTok)
      const init = await initTikTokPhotoPost({
        accessToken: tokens.accessToken,
        title: post.title,
        privacyLevel,
        photoUrls: [signedMediaProxyUrl(post.storage_path)],
      });
      publishId = init.publishId;
    } else {
      if (!post.file_size) throw new Error("El vídeo ya no está disponible.");
      const videoUrl = await signedVideoUrl(post.storage_path);
      const init = await initTikTokVideoPost({
        accessToken: tokens.accessToken,
        title: post.title,
        privacyLevel,
        videoSize: post.file_size,
      });
      await uploadTikTokVideoFromUrl(init.uploadUrl, videoUrl, post.file_size);
      publishId = init.publishId;
    }
    await keepPublishing(post, publishId);
  }

  for (let i = 0; i < POLL_TRIES; i++) {
    const status = await fetchPublishStatus(tokens.accessToken, publishId);
    if (status.state === "complete") {
      const username = conn.account_name?.replace(/^@/, "");
      const permalink =
        status.videoId && username ? `https://www.tiktok.com/@${username}/video/${status.videoId}` : null;
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

async function publishX(post: PostRow): Promise<void> {
  const conn = await getConnection(post.user_id, "x");
  if (!conn?.refresh_token) throw new Error("X desconectado: reconecta tu cuenta.");

  // El access token de X caduca en 2h y el refresh token rota: guardar el par nuevo
  const tokens = await refreshXToken(conn.refresh_token);
  await saveTokens(conn.id, tokens);

  let mediaId = post.platform_post_id;
  if (!mediaId) {
    if (!post.storage_path || !post.file_size) throw new Error("El contenido ya no está disponible.");
    const mediaUrl = await signedVideoUrl(post.storage_path);
    mediaId =
      post.media_type === "image"
        ? await uploadXMediaFromUrl(tokens.accessToken, mediaUrl, post.file_size, "image/jpeg", "tweet_image")
        : await uploadXMediaFromUrl(tokens.accessToken, mediaUrl, post.file_size);
    await keepPublishing(post, mediaId);
  }

  for (let i = 0; i < POLL_TRIES; i++) {
    const status = await fetchXMediaStatus(tokens.accessToken, mediaId);
    if (status.state === "succeeded") {
      const tweetId = await createTweet(tokens.accessToken, post.title, mediaId);
      const permalink = conn.account_name ? `https://x.com/${conn.account_name}/status/${tweetId}` : null;
      await markPublished(post, tweetId, permalink);
      return;
    }
    if (status.state === "failed") {
      throw new Error(`X no pudo procesar el vídeo: ${status.reason}`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  await keepPublishing(post, mediaId);
}

async function publishLinkedIn(post: PostRow): Promise<void> {
  const conn = await getConnection(post.user_id, "linkedin");
  if (!conn) throw new Error("LinkedIn desconectado: reconecta tu cuenta.");

  let token = conn.access_token;
  const expiresSoon =
    conn.expires_at && new Date(conn.expires_at).getTime() < Date.now() + 7 * 86_400_000;
  if (expiresSoon) {
    // Solo las apps aprobadas por LinkedIn reciben refresh token; sin él, si el
    // token de 60 días ya murió no hay nada que hacer salvo pedir reconexión.
    if (conn.refresh_token) {
      const renewed = await refreshLinkedInToken(conn.refresh_token);
      token = renewed.accessToken;
      await saveTokens(conn.id, renewed);
    } else if (new Date(conn.expires_at!).getTime() < Date.now()) {
      throw new Error("La conexión con LinkedIn ha caducado: reconecta tu cuenta.");
    }
  }

  if (post.media_type === "image") {
    // Las imágenes se procesan al instante: un PUT y el post directamente,
    // sin polling. Si falla, markFailedOrRetry re-sube en el siguiente run.
    let imageUrn = post.platform_post_id;
    if (!imageUrn) {
      if (!post.storage_path) throw new Error("La foto ya no está disponible.");
      const imageUrl = await signedVideoUrl(post.storage_path);
      const init = await initializeLinkedInImageUpload(token, conn.account_id);
      await uploadLinkedInImageFromUrl(token, init.uploadUrl, imageUrl);
      imageUrn = init.imageUrn;
      await keepPublishing(post, imageUrn);
    }
    const postUrn = await createLinkedInMediaPost({
      accessToken: token,
      personId: conn.account_id,
      text: post.title,
      mediaUrn: imageUrn,
    });
    await markPublished(post, postUrn, linkedinPostPermalink(postUrn));
    return;
  }

  let videoUrn = post.platform_post_id;
  if (!videoUrn) {
    if (!post.storage_path || !post.file_size) throw new Error("El vídeo ya no está disponible.");
    const videoUrl = await signedVideoUrl(post.storage_path);
    const init = await initializeLinkedInVideoUpload(token, conn.account_id, post.file_size);
    const etags = await uploadLinkedInVideoFromUrl(token, init.instructions, videoUrl);
    await finalizeLinkedInVideoUpload(token, init.videoUrn, etags);
    videoUrn = init.videoUrn;
    await keepPublishing(post, videoUrn);
  }

  let unreadable = false;
  for (let i = 0; i < POLL_TRIES; i++) {
    const { status, failureReason } = await getLinkedInVideoStatus(token, videoUrn);
    if (status === "AVAILABLE") {
      const postUrn = await createLinkedInMediaPost({
        accessToken: token,
        personId: conn.account_id,
        text: post.title,
        mediaUrn: videoUrn,
        mediaTitle: post.title,
      });
      await markPublished(post, postUrn, linkedinPostPermalink(postUrn));
      return;
    }
    if (status === "PROCESSING_FAILED") {
      throw new Error(`LinkedIn no pudo procesar el vídeo${failureReason ? `: ${failureReason}` : "."}`);
    }
    if (status === "UNKNOWN") {
      unreadable = true;
      break;
    }
    await sleep(POLL_INTERVAL_MS);
  }

  if (unreadable) {
    // Token de miembro sin lectura de rest/videos: intentar publicar a ciegas.
    // Si LinkedIn aún procesa el vídeo lo rechaza y el siguiente run reintenta.
    try {
      const postUrn = await createLinkedInMediaPost({
        accessToken: token,
        personId: conn.account_id,
        text: post.title,
        mediaUrn: videoUrn,
        mediaTitle: post.title,
      });
      await markPublished(post, postUrn, linkedinPostPermalink(postUrn));
      return;
    } catch {
      await keepPublishing(post, videoUrn);
      return;
    }
  }
  await keepPublishing(post, videoUrn);
}

async function publishThreads(post: PostRow): Promise<void> {
  const conn = await getConnection(post.user_id, "threads");
  if (!conn) throw new Error("Threads desconectado: reconecta tu cuenta.");

  // Token largo de ~60 días: renovarlo cuando queden menos de 7
  let token = conn.access_token;
  if (conn.expires_at && new Date(conn.expires_at).getTime() < Date.now() + 7 * 86_400_000) {
    const renewed = await refreshThreadsToken(token);
    token = renewed.accessToken;
    await saveTokens(conn.id, renewed);
  }

  let containerId = post.platform_post_id;
  if (!containerId) {
    if (!post.storage_path) throw new Error("El contenido ya no está disponible.");
    const mediaUrl = await signedVideoUrl(post.storage_path);
    containerId =
      post.media_type === "image"
        ? await createThreadsImageContainer({
            userId: conn.account_id,
            accessToken: token,
            imageUrl: mediaUrl,
            text: post.title,
          })
        : await createThreadsVideoContainer({
            userId: conn.account_id,
            accessToken: token,
            videoUrl: mediaUrl,
            text: post.title,
          });
    await keepPublishing(post, containerId);
  }

  for (let i = 0; i < POLL_TRIES; i++) {
    const { status, errorMessage } = await getThreadsContainerStatus(containerId, token);
    if (status === "FINISHED") {
      const threadId = await publishThreadsContainer({
        userId: conn.account_id,
        containerId,
        accessToken: token,
      });
      const permalink = await getThreadsPermalink(threadId, token);
      await markPublished(post, threadId, permalink);
      return;
    }
    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(
        `Threads no pudo procesar ${post.media_type === "image" ? "la foto" : "el vídeo"}${errorMessage ? `: ${errorMessage}` : ` (${status}).`}`
      );
    }
    await sleep(POLL_INTERVAL_MS);
  }
  await keepPublishing(post, containerId);
}

async function publishFacebook(post: PostRow): Promise<void> {
  const conn = await getConnection(post.user_id, "facebook");
  if (!conn) throw new Error("Facebook desconectado: reconecta tu página.");
  if (!post.storage_path) throw new Error("El contenido ya no está disponible.");

  // El token de página no caduca y la publicación es una sola llamada
  // (Facebook descarga el archivo de la URL firmada) — sin fases ni polling.
  const mediaUrl = await signedVideoUrl(post.storage_path);
  if (post.media_type === "image") {
    const { photoId, permalink } = await publishFacebookPhoto({
      pageId: conn.account_id,
      pageAccessToken: conn.access_token,
      imageUrl: mediaUrl,
      caption: post.title,
    });
    await markPublished(post, photoId, permalink);
    return;
  }
  const { videoId, permalink } = await publishFacebookVideo({
    pageId: conn.account_id,
    pageAccessToken: conn.access_token,
    videoUrl: mediaUrl,
    description: post.title,
  });
  await markPublished(post, videoId, permalink);
}

const PUBLISHERS: Record<string, (post: PostRow) => Promise<void>> = {
  instagram: publishInstagram,
  facebook: publishFacebook,
  tiktok: publishTikTok,
  x: publishX,
  linkedin: publishLinkedIn,
  threads: publishThreads,
};

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
    .in("platform", CRON_PLATFORMS)
    .eq("status", "publishing")
    .lte("updated_at", new Date(Date.now() - STALE_PUBLISHING_MS).toISOString());

  const { data: due, error } = await supabaseAdmin
    .from("scheduled_posts")
    .select("*")
    .in("platform", CRON_PLATFORMS)
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
      const publisher = PUBLISHERS[post.platform];
      if (!publisher) throw new Error(`Plataforma desconocida: ${post.platform}`);
      await publisher(post);

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
