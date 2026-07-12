import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { refreshAccessToken } from "@/lib/youtube-analytics";

const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
const PRIVACY_VALUES = new Set(["public", "unlisted", "private"]);

export async function POST(request: NextRequest) {
  if (process.env.ENABLE_YOUTUBE_PUBLISHING !== "true") {
    return NextResponse.json({ error: "La publicación en YouTube aún no está disponible." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await request.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const privacy = PRIVACY_VALUES.has(body.privacy) ? body.privacy : "public";
  const scheduledAt = typeof body.scheduledAt === "string" && body.scheduledAt ? body.scheduledAt : null;
  const fileName = typeof body.fileName === "string" ? body.fileName.slice(0, 200) : null;
  const fileSize = Number(body.fileSize);
  const mimeType = typeof body.mimeType === "string" && body.mimeType.startsWith("video/")
    ? body.mimeType
    : "video/*";
  const tags: string[] = Array.isArray(body.tags)
    ? body.tags.filter((t: unknown): t is string => typeof t === "string" && t.length > 0).slice(0, 30)
    : [];
  const scriptId = typeof body.scriptId === "string" && body.scriptId ? body.scriptId : null;

  if (!title) return NextResponse.json({ error: "El título es obligatorio." }, { status: 400 });
  // Límites de YouTube: título 100 caracteres (sin < ni >), descripción 5000
  if (title.length > 100 || /[<>]/.test(title)) {
    return NextResponse.json({ error: "Título inválido: máximo 100 caracteres y sin los símbolos < >." }, { status: 400 });
  }
  if (description.length > 5000) {
    return NextResponse.json({ error: "La descripción supera los 5000 caracteres." }, { status: 400 });
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "Tamaño de archivo inválido (máximo 2 GB)." }, { status: 400 });
  }
  if (scheduledAt) {
    const ts = new Date(scheduledAt).getTime();
    if (Number.isNaN(ts) || ts < Date.now() + 5 * 60_000) {
      return NextResponse.json({ error: "La fecha de publicación debe ser al menos 5 minutos en el futuro." }, { status: 400 });
    }
  }

  const { data: conn } = await supabase
    .from("youtube_connections")
    .select("*")
    .eq("user_id", user.id)
    .single();
  if (!conn) return NextResponse.json({ error: "NOT_CONNECTED" }, { status: 404 });
  if (!conn.scopes?.includes("youtube.upload")) {
    return NextResponse.json({ error: "RECONNECT_REQUIRED" }, { status: 403 });
  }

  let token: string;
  try {
    token = await refreshAccessToken(conn, supabase);
  } catch {
    return NextResponse.json({ error: "RECONNECT_REQUIRED" }, { status: 403 });
  }

  // Programado: el vídeo se sube en privado con publishAt y YouTube lo hace
  // público a esa hora — sin cron propio. Inmediato: se sube con la visibilidad elegida.
  const status = scheduledAt
    ? { privacyStatus: "private", publishAt: new Date(scheduledAt).toISOString(), selfDeclaredMadeForKids: false }
    : { privacyStatus: privacy, selfDeclaredMadeForKids: false };

  const sessionRes = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(fileSize),
        "X-Upload-Content-Type": mimeType,
      },
      body: JSON.stringify({
        snippet: {
          title,
          description,
          tags,
          categoryId: "22",
          defaultLanguage: "es",
        },
        status,
      }),
    }
  );

  if (!sessionRes.ok) {
    const err = await sessionRes.json().catch(() => null);
    const reason = err?.error?.errors?.[0]?.reason ?? "";
    console.error("YouTube resumable session failed:", sessionRes.status, JSON.stringify(err?.error ?? {}));
    if (sessionRes.status === 401 || sessionRes.status === 403) {
      if (reason === "quotaExceeded" || reason === "uploadLimitExceeded") {
        return NextResponse.json(
          { error: "Se ha alcanzado el límite diario de subidas. Inténtalo mañana." },
          { status: 429 }
        );
      }
      return NextResponse.json({ error: "RECONNECT_REQUIRED" }, { status: 403 });
    }
    return NextResponse.json({ error: "No se pudo iniciar la subida a YouTube." }, { status: 502 });
  }

  const uploadUrl = sessionRes.headers.get("Location");
  if (!uploadUrl) {
    return NextResponse.json({ error: "YouTube no devolvió la URL de subida." }, { status: 502 });
  }

  // Evento en el calendario para publicaciones programadas (tag 🚀 publicar)
  let calendarEventId: string | null = null;
  if (scheduledAt) {
    const start = new Date(scheduledAt);
    const end = new Date(start.getTime() + 30 * 60_000);
    const { data: ev } = await supabase
      .from("calendar_events")
      .insert({
        user_id: user.id,
        title: `📺 ${title}`,
        description: "Publicación programada en YouTube desde Social Flamingo.",
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        scheduled_at: start.toISOString(),
        color: "#8C2230",
        tag: "publicar",
        remind_times: [],
        sent_reminder_offsets: [],
      })
      .select("id")
      .single();
    calendarEventId = ev?.id ?? null;
  }

  const { data: post, error: insertError } = await supabase
    .from("scheduled_posts")
    .insert({
      user_id: user.id,
      platform: "youtube",
      title,
      description: description || null,
      tags,
      privacy,
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      status: "uploading",
      script_id: scriptId,
      calendar_event_id: calendarEventId,
      file_name: fileName,
      file_size: fileSize,
    })
    .select("*")
    .single();

  if (insertError || !post) {
    return NextResponse.json({ error: insertError?.message ?? "DB_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ postId: post.id, uploadUrl });
}
