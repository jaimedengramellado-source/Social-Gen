// LinkedIn REST API (posts en perfil personal con w_member_social).
// Token de 60 días; el refresh token programático solo lo dan a apps aprobadas
// en el Marketing Developer Platform — si no llega, al caducar toca reconectar.
// Vídeo: initializeUpload → PUT por partes (byte ranges que dicta LinkedIn,
// guardando los ETags) → finalizeUpload → esperar status AVAILABLE → crear post.

const OAUTH = "https://www.linkedin.com/oauth/v2";
const API = "https://api.linkedin.com";
const LINKEDIN_VERSION = "202601";

export const LINKEDIN_SCOPES = ["openid", "profile", "email", "w_member_social"];

export const LINKEDIN_MAX_TEXT = 3000;

const REST_HEADERS = {
  "LinkedIn-Version": LINKEDIN_VERSION,
  "X-Restli-Protocol-Version": "2.0.0",
};

export function linkedinAuthUrl(redirectUri: string, state: string): string {
  const url = new URL(`${OAUTH}/authorization`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", process.env.LINKEDIN_CLIENT_ID!);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", LINKEDIN_SCOPES.join(" "));
  return url.toString();
}

export interface LinkedInTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  scope: string;
}

async function tokenRequest(body: Record<string, string>): Promise<LinkedInTokens> {
  const res = await fetch(`${OAUTH}/accessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      ...body,
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(data.error_description ?? data.error ?? `LinkedIn token error (${res.status})`);
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 60 * 86_400) * 1000),
    scope: data.scope ?? "",
  };
}

export function exchangeLinkedInCode(code: string, redirectUri: string): Promise<LinkedInTokens> {
  return tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
}

export function refreshLinkedInToken(refreshToken: string): Promise<LinkedInTokens> {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}

export async function getLinkedInUserInfo(accessToken: string): Promise<{
  id: string;
  name: string;
  avatar: string | null;
}> {
  const res = await fetch(`${API}/v2/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!data.sub) throw new Error(data.message ?? `LinkedIn userinfo error (${res.status})`);
  return { id: data.sub, name: data.name ?? "", avatar: data.picture ?? null };
}

// El formato "little text" de LinkedIn trata estos caracteres como sintaxis:
// sin escaparlos, un post con paréntesis o @ sale corrupto o es rechazado.
export function escapeLinkedInText(text: string): string {
  return text.replace(/[\\|{}@[\]()<>#*_~]/g, (c) => `\\${c}`);
}

export interface LinkedInUploadInstruction {
  uploadUrl: string;
  firstByte: number;
  lastByte: number;
}

export async function initializeLinkedInVideoUpload(
  accessToken: string,
  personId: string,
  fileSizeBytes: number
): Promise<{ videoUrn: string; instructions: LinkedInUploadInstruction[] }> {
  const res = await fetch(`${API}/rest/videos?action=initializeUpload`, {
    method: "POST",
    headers: {
      ...REST_HEADERS,
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: `urn:li:person:${personId}`,
        fileSizeBytes,
        uploadCaptions: false,
        uploadThumbnail: false,
      },
    }),
  });
  const data = await res.json();
  const value = data.value;
  if (!value?.video || !value?.uploadInstructions?.length) {
    throw new Error(data.message ?? `LinkedIn no aceptó la subida (${res.status})`);
  }
  return {
    videoUrn: value.video,
    instructions: value.uploadInstructions.map(
      (i: { uploadUrl: string; firstByte: number; lastByte: number }) => ({
        uploadUrl: i.uploadUrl,
        firstByte: i.firstByte,
        lastByte: i.lastByte,
      })
    ),
  };
}

// Reenvía cada parte del bucket a su uploadUrl y devuelve los ETags en orden
// (finalizeUpload los exige como uploadedPartIds).
export async function uploadLinkedInVideoFromUrl(
  accessToken: string,
  instructions: LinkedInUploadInstruction[],
  sourceUrl: string
): Promise<string[]> {
  const etags: string[] = [];
  for (const part of instructions) {
    const source = await fetch(sourceUrl, {
      headers: { Range: `bytes=${part.firstByte}-${part.lastByte}` },
    });
    if (!source.ok) {
      throw new Error(`No se pudo leer el vídeo del almacenamiento (${source.status})`);
    }
    const body = await source.arrayBuffer();

    const upload = await fetch(part.uploadUrl, {
      method: "PUT",
      headers: {
        ...REST_HEADERS,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/octet-stream",
      },
      body,
    });
    if (!upload.ok) {
      const text = await upload.text().catch(() => "");
      throw new Error(`LinkedIn rechazó una parte del vídeo (${upload.status}): ${text.slice(0, 200)}`);
    }
    const etag = upload.headers.get("etag");
    if (!etag) throw new Error("LinkedIn no devolvió ETag para una parte del vídeo.");
    etags.push(etag);
  }
  return etags;
}

export async function finalizeLinkedInVideoUpload(
  accessToken: string,
  videoUrn: string,
  etags: string[]
): Promise<void> {
  const res = await fetch(`${API}/rest/videos?action=finalizeUpload`, {
    method: "POST",
    headers: {
      ...REST_HEADERS,
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      finalizeUploadRequest: { video: videoUrn, uploadToken: "", uploadedPartIds: etags },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LinkedIn no pudo finalizar la subida (${res.status}): ${text.slice(0, 200)}`);
  }
}

// Imágenes: initializeUpload devuelve una única uploadUrl; un PUT y listo
// (sin partes, sin ETags, sin finalize — a diferencia del vídeo).
export async function initializeLinkedInImageUpload(
  accessToken: string,
  personId: string
): Promise<{ imageUrn: string; uploadUrl: string }> {
  const res = await fetch(`${API}/rest/images?action=initializeUpload`, {
    method: "POST",
    headers: {
      ...REST_HEADERS,
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      initializeUploadRequest: { owner: `urn:li:person:${personId}` },
    }),
  });
  const data = await res.json();
  const value = data.value;
  if (!value?.image || !value?.uploadUrl) {
    throw new Error(data.message ?? `LinkedIn no aceptó la subida de la imagen (${res.status})`);
  }
  return { imageUrn: value.image, uploadUrl: value.uploadUrl };
}

export async function uploadLinkedInImageFromUrl(
  accessToken: string,
  uploadUrl: string,
  sourceUrl: string
): Promise<void> {
  const source = await fetch(sourceUrl);
  if (!source.ok) throw new Error(`No se pudo leer la imagen del almacenamiento (${source.status})`);
  const body = await source.arrayBuffer();

  const upload = await fetch(uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/octet-stream" },
    body,
  });
  if (!upload.ok) {
    const text = await upload.text().catch(() => "");
    throw new Error(`LinkedIn rechazó la imagen (${upload.status}): ${text.slice(0, 200)}`);
  }
}

export type LinkedInVideoStatus = "AVAILABLE" | "PROCESSING" | "PROCESSING_FAILED" | "UNKNOWN";

export async function getLinkedInVideoStatus(
  accessToken: string,
  videoUrn: string
): Promise<{ status: LinkedInVideoStatus; failureReason: string | null }> {
  const res = await fetch(`${API}/rest/videos/${encodeURIComponent(videoUrn)}`, {
    headers: {
      ...REST_HEADERS,
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  // Algunos tokens de miembro no pueden leer rest/videos: tratarlo como
  // "aún procesando" y dejar que el post lo intente el llamador más tarde.
  if (!res.ok) return { status: "UNKNOWN", failureReason: null };
  const data = await res.json();
  if (data.status === "AVAILABLE") return { status: "AVAILABLE", failureReason: null };
  if (data.status === "PROCESSING_FAILED") {
    return { status: "PROCESSING_FAILED", failureReason: data.processingFailureReason ?? null };
  }
  return { status: "PROCESSING", failureReason: null };
}

// Post con media (vídeo o imagen). El title solo aplica a vídeo.
export async function createLinkedInMediaPost(opts: {
  accessToken: string;
  personId: string;
  text: string;
  mediaUrn: string;
  mediaTitle?: string;
}): Promise<string> {
  const res = await fetch(`${API}/rest/posts`, {
    method: "POST",
    headers: {
      ...REST_HEADERS,
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.accessToken}`,
    },
    body: JSON.stringify({
      author: `urn:li:person:${opts.personId}`,
      commentary: escapeLinkedInText(opts.text),
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      content: {
        media: {
          id: opts.mediaUrn,
          ...(opts.mediaTitle ? { title: opts.mediaTitle.slice(0, 100) } : {}),
        },
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });
  const postUrn = res.headers.get("x-restli-id");
  if (!res.ok || !postUrn) {
    const text = await res.text().catch(() => "");
    throw new Error(`LinkedIn rechazó el post (${res.status}): ${text.slice(0, 200)}`);
  }
  return postUrn;
}

export function linkedinPostPermalink(postUrn: string): string {
  return `https://www.linkedin.com/feed/update/${postUrn}`;
}
