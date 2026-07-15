// TikTok Content Posting API. Los vídeos van por FILE_UPLOAD (init → PUT de
// chunks → poll de status): PULL_FROM_URL para vídeo está roto en el lado de
// TikTok, así que el cron descarga del bucket por rangos y los reenvía.
// Sin audit de TikTok aprobado, la API fuerza los posts a privados (SELF_ONLY).

const API = "https://open.tiktokapis.com/v2";

// video.list: leer visitas de los vídeos propios (reglas de publicación cruzada)
export const TIKTOK_SCOPES = ["user.info.basic", "video.publish", "video.upload", "video.list"];

// ≤64 MB cabe en un único chunk; por encima, chunks de 10 MB donde el último
// absorbe el resto (TikTok exige floor, no ceil, en total_chunk_count).
const MAX_SINGLE_CHUNK = 64 * 1024 * 1024;
const CHUNK_SIZE = 10 * 1024 * 1024;

export function tiktokChunkPlan(videoSize: number): { chunkSize: number; totalChunkCount: number } {
  if (videoSize <= MAX_SINGLE_CHUNK) return { chunkSize: videoSize, totalChunkCount: 1 };
  return { chunkSize: CHUNK_SIZE, totalChunkCount: Math.floor(videoSize / CHUNK_SIZE) };
}

export function tiktokAuthUrl(redirectUri: string, state: string): string {
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.searchParams.set("client_key", process.env.TIKTOK_CLIENT_KEY!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", TIKTOK_SCOPES.join(","));
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

export interface TikTokTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  openId: string;
  scope: string;
}

async function tokenRequest(body: Record<string, string>): Promise<TikTokTokens> {
  const res = await fetch(`${API}/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      ...body,
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(data.error_description ?? data.error ?? "TikTok token error");
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 86_400) * 1000),
    openId: data.open_id,
    scope: data.scope ?? "",
  };
}

export function exchangeTikTokCode(code: string, redirectUri: string): Promise<TikTokTokens> {
  return tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri });
}

// El access token de TikTok caduca en 24h: el cron refresca siempre antes de publicar
export function refreshTikTokToken(refreshToken: string): Promise<TikTokTokens> {
  return tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" });
}

async function apiFetch<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      ...init?.headers,
    },
  });
  const data = await res.json();
  if (data.error && data.error.code !== "ok") {
    throw new Error(data.error.message ?? data.error.code ?? `TikTok error (${res.status})`);
  }
  return data as T;
}

export async function getTikTokUserInfo(accessToken: string): Promise<{
  openId: string;
  username: string | null;
  displayName: string | null;
  avatar: string | null;
}> {
  const data = await apiFetch<{
    data: { user: { open_id: string; username?: string; display_name?: string; avatar_url?: string } };
  }>(`/user/info/?fields=open_id,username,display_name,avatar_url`, accessToken);
  const u = data.data.user;
  return {
    openId: u.open_id,
    username: u.username ?? null,
    displayName: u.display_name ?? null,
    avatar: u.avatar_url ?? null,
  };
}

export interface TikTokCreatorInfo {
  privacyOptions: string[];
  maxVideoDurationSec: number;
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  nickname: string | null;
}

// Obligatorio consultarlo antes de publicar: dicta las opciones de privacidad
// permitidas (apps sin audit solo reciben SELF_ONLY) y la duración máxima.
export async function queryCreatorInfo(accessToken: string): Promise<TikTokCreatorInfo> {
  const data = await apiFetch<{
    data: {
      privacy_level_options?: string[];
      max_video_post_duration_sec?: number;
      comment_disabled?: boolean;
      duet_disabled?: boolean;
      stitch_disabled?: boolean;
      creator_nickname?: string;
    };
  }>(`/post/publish/creator_info/query/`, accessToken, { method: "POST" });
  return {
    privacyOptions: data.data.privacy_level_options ?? ["SELF_ONLY"],
    maxVideoDurationSec: data.data.max_video_post_duration_sec ?? 600,
    commentDisabled: data.data.comment_disabled ?? false,
    duetDisabled: data.data.duet_disabled ?? false,
    stitchDisabled: data.data.stitch_disabled ?? false,
    nickname: data.data.creator_nickname ?? null,
  };
}

export async function initTikTokVideoPost(opts: {
  accessToken: string;
  title: string;
  privacyLevel: string;
  videoSize: number;
}): Promise<{ publishId: string; uploadUrl: string }> {
  const plan = tiktokChunkPlan(opts.videoSize);
  const data = await apiFetch<{ data: { publish_id: string; upload_url: string } }>(
    `/post/publish/video/init/`,
    opts.accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        post_info: {
          title: opts.title,
          privacy_level: opts.privacyLevel,
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: {
          source: "FILE_UPLOAD",
          video_size: opts.videoSize,
          chunk_size: plan.chunkSize,
          total_chunk_count: plan.totalChunkCount,
        },
      }),
    }
  );
  return { publishId: data.data.publish_id, uploadUrl: data.data.upload_url };
}

// Fotos: la Content Posting API solo admite PULL_FROM_URL (no hay FILE_UPLOAD
// de imágenes). TikTok exige que el prefijo de la URL esté verificado en el
// developer portal → las servimos desde nuestro dominio vía el proxy de medios
// (/api/publicaciones/media), no con la URL firmada de Supabase.
export async function initTikTokPhotoPost(opts: {
  accessToken: string;
  title: string;
  privacyLevel: string;
  photoUrls: string[];
}): Promise<{ publishId: string }> {
  const data = await apiFetch<{ data: { publish_id: string } }>(
    `/post/publish/content/init/`,
    opts.accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        post_info: {
          title: opts.title.slice(0, 90),
          description: opts.title.slice(0, 4000),
          privacy_level: opts.privacyLevel,
          disable_comment: false,
          auto_add_music: true,
        },
        source_info: {
          source: "PULL_FROM_URL",
          photo_cover_index: 0,
          photo_images: opts.photoUrls,
        },
        post_mode: "DIRECT_POST",
        media_type: "PHOTO",
      }),
    }
  );
  return { publishId: data.data.publish_id };
}

// Reenvía los bytes del bucket a TikTok por rangos, sin cargar el vídeo entero
// en memoria. Los chunks intermedios responden 206, solo el último 200/201.
export async function uploadTikTokVideoFromUrl(
  uploadUrl: string,
  sourceUrl: string,
  videoSize: number,
  contentType = "video/mp4"
): Promise<void> {
  const { chunkSize, totalChunkCount } = tiktokChunkPlan(videoSize);

  for (let i = 0; i < totalChunkCount; i++) {
    const start = i * chunkSize;
    const end = i === totalChunkCount - 1 ? videoSize - 1 : start + chunkSize - 1;

    const source = await fetch(sourceUrl, { headers: { Range: `bytes=${start}-${end}` } });
    if (!source.ok || !source.body) {
      throw new Error(`No se pudo leer el vídeo del almacenamiento (${source.status})`);
    }

    const upload = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${videoSize}`,
      },
      body: source.body,
      // exigido por undici al hacer streaming del body
      // @ts-expect-error duplex no está en los tipos de RequestInit
      duplex: "half",
    });

    if (![200, 201, 206].includes(upload.status)) {
      const text = await upload.text().catch(() => "");
      throw new Error(`TikTok rechazó el chunk ${i + 1}/${totalChunkCount} (${upload.status}): ${text.slice(0, 200)}`);
    }
  }
}

export type TikTokPublishStatus =
  | { state: "processing" }
  | { state: "complete"; videoId: string | null }
  | { state: "failed"; reason: string };

export async function fetchPublishStatus(
  accessToken: string,
  publishId: string
): Promise<TikTokPublishStatus> {
  const data = await apiFetch<{
    data: { status: string; publicaly_available_post_id?: string[]; fail_reason?: string };
  }>(`/post/publish/status/fetch/`, accessToken, {
    method: "POST",
    body: JSON.stringify({ publish_id: publishId }),
  });

  const status = data.data.status;
  if (status === "PUBLISH_COMPLETE") {
    return { state: "complete", videoId: data.data.publicaly_available_post_id?.[0] ?? null };
  }
  if (status === "FAILED") {
    return { state: "failed", reason: data.data.fail_reason ?? "desconocido" };
  }
  return { state: "processing" };
}

// Visitas de un vídeo propio. Requiere scope video.list; null si no hay permiso.
export async function getTikTokVideoViews(
  accessToken: string,
  videoId: string
): Promise<number | null> {
  try {
    const data = await apiFetch<{
      data?: { videos?: Array<{ id: string; view_count?: number }> };
    }>(`/video/query/?fields=id,view_count`, accessToken, {
      method: "POST",
      body: JSON.stringify({ filters: { video_ids: [videoId] } }),
    });
    const views = data.data?.videos?.find((v) => v.id === videoId)?.view_count;
    return typeof views === "number" ? views : null;
  } catch {
    return null;
  }
}

export async function revokeTikTokAccess(accessToken: string): Promise<void> {
  await fetch(`${API}/oauth/revoke/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      token: accessToken,
    }),
  }).catch(() => {});
}
