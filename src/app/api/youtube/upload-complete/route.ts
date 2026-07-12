import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { refreshAccessToken } from "@/lib/youtube-analytics";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await request.json();
  const postId = typeof body.postId === "string" ? body.postId : null;
  const videoId = typeof body.videoId === "string" ? body.videoId : null;
  const failedError = typeof body.error === "string" ? body.error.slice(0, 500) : null;

  if (!postId) return NextResponse.json({ error: "MISSING_POST_ID" }, { status: 400 });

  const { data: post } = await supabase
    .from("scheduled_posts")
    .select("*")
    .eq("id", postId)
    .eq("user_id", user.id)
    .single();
  if (!post) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // El cliente reporta que la subida falló: marcar y limpiar el evento del calendario
  if (failedError || !videoId) {
    await supabase
      .from("scheduled_posts")
      .update({
        status: "failed",
        error: failedError ?? "Subida interrumpida.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId);
    if (post.calendar_event_id) {
      await supabase.from("calendar_events").delete().eq("id", post.calendar_event_id).eq("user_id", user.id);
    }
    return NextResponse.json({ ok: true, status: "failed" });
  }

  // Verificar contra la API que el vídeo existe y pertenece al canal conectado
  // (el videoId lo reporta el cliente: sin esto podría enlazar un vídeo ajeno)
  const { data: conn } = await supabase
    .from("youtube_connections")
    .select("*")
    .eq("user_id", user.id)
    .single();
  if (!conn) return NextResponse.json({ error: "NOT_CONNECTED" }, { status: 404 });

  let token: string;
  try {
    token = await refreshAccessToken(conn, supabase);
  } catch {
    return NextResponse.json({ error: "TOKEN_ERROR" }, { status: 401 });
  }

  const videoRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?id=${encodeURIComponent(videoId)}&part=snippet,status`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const videoData = await videoRes.json();
  const video = videoData.items?.[0];
  if (!video || video.snippet?.channelId !== conn.channel_id) {
    return NextResponse.json({ error: "VIDEO_NOT_FOUND" }, { status: 400 });
  }

  const isScheduled = post.scheduled_at && new Date(post.scheduled_at).getTime() > Date.now();

  const { data: updated, error } = await supabase
    .from("scheduled_posts")
    .update({
      youtube_video_id: videoId,
      status: isScheduled ? "scheduled" : "published",
      error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(updated);
}
