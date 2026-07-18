import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const STUCK_UPLOAD_MS = 3 * 3_600_000;
const MAX_VIDEO_BYTES = 400 * 1024 * 1024;
// El cliente re-codifica a JPEG ≤5 MB; el margen extra cubre JPEG originales sin conversión
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const PLATFORM_FLAGS: Record<string, string | undefined> = {
  instagram: process.env.ENABLE_INSTAGRAM_PUBLISHING,
  facebook: process.env.ENABLE_FACEBOOK_PUBLISHING,
  tiktok: process.env.ENABLE_TIKTOK_PUBLISHING,
  x: process.env.ENABLE_X_PUBLISHING,
  linkedin: process.env.ENABLE_LINKEDIN_PUBLISHING,
  threads: process.env.ENABLE_THREADS_PUBLISHING,
};

const TEXT_LIMITS: Record<string, number> = {
  instagram: 2200,
  facebook: 5000,
  tiktok: 2200,
  x: 280,
  linkedin: 3000,
  threads: 500,
};

const PLATFORM_NAMES: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  x: "X",
  linkedin: "LinkedIn",
  threads: "Threads",
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const nowIso = new Date().toISOString();

  // Solo YouTube publica solo (publishAt nativo): aquí basta reflejar el estado.
  // El resto de redes las publica el cron publish-scheduled — no tocarlas por tiempo.
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

interface PlatformEntry {
  platform: string;
  text: string;
  privacyLevel?: string;
  // Variante de foto recortada para esta red; sin ella se usa el archivo base
  storagePath?: string;
  fileSize?: number;
}

// Crea las publicaciones de un mismo vídeo en una o varias redes (grupo con
// group_id compartido). El vídeo ya está en el bucket publish-videos (lo sube
// el navegador); el cron publish-scheduled lo publica. YouTube no pasa por
// aquí: tiene subida directa navegador→YouTube en /api/youtube/upload-session.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await request.json();

  const rawPlatforms: unknown = body.platforms;
  if (!Array.isArray(rawPlatforms) || rawPlatforms.length === 0) {
    return NextResponse.json({ error: "Selecciona al menos una red." }, { status: 400 });
  }

  const entries: PlatformEntry[] = [];
  const seen = new Set<string>();
  for (const raw of rawPlatforms) {
    const platform = typeof raw?.platform === "string" ? raw.platform : "";
    const text = typeof raw?.text === "string" ? raw.text.trim() : "";
    if (!(platform in TEXT_LIMITS)) {
      return NextResponse.json({ error: "INVALID_PLATFORM" }, { status: 400 });
    }
    if (seen.has(platform)) {
      return NextResponse.json({ error: "DUPLICATE_PLATFORM" }, { status: 400 });
    }
    seen.add(platform);
    if (PLATFORM_FLAGS[platform] !== "true") {
      return NextResponse.json(
        { error: `La publicación en ${PLATFORM_NAMES[platform]} aún no está disponible.` },
        { status: 503 }
      );
    }
    if (!text || text.length > TEXT_LIMITS[platform]) {
      return NextResponse.json(
        { error: `El texto de ${PLATFORM_NAMES[platform]} es obligatorio (máximo ${TEXT_LIMITS[platform]} caracteres).` },
        { status: 400 }
      );
    }
    entries.push({
      platform,
      text,
      privacyLevel: typeof raw?.privacyLevel === "string" ? raw.privacyLevel : undefined,
      storagePath: typeof raw?.storagePath === "string" && raw.storagePath ? raw.storagePath : undefined,
      fileSize: raw?.fileSize !== undefined ? Number(raw.fileSize) : undefined,
    });
  }

  // El base es opcional si todas las redes traen su propia variante recortada
  const storagePath = typeof body.storagePath === "string" && body.storagePath ? body.storagePath : null;
  const fileName = typeof body.fileName === "string" ? body.fileName.slice(0, 200) : null;
  const fileSize = Number(body.fileSize);
  const mediaType = body.mediaType === "image" ? "image" : "video";
  const scheduledAt = typeof body.scheduledAt === "string" && body.scheduledAt ? body.scheduledAt : null;

  // Todos los paths deben colgar de la carpeta del usuario: es lo que garantiza
  // la policy de Storage, y evita publicar vídeos de otros
  if (storagePath && !storagePath.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "INVALID_STORAGE_PATH" }, { status: 400 });
  }
  for (const e of entries) {
    if (e.storagePath !== undefined) {
      // Solo las fotos tienen variantes por red (el vídeo no se recorta)
      if (mediaType !== "image" || !e.storagePath.startsWith(`${user.id}/`)) {
        return NextResponse.json({ error: "INVALID_STORAGE_PATH" }, { status: 400 });
      }
      if (!Number.isFinite(e.fileSize) || e.fileSize! <= 0 || e.fileSize! > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: "Tamaño de archivo inválido (máximo 8 MB)." }, { status: 400 });
      }
    } else if (!storagePath) {
      return NextResponse.json({ error: "INVALID_STORAGE_PATH" }, { status: 400 });
    }
  }
  const maxBytes = mediaType === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > maxBytes) {
    return NextResponse.json(
      { error: `Tamaño de archivo inválido (máximo ${mediaType === "image" ? "8" : "400"} MB).` },
      { status: 400 }
    );
  }
  if (scheduledAt) {
    const ts = new Date(scheduledAt).getTime();
    if (Number.isNaN(ts) || ts < Date.now() + 5 * 60_000) {
      return NextResponse.json({ error: "La fecha de publicación debe ser al menos 5 minutos en el futuro." }, { status: 400 });
    }
  }

  // Todas las redes seleccionadas deben estar conectadas
  const { data: conns } = await supabase
    .from("social_connections")
    .select("platform")
    .eq("user_id", user.id)
    .in("platform", entries.map((e) => e.platform));
  const connected = new Set((conns ?? []).map((c) => c.platform));
  const missing = entries.find((e) => !connected.has(e.platform));
  if (missing) {
    return NextResponse.json(
      { error: `Conecta tu cuenta de ${PLATFORM_NAMES[missing.platform]} primero.` },
      { status: 404 }
    );
  }

  // Confirmar que base y variantes existen en el bucket antes de encolar
  const uniquePaths = [
    ...new Set([
      ...(storagePath ? [storagePath] : []),
      ...entries.flatMap((e) => (e.storagePath ? [e.storagePath] : [])),
    ]),
  ];
  for (const path of uniquePaths) {
    const lastSlash = path.lastIndexOf("/");
    const { data: files } = await supabase.storage
      .from("publish-videos")
      .list(path.slice(0, lastSlash), { search: path.slice(lastSlash + 1) });
    if (!files?.some((f) => f.name === path.slice(lastSlash + 1))) {
      return NextResponse.json({ error: "VIDEO_NOT_UPLOADED" }, { status: 400 });
    }
  }

  const groupId = crypto.randomUUID();
  const primaryText = entries[0].text;

  // Un único evento de calendario para todo el grupo
  let calendarEventId: string | null = null;
  if (scheduledAt) {
    const start = new Date(scheduledAt);
    const labels = entries.map((e) => PLATFORM_NAMES[e.platform]).join(", ");
    const { data: ev } = await supabase
      .from("calendar_events")
      .insert({
        user_id: user.id,
        title: `${mediaType === "image" ? "📸" : "📺"} ${primaryText.slice(0, 80)}`,
        description: `Publicación programada en ${labels} desde Social Flamingo.`,
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

  const rows = entries.map((e) => ({
    user_id: user.id,
    platform: e.platform,
    title: e.text,
    privacy: "public",
    scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    status: "scheduled",
    storage_path: e.storagePath ?? storagePath,
    media_type: mediaType,
    group_id: groupId,
    settings: e.platform === "tiktok" && e.privacyLevel ? { privacy_level: e.privacyLevel } : {},
    calendar_event_id: calendarEventId,
    file_name: fileName,
    file_size: e.fileSize ?? fileSize,
  }));

  const { data: posts, error } = await supabase
    .from("scheduled_posts")
    .insert(rows)
    .select("*");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(posts);
}
