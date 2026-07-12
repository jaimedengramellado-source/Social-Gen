import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { refreshAccessToken } from "@/lib/youtube-analytics";
import { sendEmail, emailLayout, escapeHtml } from "@/lib/email";

export const maxDuration = 120;

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Solo vídeos recientes: los hitos de vídeos antiguos ya no son noticia
const VIDEO_WINDOW_DAYS = 30;

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

export async function GET(request: NextRequest) {
  // Fail closed: sin CRON_SECRET configurado el endpoint queda cerrado
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.ENABLE_AUTOMATIONS !== "true") {
    return NextResponse.json({ skipped: "disabled" });
  }

  const { data: automations, error } = await supabaseAdmin
    .from("post_automations")
    .select("*")
    .eq("active", true)
    .eq("platform", "youtube")
    .eq("trigger", "views_milestone");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!automations?.length) return NextResponse.json({ fired: 0 });

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

  return NextResponse.json({ fired });
}
