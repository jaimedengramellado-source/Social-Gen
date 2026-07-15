// Facebook (páginas) vía Meta Graph API — misma app de Meta que Instagram
// (META_APP_ID/SECRET). El vídeo se publica en UNA llamada con file_url (Facebook
// lo descarga él; esto sí funciona aquí, a diferencia de TikTok). Se guarda el
// token DE PÁGINA, que no caduca — sin refresh; si Meta lo invalida, reconectar.

const GRAPH = "https://graph.facebook.com/v21.0";

export const FACEBOOK_SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "read_insights", // visitas del vídeo (reglas de publicación cruzada)
  "business_management",
];

// Facebook admite hasta 63.206 caracteres; 5.000 es un tope práctico para la UI
export const FACEBOOK_MAX_TEXT = 5000;

export interface FbPageCandidate {
  pageId: string;
  name: string;
  username: string | null;
  avatar: string | null;
  pageAccessToken: string;
}

export function facebookAuthUrl(redirectUri: string, state: string): string {
  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", process.env.META_APP_ID!);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", FACEBOOK_SCOPES.join(","));
  return url.toString();
}

async function graphFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${GRAPH}${path}`, init);
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message ?? `Meta Graph error (${res.status})`);
  }
  return data as T;
}

// code → token corto → token largo de usuario (~60 días; solo se usa para
// listar páginas y para revocar — el que publica es el token de página)
export async function exchangeFacebookCode(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  const short = await graphFetch<{ access_token: string }>(
    `/oauth/access_token?client_id=${process.env.META_APP_ID}` +
      `&client_secret=${process.env.META_APP_SECRET}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&code=${encodeURIComponent(code)}`
  );
  const long = await graphFetch<{ access_token: string; expires_in?: number }>(
    `/oauth/access_token?grant_type=fb_exchange_token` +
      `&client_id=${process.env.META_APP_ID}` +
      `&client_secret=${process.env.META_APP_SECRET}` +
      `&fb_exchange_token=${encodeURIComponent(short.access_token)}`
  );
  return {
    accessToken: long.access_token,
    expiresAt: new Date(Date.now() + (long.expires_in ?? 60 * 86_400) * 1000),
  };
}

// Páginas administradas por el usuario, con su token de página (no caduca)
export async function listFacebookPages(userToken: string): Promise<FbPageCandidate[]> {
  const data = await graphFetch<{
    data: Array<{
      id: string;
      name: string;
      username?: string;
      access_token: string;
      picture?: { data?: { url?: string } };
    }>;
  }>(
    `/me/accounts?fields=id,name,username,access_token,picture.type(large)` +
      `&limit=100&access_token=${encodeURIComponent(userToken)}`
  );

  return (data.data ?? [])
    .filter((p) => p.access_token)
    .map((p) => ({
      pageId: p.id,
      name: p.name,
      username: p.username ?? null,
      avatar: p.picture?.data?.url ?? null,
      pageAccessToken: p.access_token,
    }));
}

export async function publishFacebookVideo(opts: {
  pageId: string;
  pageAccessToken: string;
  videoUrl: string;
  description: string;
}): Promise<{ videoId: string; permalink: string }> {
  const data = await graphFetch<{ id: string }>(
    `/${opts.pageId}/videos?access_token=${encodeURIComponent(opts.pageAccessToken)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_url: opts.videoUrl,
        description: opts.description,
        published: true,
      }),
    }
  );
  return { videoId: data.id, permalink: `https://www.facebook.com/reel/${data.id}` };
}

// Foto de página, también en una llamada: Facebook descarga la imagen de la URL
export async function publishFacebookPhoto(opts: {
  pageId: string;
  pageAccessToken: string;
  imageUrl: string;
  caption: string;
}): Promise<{ photoId: string; permalink: string }> {
  const data = await graphFetch<{ id: string; post_id?: string }>(
    `/${opts.pageId}/photos?access_token=${encodeURIComponent(opts.pageAccessToken)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: opts.imageUrl,
        message: opts.caption,
        published: true,
      }),
    }
  );
  return {
    photoId: data.id,
    permalink: `https://www.facebook.com/${data.post_id ?? data.id}`,
  };
}

// Visitas de un vídeo de página. Requiere read_insights; null si no hay permiso.
export async function getFacebookVideoViews(
  videoId: string,
  pageAccessToken: string
): Promise<number | null> {
  try {
    const data = await graphFetch<{
      data?: Array<{ name: string; values?: Array<{ value?: number }> }>;
    }>(
      `/${videoId}/video_insights/total_video_views?access_token=${encodeURIComponent(pageAccessToken)}`
    );
    const views = data.data?.[0]?.values?.[0]?.value;
    return typeof views === "number" ? views : null;
  } catch {
    return null;
  }
}

export async function revokeFacebookAccess(userToken: string): Promise<void> {
  await fetch(`${GRAPH}/me/permissions?access_token=${encodeURIComponent(userToken)}`, {
    method: "DELETE",
  }).catch(() => {});
}
