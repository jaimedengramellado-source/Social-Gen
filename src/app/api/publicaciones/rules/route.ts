import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_WAITING_RULES = 20;
const MAX_SOCIAL_FILE_BYTES = 400 * 1024 * 1024;
const MIN_THRESHOLD = 100;
const MAX_THRESHOLD = 50_000_000;

// LinkedIn no expone visitas de posts personales → no puede ser origen.
// YouTube no publica por cron (subida directa navegador) → no puede ser destino.
const SOURCE_PLATFORMS = ["youtube", "instagram", "facebook", "tiktok", "x", "threads"];
const TARGET_PLATFORMS = ["instagram", "facebook", "tiktok", "x", "linkedin", "threads"];

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
  youtube: "YouTube",
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

  const { data, error } = await supabase
    .from("crosspost_rules")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// Crea un grupo de reglas condicionales: "si el vídeo supera N visitas en
// CUALQUIERA de las redes origen → publicarlo en TODAS las redes destino".
// Se materializa como una fila por par (origen, destino) con rule_group_id
// compartido; el cron da por superadas las hermanas al disparar un destino.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await request.json();
  const sourcePostIds: string[] = Array.isArray(body.sourcePostIds)
    ? body.sourcePostIds.filter((s: unknown) => typeof s === "string")
    : [];
  const targetPlatforms: string[] = Array.isArray(body.targetPlatforms)
    ? [...new Set(body.targetPlatforms.filter((t: unknown) => typeof t === "string"))] as string[]
    : [];
  const threshold = Number(body.threshold);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const privacyLevel = typeof body.privacyLevel === "string" ? body.privacyLevel : null;

  if (sourcePostIds.length === 0 || targetPlatforms.length === 0) {
    return NextResponse.json({ error: "Elige al menos una red de origen y una de destino." }, { status: 400 });
  }
  for (const target of targetPlatforms) {
    if (!TARGET_PLATFORMS.includes(target)) {
      return NextResponse.json({ error: "INVALID_TARGET" }, { status: 400 });
    }
    if (PLATFORM_FLAGS[target] !== "true") {
      return NextResponse.json(
        { error: `La publicación en ${PLATFORM_NAMES[target]} aún no está disponible.` },
        { status: 503 }
      );
    }
    if (!text || text.length > TEXT_LIMITS[target]) {
      return NextResponse.json(
        { error: `El texto de la regla es obligatorio y debe caber en ${PLATFORM_NAMES[target]} (máximo ${TEXT_LIMITS[target]} caracteres).` },
        { status: 400 }
      );
    }
  }
  if (!Number.isInteger(threshold) || threshold < MIN_THRESHOLD || threshold > MAX_THRESHOLD) {
    return NextResponse.json(
      { error: `El umbral debe estar entre ${MIN_THRESHOLD.toLocaleString("es-ES")} y ${MAX_THRESHOLD.toLocaleString("es-ES")} visitas.` },
      { status: 400 }
    );
  }

  const { data: posts } = await supabase
    .from("scheduled_posts")
    .select("id, platform, storage_path, file_name, file_size, media_type")
    .in("id", sourcePostIds)
    .eq("user_id", user.id);
  if (!posts || posts.length !== sourcePostIds.length) {
    return NextResponse.json({ error: "SOURCE_POST_NOT_FOUND" }, { status: 404 });
  }
  for (const post of posts) {
    if (post.media_type === "image") {
      return NextResponse.json(
        { error: "Las reglas condicionales solo aplican a vídeos: no todas las redes exponen visitas de fotos." },
        { status: 400 }
      );
    }
    if (!SOURCE_PLATFORMS.includes(post.platform)) {
      return NextResponse.json(
        { error: `${PLATFORM_NAMES[post.platform] ?? post.platform} no permite leer visitas — no puede ser red origen.` },
        { status: 400 }
      );
    }
    if (targetPlatforms.includes(post.platform)) {
      return NextResponse.json({ error: "Una red no puede ser origen y destino a la vez." }, { status: 400 });
    }
  }

  const { data: conns } = await supabase
    .from("social_connections")
    .select("platform")
    .eq("user_id", user.id)
    .in("platform", targetPlatforms);
  const connected = new Set((conns ?? []).map((c) => c.platform));
  const missing = targetPlatforms.find((t) => !connected.has(t));
  if (missing) {
    return NextResponse.json(
      { error: `Conecta tu cuenta de ${PLATFORM_NAMES[missing]} primero.` },
      { status: 404 }
    );
  }

  // El vídeo tiene que quedar retenido en el bucket. Cualquier post de cron del
  // grupo ya lo tiene; si todos los orígenes son YouTube (subida directa), el
  // compositor lo sube aparte y nos pasa el path.
  const withStorage = posts.find((p) => p.storage_path);
  let storagePath = (withStorage?.storage_path as string | null) ?? null;
  let fileName = (withStorage?.file_name as string | null) ?? null;
  let fileSize = (withStorage?.file_size as number | null) ?? null;
  if (!storagePath) {
    storagePath = typeof body.storagePath === "string" ? body.storagePath : null;
    fileName = typeof body.fileName === "string" ? body.fileName.slice(0, 200) : null;
    fileSize = Number(body.fileSize) || null;
    if (!storagePath || !storagePath.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: "INVALID_STORAGE_PATH" }, { status: 400 });
    }
    if (!fileSize || fileSize <= 0 || fileSize > MAX_SOCIAL_FILE_BYTES) {
      return NextResponse.json({ error: "Tamaño de archivo inválido (máximo 400 MB)." }, { status: 400 });
    }
    const lastSlash = storagePath.lastIndexOf("/");
    const { data: files } = await supabase.storage
      .from("publish-videos")
      .list(storagePath.slice(0, lastSlash), { search: storagePath.slice(lastSlash + 1) });
    if (!files?.some((f) => f.name === storagePath!.slice(lastSlash + 1))) {
      return NextResponse.json({ error: "VIDEO_NOT_UPLOADED" }, { status: 400 });
    }
  }

  const newRules = posts.length * targetPlatforms.length;
  const { count } = await supabase
    .from("crosspost_rules")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "waiting");
  if ((count ?? 0) + newRules > MAX_WAITING_RULES) {
    return NextResponse.json(
      { error: `Máximo ${MAX_WAITING_RULES} reglas en espera. Elimina alguna en Publicar.` },
      { status: 400 }
    );
  }

  const ruleGroupId = crypto.randomUUID();
  const rows = posts.flatMap((post) =>
    targetPlatforms.map((target) => ({
      user_id: user.id,
      rule_group_id: ruleGroupId,
      source_post_id: post.id,
      source_platform: post.platform,
      target_platform: target,
      threshold,
      text,
      settings: target === "tiktok" && privacyLevel ? { privacy_level: privacyLevel } : {},
      storage_path: storagePath,
      file_name: fileName,
      file_size: fileSize,
    }))
  );

  const { data: rules, error } = await supabase
    .from("crosspost_rules")
    .insert(rows)
    .select("*");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(rules);
}
