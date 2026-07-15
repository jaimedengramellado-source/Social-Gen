// X API v2 con OAuth 2.0 + PKCE. El access token caduca en 2h y el refresh
// token ROTA en cada uso: guardar siempre el par nuevo o la conexión muere.
// El vídeo sube por chunks multipart (initialize → append → finalize → status).

import { createHash, randomBytes } from "crypto";

const API = "https://api.x.com/2";

export const X_SCOPES = ["tweet.read", "tweet.write", "users.read", "media.write", "offline.access"];

// APPEND admite hasta 5 MB por segmento; 4 MB deja margen
const X_CHUNK_SIZE = 4 * 1024 * 1024;

export const X_MAX_TEXT = 280;

export function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function xAuthUrl(redirectUri: string, state: string, codeChallenge: string): string {
  const url = new URL("https://x.com/i/oauth2/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", process.env.X_CLIENT_ID!);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", X_SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export interface XTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
}

async function tokenRequest(body: Record<string, string>): Promise<XTokens> {
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  // App confidencial: el token endpoint exige Basic auth. App pública: client_id en el body.
  if (process.env.X_CLIENT_SECRET) {
    headers.Authorization = `Basic ${Buffer.from(
      `${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`
    ).toString("base64")}`;
  } else {
    body.client_id = process.env.X_CLIENT_ID!;
  }

  const res = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers,
    body: new URLSearchParams(body),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(data.error_description ?? data.error ?? `X token error (${res.status})`);
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? "",
    expiresAt: new Date(Date.now() + (data.expires_in ?? 7_200) * 1000),
    scope: data.scope ?? "",
  };
}

export function exchangeXCode(code: string, redirectUri: string, codeVerifier: string): Promise<XTokens> {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });
}

export function refreshXToken(refreshToken: string): Promise<XTokens> {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}

export async function revokeXAccess(token: string): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  const body: Record<string, string> = { token, token_type_hint: "access_token" };
  if (process.env.X_CLIENT_SECRET) {
    headers.Authorization = `Basic ${Buffer.from(
      `${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`
    ).toString("base64")}`;
  } else {
    body.client_id = process.env.X_CLIENT_ID!;
  }
  await fetch(`${API}/oauth2/revoke`, {
    method: "POST",
    headers,
    body: new URLSearchParams(body),
  }).catch(() => {});
}

async function apiFetch<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, ...init?.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.errors?.length || (data.title && data.status >= 400)) {
    const msg =
      data.errors?.[0]?.message ?? data.detail ?? data.title ?? `X error (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export async function getXUserInfo(accessToken: string): Promise<{
  id: string;
  username: string;
  name: string;
  avatar: string | null;
  verified: boolean;
}> {
  const data = await apiFetch<{
    data: { id: string; username: string; name: string; profile_image_url?: string; verified?: boolean };
  }>(`/users/me?user.fields=profile_image_url,username,name,verified`, accessToken);
  return {
    id: data.data.id,
    username: data.data.username,
    name: data.data.name,
    avatar: data.data.profile_image_url ?? null,
    verified: data.data.verified ?? false,
  };
}

// Sube el media del bucket a X por segmentos y devuelve el media_id. Sirve para
// vídeo (tweet_video) e imagen (tweet_image, máx 5 MB — un solo segmento).
// X lo procesa en asíncrono: el llamador debe esperar con fetchXMediaStatus
// (las imágenes salen sin processing_info, listas al instante).
export async function uploadXMediaFromUrl(
  accessToken: string,
  sourceUrl: string,
  mediaSize: number,
  contentType = "video/mp4",
  mediaCategory: "tweet_video" | "tweet_image" = "tweet_video"
): Promise<string> {
  const init = await apiFetch<{ data: { id: string } }>(`/media/upload/initialize`, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      media_category: mediaCategory,
      media_type: contentType,
      total_bytes: mediaSize,
    }),
  });
  const mediaId = init.data.id;

  const totalChunks = Math.ceil(mediaSize / X_CHUNK_SIZE);
  for (let i = 0; i < totalChunks; i++) {
    const start = i * X_CHUNK_SIZE;
    const end = Math.min(start + X_CHUNK_SIZE, mediaSize) - 1;

    const source = await fetch(sourceUrl, { headers: { Range: `bytes=${start}-${end}` } });
    if (!source.ok) throw new Error(`No se pudo leer el archivo del almacenamiento (${source.status})`);
    const chunk = await source.arrayBuffer();

    const form = new FormData();
    form.append("segment_index", String(i));
    form.append("media", new Blob([chunk], { type: contentType }));

    const res = await fetch(`${API}/media/upload/${mediaId}/append`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`X rechazó el segmento ${i + 1}/${totalChunks} (${res.status}): ${text.slice(0, 200)}`);
    }
  }

  await apiFetch<{ data: { id: string } }>(`/media/upload/${mediaId}/finalize`, accessToken, {
    method: "POST",
  });
  return mediaId;
}

export type XMediaStatus =
  | { state: "processing" }
  | { state: "succeeded" }
  | { state: "failed"; reason: string };

export async function fetchXMediaStatus(accessToken: string, mediaId: string): Promise<XMediaStatus> {
  const data = await apiFetch<{
    data: {
      processing_info?: { state: string; error?: { message?: string; name?: string } };
    };
  }>(`/media/upload?command=STATUS&media_id=${encodeURIComponent(mediaId)}`, accessToken);

  const info = data.data.processing_info;
  // Sin processing_info el media ya está listo (vídeos cortos se procesan al vuelo)
  if (!info || info.state === "succeeded") return { state: "succeeded" };
  if (info.state === "failed") {
    return { state: "failed", reason: info.error?.message ?? info.error?.name ?? "desconocido" };
  }
  return { state: "processing" };
}

// Visualizaciones del tweet (impression_count de public_metrics, solo tweets propios)
export async function getTweetViews(
  accessToken: string,
  tweetId: string
): Promise<number | null> {
  try {
    const data = await apiFetch<{
      data?: { public_metrics?: { impression_count?: number } };
    }>(`/tweets/${encodeURIComponent(tweetId)}?tweet.fields=public_metrics`, accessToken);
    const views = data.data?.public_metrics?.impression_count;
    return typeof views === "number" ? views : null;
  } catch {
    return null;
  }
}

export async function createTweet(
  accessToken: string,
  text: string,
  mediaId?: string
): Promise<string> {
  const data = await apiFetch<{ data: { id: string } }>(`/tweets`, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      ...(mediaId ? { media: { media_ids: [mediaId] } } : {}),
    }),
  });
  return data.data.id;
}
