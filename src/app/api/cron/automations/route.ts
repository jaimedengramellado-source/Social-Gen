import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { refreshAccessToken } from "@/lib/youtube-analytics";
import { sendEmail, emailLayout, escapeHtml } from "@/lib/email";
import { extendInstagramToken, getInstagramMediaViews } from "@/lib/social/instagram";
import { getFacebookVideoViews } from "@/lib/social/facebook";
import { refreshTikTokToken, getTikTokVideoViews } from "@/lib/social/tiktok";
import { refreshXToken, getTweetViews } from "@/lib/social/x";
import { refreshThreadsToken, getThreadsViews } from "@/lib/social/threads";
import { releaseStorageIfUnused } from "@/lib/publish-storage";

export const maxDuration = 300;

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Solo vídeos recientes: los hitos de vídeos antiguos ya no son noticia
const VIDEO_WINDOW_DAYS = 30;
const RULES_BATCH = 50;

const PLATFORM_NAMES: Record<string, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  x: "X",
  linkedin: "LinkedIn",
  threads: "Threads",
};

function formatViews(n: number): string {
  return n.toLocaleString("es-ES");
}

type VideoStat = { id: string; title: string; views: number };

async function fetchRecentVideos(token: string): Promise<VideoStat[]> {
  const chRes = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const chData = await chRes.json();
  const uploadsPlaylist = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylist) return [];

  const plRes = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylist}&maxResults=25`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const plData = await plRes.json();
  const cutoff = Date.now() - VIDEO_WINDOW_DAYS * 86_400_000;
  const ids = (plData.items ?? [])
    .filter((i: { contentDetails?: { videoPublishedAt?: string } }) => {
      const ts = i.contentDetails?.videoPublishedAt;
      return ts && new Date(ts).getTime() >= cutoff;
    })
    .map((i: { contentDetails: { videoId: string } }) => i.contentDetails.videoId);
  if (ids.length === 0) return [];

  const vidRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${ids.join(",")}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const vidData = await vidRes.json();
  return (vidData.items ?? []).map(
    (v: { id: string; snippet?: { title?: string }; statistics?: { viewCount?: string } }) => ({
      id: v.id,
      title: v.snippet?.title ?? "(sin título)",
      views: Number(v.statistics?.viewCount ?? 0),
    })
  );
}

// ── Alertas de hitos de visitas (emails) — tras el flag ENABLE_AUTOMATIONS ──

async function runMilestoneAlerts(): Promise<number> {
  const { data: automations, error } = await supabaseAdmin
    .from("post_automations")
    .select("*")
    .eq("active", true)
    .eq("platform", "youtube")
    .eq("trigger", "views_milestone");

  if (error || !automations?.length) return 0;

  const userIds = [...new Set(automations.map((a) => a.user_id as string))];

  const [{ data: connections }, { data: profiles }, { data: firedEvents }] = await Promise.all([
    supabaseAdmin.from("youtube_connections").select("*").in("user_id", userIds),
    supabaseAdmin.from("profiles").select("id, email, full_name").in("id", userIds),
    supabaseAdmin
      .from("automation_events")
      .select("automation_id, video_id")
      .in("automation_id", automations.map((a) => a.id as string)),
  ]);

  const connByUser = new Map((connections ?? []).map((c) => [c.user_id as string, c]));
  const profileById = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  const alreadyFired = new Set((firedEvents ?? []).map((e) => `${e.automation_id}:${e.video_id}`));

  let fired = 0;

  for (const userId of userIds) {
    const conn = connByUser.get(userId);
    const profile = profileById.get(userId);
    if (!conn || !profile?.email) continue;

    let videos: VideoStat[];
    try {
      const token = await refreshAccessToken(conn, supabaseAdmin as never);
      videos = await fetchRecentVideos(token);
    } catch (err) {
      console.error(`automations: user ${userId} YouTube fetch failed:`, err);
      continue;
    }
    if (videos.length === 0) continue;

    const userAutomations = automations.filter((a) => a.user_id === userId);
    for (const automation of userAutomations) {
      for (const video of videos) {
        if (video.views < (automation.threshold as number)) continue;
        if (alreadyFired.has(`${automation.id}:${video.id}`)) continue;

        // Registrar ANTES de enviar: mejor perder un email que duplicarlo si
        // el envío tarda y el cron se solapa
        const { error: insertError } = await supabaseAdmin
          .from("automation_events")
          .insert({ automation_id: automation.id, video_id: video.id });
        if (insertError) continue;

        await sendEmail(
          profile.email as string,
          `🎉 Tu vídeo ha superado las ${formatViews(automation.threshold as number)} visitas`,
          emailLayout({
            emoji: "🎉",
            heading: "¡Hito alcanzado!",
            bodyHtml: `
              <p style="margin:0 0 8px"><strong>«${escapeHtml(video.title)}»</strong> acaba de superar las
              <strong>${formatViews(automation.threshold as number)}</strong> visitas en YouTube
              (lleva ${formatViews(video.views)}).</p>
              <p style="margin:0">Buen momento para aprovechar el impulso: responde comentarios o crea contenido relacionado.</p>
            `,
            ctaHref: `https://www.youtube.com/watch?v=${video.id}`,
            ctaLabel: "Ver el vídeo →",
            footerNote: "Configura tus alertas de hitos en Social Flamingo → Publicar.",
          })
        );
        fired++;
      }
    }
  }

  return fired;
}

// ── Reglas condicionales de publicación cruzada — siempre activas ──

type RuleRow = {
  id: string;
  user_id: string;
  rule_group_id: string;
  source_post_id: string;
  source_platform: string;
  target_platform: string;
  threshold: number;
  window_days: number;
  text: string;
  settings: Record<string, unknown>;
  storage_path: string;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
};

type SourcePost = {
  id: string;
  status: string;
  youtube_video_id: string | null;
  platform_post_id: string | null;
  group_id: string | null;
  title: string;
};

async function updateRule(id: string, patch: Record<string, unknown>) {
  await supabaseAdmin
    .from("crosspost_rules")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
}

// Devuelve el access token vigente de una red, refrescando y persistiendo si
// hace falta. Cacheado por usuario+red dentro del run.
async function getFreshToken(
  cache: Map<string, string | null>,
  userId: string,
  platform: string
): Promise<string | null> {
  const key = `${userId}:${platform}`;
  if (cache.has(key)) return cache.get(key)!;

  let token: string | null = null;
  try {
    if (platform === "youtube") {
      const { data: conn } = await supabaseAdmin
        .from("youtube_connections")
        .select("*")
        .eq("user_id", userId)
        .single();
      if (conn) token = await refreshAccessToken(conn, supabaseAdmin as never);
    } else {
      const { data: conn } = await supabaseAdmin
        .from("social_connections")
        .select("*")
        .eq("user_id", userId)
        .eq("platform", platform)
        .single();
      if (conn) {
        const expiringSoon =
          conn.expires_at && new Date(conn.expires_at).getTime() < Date.now() + 7 * 86_400_000;
        if (platform === "tiktok" && conn.refresh_token) {
          const t = await refreshTikTokToken(conn.refresh_token);
          await supabaseAdmin
            .from("social_connections")
            .update({ access_token: t.accessToken, refresh_token: t.refreshToken, expires_at: t.expiresAt.toISOString(), updated_at: new Date().toISOString() })
            .eq("id", conn.id);
          token = t.accessToken;
        } else if (platform === "x" && conn.refresh_token) {
          // El refresh token de X rota: persistir el par nuevo o la conexión muere
          const t = await refreshXToken(conn.refresh_token);
          await supabaseAdmin
            .from("social_connections")
            .update({ access_token: t.accessToken, refresh_token: t.refreshToken, expires_at: t.expiresAt.toISOString(), updated_at: new Date().toISOString() })
            .eq("id", conn.id);
          token = t.accessToken;
        } else if (platform === "instagram" && expiringSoon) {
          const t = await extendInstagramToken(conn.access_token);
          await supabaseAdmin
            .from("social_connections")
            .update({ access_token: t.accessToken, expires_at: t.expiresAt.toISOString(), updated_at: new Date().toISOString() })
            .eq("id", conn.id);
          token = t.accessToken;
        } else if (platform === "threads" && expiringSoon) {
          const t = await refreshThreadsToken(conn.access_token);
          await supabaseAdmin
            .from("social_connections")
            .update({ access_token: t.accessToken, expires_at: t.expiresAt.toISOString(), updated_at: new Date().toISOString() })
            .eq("id", conn.id);
          token = t.accessToken;
        } else {
          token = conn.access_token;
        }
      }
    }
  } catch (err) {
    console.error(`automations: token refresh failed (${key}):`, err);
    token = null;
  }

  cache.set(key, token);
  return token;
}

async function fetchSourceViews(
  rule: RuleRow,
  post: SourcePost,
  token: string
): Promise<number | null> {
  switch (rule.source_platform) {
    case "youtube": {
      if (!post.youtube_video_id) return null;
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${post.youtube_video_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      const views = data.items?.[0]?.statistics?.viewCount;
      return views !== undefined ? Number(views) : null;
    }
    case "instagram":
      return post.platform_post_id ? getInstagramMediaViews(post.platform_post_id, token) : null;
    case "facebook":
      return post.platform_post_id ? getFacebookVideoViews(post.platform_post_id, token) : null;
    case "tiktok":
      return post.platform_post_id ? getTikTokVideoViews(token, post.platform_post_id) : null;
    case "x":
      return post.platform_post_id ? getTweetViews(token, post.platform_post_id) : null;
    case "threads":
      return post.platform_post_id ? getThreadsViews(post.platform_post_id, token) : null;
    default:
      return null;
  }
}

async function fireRule(rule: RuleRow, post: SourcePost, views: number): Promise<boolean> {
  // La red destino tiene que seguir conectada
  const { data: targetConn } = await supabaseAdmin
    .from("social_connections")
    .select("id")
    .eq("user_id", rule.user_id)
    .eq("platform", rule.target_platform)
    .single();
  if (!targetConn) {
    await updateRule(rule.id, {
      status: "failed",
      error: `${PLATFORM_NAMES[rule.target_platform]} está desconectado.`,
    });
    await releaseStorageIfUnused(supabaseAdmin, rule.storage_path, { excludeRuleId: rule.id });
    return false;
  }

  const { data: newPost, error } = await supabaseAdmin
    .from("scheduled_posts")
    .insert({
      user_id: rule.user_id,
      platform: rule.target_platform,
      title: rule.text,
      privacy: "public",
      scheduled_at: null, // publicar ya: el cron publish-scheduled lo coge en ≤5 min
      status: "scheduled",
      storage_path: rule.storage_path,
      group_id: post.group_id,
      settings: rule.settings ?? {},
      file_name: rule.file_name,
      file_size: rule.file_size,
    })
    .select("id")
    .single();
  if (error || !newPost) {
    console.error(`automations: rule ${rule.id} enqueue failed:`, error?.message);
    return false;
  }

  await updateRule(rule.id, { status: "fired", fired_post_id: newPost.id, last_views: views });

  // Reglas hermanas del mismo grupo hacia este destino ("si en A o B supera N"):
  // ya se publicó desde esta red, no duplicar el post cuando dispare la otra
  await supabaseAdmin
    .from("crosspost_rules")
    .update({ status: "expired", error: "Otra red de origen la disparó primero.", updated_at: new Date().toISOString() })
    .eq("rule_group_id", rule.rule_group_id)
    .eq("target_platform", rule.target_platform)
    .eq("status", "waiting")
    .neq("id", rule.id);

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("email")
    .eq("id", rule.user_id)
    .single();
  if (profile?.email) {
    await sendEmail(
      profile.email as string,
      `🚀 Regla cumplida: tu vídeo salta a ${PLATFORM_NAMES[rule.target_platform]}`,
      emailLayout({
        emoji: "🚀",
        heading: "¡Regla cumplida!",
        bodyHtml: `
          <p style="margin:0 0 8px"><strong>«${escapeHtml(post.title.slice(0, 80))}»</strong> ha superado las
          <strong>${formatViews(rule.threshold)}</strong> visitas en ${PLATFORM_NAMES[rule.source_platform]}
          (lleva ${formatViews(views)}).</p>
          <p style="margin:0">Tal y como programaste, lo estamos publicando también en
          <strong>${PLATFORM_NAMES[rule.target_platform]}</strong>. En unos minutos estará fuera.</p>
        `,
        ctaHref: `${process.env.NEXT_PUBLIC_APP_URL}/publicar`,
        ctaLabel: "Ver mis publicaciones →",
        footerNote: "Configura reglas condicionales al publicar en Social Flamingo.",
      })
    );
  }
  return true;
}

async function runCrosspostRules(): Promise<{ fired: number; expired: number; checked: number }> {
  const { data: rules } = await supabaseAdmin
    .from("crosspost_rules")
    .select("*")
    .eq("status", "waiting")
    .order("created_at", { ascending: true })
    .limit(RULES_BATCH);
  if (!rules?.length) return { fired: 0, expired: 0, checked: 0 };

  const { data: posts } = await supabaseAdmin
    .from("scheduled_posts")
    .select("id, status, youtube_video_id, platform_post_id, group_id, title")
    .in("id", rules.map((r) => r.source_post_id as string));
  const postById = new Map((posts ?? []).map((p) => [p.id as string, p as SourcePost]));

  const tokenCache = new Map<string, string | null>();
  // Pares (grupo, destino) ya disparados en este run: sus hermanas quedaron
  // superadas en BD pero siguen en el batch en memoria — saltarlas
  const firedGroupTargets = new Set<string>();
  let fired = 0;
  let expired = 0;
  let checked = 0;

  for (const raw of rules as RuleRow[]) {
    const rule = raw;
    if (firedGroupTargets.has(`${rule.rule_group_id}:${rule.target_platform}`)) continue;
    try {
      // Ventana agotada → la regla caduca y el vídeo se libera
      const expiresAt = new Date(rule.created_at).getTime() + rule.window_days * 86_400_000;
      if (Date.now() > expiresAt) {
        await updateRule(rule.id, { status: "expired" });
        await releaseStorageIfUnused(supabaseAdmin, rule.storage_path, { excludeRuleId: rule.id });
        expired++;
        continue;
      }

      const post = postById.get(rule.source_post_id);
      if (!post || post.status === "failed") {
        await updateRule(rule.id, {
          status: "failed",
          error: "La publicación de origen falló o ya no existe.",
        });
        await releaseStorageIfUnused(supabaseAdmin, rule.storage_path, { excludeRuleId: rule.id });
        continue;
      }
      // Aún sin publicar en la red origen: no hay visitas que medir todavía
      if (post.status !== "published") continue;

      const token = await getFreshToken(tokenCache, rule.user_id, rule.source_platform);
      if (!token) {
        await updateRule(rule.id, { checked_at: new Date().toISOString() });
        continue;
      }

      const views = await fetchSourceViews(rule, post, token);
      checked++;
      await updateRule(rule.id, {
        checked_at: new Date().toISOString(),
        ...(views !== null ? { last_views: views } : {}),
      });

      if (views !== null && views >= rule.threshold) {
        if (await fireRule(rule, post, views)) {
          fired++;
          firedGroupTargets.add(`${rule.rule_group_id}:${rule.target_platform}`);
        }
      }
    } catch (err) {
      console.error(`automations: rule ${rule.id} evaluation failed:`, err);
    }
  }

  return { fired, expired, checked };
}

export async function GET(request: NextRequest) {
  // Fail closed: sin CRON_SECRET configurado el endpoint queda cerrado
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Los emails de hitos van tras el flag; las reglas condicionales se crean al
  // publicar (ya protegidas por los flags de cada red), así que se evalúan siempre.
  let milestones = 0;
  if (process.env.ENABLE_AUTOMATIONS === "true") {
    milestones = await runMilestoneAlerts();
  }

  const rules = await runCrosspostRules();

  return NextResponse.json({ milestones, rules });
}
