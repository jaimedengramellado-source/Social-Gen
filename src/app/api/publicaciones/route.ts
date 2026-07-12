import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const STUCK_UPLOAD_MS = 3 * 3_600_000;
const MAX_SOCIAL_FILE_BYTES = 200 * 1024 * 1024; // límite del bucket publish-videos

const PLATFORM_FLAGS: Record<string, string | undefined> = {
  instagram: process.env.ENABLE_INSTAGRAM_PUBLISHING,
  tiktok: process.env.ENABLE_TIKTOK_PUBLISHING,
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const nowIso = new Date().toISOString();

  // Solo YouTube publica solo (publishAt nativo): aquí basta reflejar el estado.
  // IG/TikTok los publica el cron publish-scheduled — no tocarlos por tiempo.
  await supabase
    .from("scheduled_posts")
    .update({ status: "published", updated_at: nowIso })
    .eq("user_id", user.id)
    .eq("platform", "youtube")
    .eq("status", "scheduled")
    .lte("scheduled_at", nowIso);

  // Subidas a YouTube abandonadas (pestaña cerrada a mitad): marcarlas como fallidas
  await supabase
    .from("scheduled_posts")
    .update({ status: "failed", error: "Subida interrumpida.", updated_at: nowIso })
    .eq("user_id", user.id)
    .eq("status", "uploading")
    .lte("created_at", new Date(Date.now() - STUCK_UPLOAD_MS).toISOString());

  const { data, error } = await supabase
    .from("scheduled_posts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// Crea una publicación de Instagram/TikTok. El vídeo ya está en el bucket
// publish-videos (lo sube el navegador); el cron publish-scheduled lo publica.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await request.json();
  const platform = body.platform;
  if (platform !== "instagram" && platform !== "tiktok") {
    return NextResponse.json({ error: "INVALID_PLATFORM" }, { status: 400 });
  }
  if (PLATFORM_FLAGS[platform] !== "true") {
    return NextResponse.json({ error: "La publicación en esta red aún no está disponible." }, { status: 503 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const storagePath = typeof body.storagePath === "string" ? body.storagePath : "";
  const fileName = typeof body.fileName === "string" ? body.fileName.slice(0, 200) : null;
  const fileSize = Number(body.fileSize);
  const scheduledAt = typeof body.scheduledAt === "string" && body.scheduledAt ? body.scheduledAt : null;
  const privacyLevel = typeof body.privacyLevel === "string" ? body.privacyLevel : null;

  if (!title || title.length > 2200) {
    return NextResponse.json({ error: "El texto es obligatorio (máximo 2200 caracteres)." }, { status: 400 });
  }
  // El path debe colgar de la carpeta del usuario: es lo que garantiza la policy
  // de Storage, y evita publicar vídeos de otros
  if (!storagePath.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "INVALID_STORAGE_PATH" }, { status: 400 });
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_SOCIAL_FILE_BYTES) {
    return NextResponse.json({ error: "Tamaño de archivo inválido (máximo 200 MB)." }, { status: 400 });
  }
  if (scheduledAt) {
    const ts = new Date(scheduledAt).getTime();
    if (Number.isNaN(ts) || ts < Date.now() + 5 * 60_000) {
      return NextResponse.json({ error: "La fecha de publicación debe ser al menos 5 minutos en el futuro." }, { status: 400 });
    }
  }

  const { data: conn } = await supabase
    .from("social_connections")
    .select("id")
    .eq("user_id", user.id)
    .eq("platform", platform)
    .single();
  if (!conn) return NextResponse.json({ error: "NOT_CONNECTED" }, { status: 404 });

  // Confirmar que el vídeo existe en el bucket antes de encolar
  const lastSlash = storagePath.lastIndexOf("/");
  const { data: files } = await supabase.storage
    .from("publish-videos")
    .list(storagePath.slice(0, lastSlash), { search: storagePath.slice(lastSlash + 1) });
  if (!files?.some((f) => f.name === storagePath.slice(lastSlash + 1))) {
    return NextResponse.json({ error: "VIDEO_NOT_UPLOADED" }, { status: 400 });
  }

  let calendarEventId: string | null = null;
  if (scheduledAt) {
    const start = new Date(scheduledAt);
    const platformLabel = platform === "instagram" ? "Instagram" : "TikTok";
    const { data: ev } = await supabase
      .from("calendar_events")
      .insert({
        user_id: user.id,
        title: `📺 ${title.slice(0, 80)}`,
        description: `Publicación programada en ${platformLabel} desde Social Flamingo.`,
        start_time: start.toISOString(),
        end_time: new Date(start.getTime() + 30 * 60_000).toISOString(),
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

  const { data: post, error } = await supabase
    .from("scheduled_posts")
    .insert({
      user_id: user.id,
      platform,
      title,
      privacy: "public",
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      status: "scheduled",
      storage_path: storagePath,
      settings: privacyLevel ? { privacy_level: privacyLevel } : {},
      calendar_event_id: calendarEventId,
      file_name: fileName,
      file_size: fileSize,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(post);
}
