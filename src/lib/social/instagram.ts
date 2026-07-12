// Instagram Graph API (cuentas business/creator vía Facebook Login for Business).
// Publicación por contenedores: crear contenedor con la URL del vídeo → esperar
// a que Meta lo procese (status_code) → media_publish. No hay publishAt nativo:
// la programación la hace nuestro cron publish-scheduled.

const GRAPH = "https://graph.facebook.com/v21.0";

export const INSTAGRAM_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
];

export interface IgAccountCandidate {
  igId: string;
  username: string;
  avatar: string | null;
  pageId: string;
  pageName: string;
}

export function instagramAuthUrl(redirectUri: string, state: string): string {
  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", process.env.META_APP_ID!);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", INSTAGRAM_SCOPES.join(","));
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

// code → token corto → token largo (~60 días)
export async function exchangeInstagramCode(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  const short = await graphFetch<{ access_token: string }>(
    `/oauth/access_token?client_id=${process.env.META_APP_ID}` +
      `&client_secret=${process.env.META_APP_SECRET}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&code=${encodeURIComponent(code)}`
  );
  return extendInstagramToken(short.access_token);
}

// También sirve para renovar: un token largo aún válido se puede volver a extender.
export async function extendInstagramToken(
  token: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  const long = await graphFetch<{ access_token: string; expires_in?: number }>(
    `/oauth/access_token?grant_type=fb_exchange_token` +
      `&client_id=${process.env.META_APP_ID}` +
      `&client_secret=${process.env.META_APP_SECRET}` +
      `&fb_exchange_token=${encodeURIComponent(token)}`
  );
  return {
    accessToken: long.access_token,
    expiresAt: new Date(Date.now() + (long.expires_in ?? 60 * 86_400) * 1000),
  };
}

// Páginas del usuario con cuenta de Instagram business/creator vinculada
export async function listInstagramAccounts(accessToken: string): Promise<IgAccountCandidate[]> {
  const data = await graphFetch<{
    data: Array<{
      id: string;
      name: string;
      instagram_business_account?: { id: string; username?: string; profile_picture_url?: string };
    }>;
  }>(
    `/me/accounts?fields=id,name,instagram_business_account{id,username,profile_picture_url}` +
      `&limit=100&access_token=${encodeURIComponent(accessToken)}`
  );

  return (data.data ?? [])
    .filter((p) => p.instagram_business_account?.id)
    .map((p) => ({
      igId: p.instagram_business_account!.id,
      username: p.instagram_business_account!.username ?? p.name,
      avatar: p.instagram_business_account!.profile_picture_url ?? null,
      pageId: p.id,
      pageName: p.name,
    }));
}

export async function revokeInstagramAccess(accessToken: string): Promise<void> {
  await fetch(`${GRAPH}/me/permissions?access_token=${encodeURIComponent(accessToken)}`, {
    method: "DELETE",
  }).catch(() => {});
}

export async function createReelContainer(opts: {
  igId: string;
  accessToken: string;
  videoUrl: string;
  caption: string;
}): Promise<string> {
  const params = new URLSearchParams({
    media_type: "REELS",
    video_url: opts.videoUrl,
    caption: opts.caption,
    access_token: opts.accessToken,
  });
  const data = await graphFetch<{ id: string }>(`/${opts.igId}/media?${params}`, { method: "POST" });
  return data.id;
}

export type ContainerStatus = "FINISHED" | "IN_PROGRESS" | "ERROR" | "EXPIRED" | "PUBLISHED";

export async function getContainerStatus(
  containerId: string,
  accessToken: string
): Promise<ContainerStatus> {
  const data = await graphFetch<{ status_code: ContainerStatus }>(
    `/${containerId}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`
  );
  return data.status_code;
}

export async function publishContainer(opts: {
  igId: string;
  containerId: string;
  accessToken: string;
}): Promise<string> {
  const data = await graphFetch<{ id: string }>(
    `/${opts.igId}/media_publish?creation_id=${opts.containerId}` +
      `&access_token=${encodeURIComponent(opts.accessToken)}`,
    { method: "POST" }
  );
  return data.id;
}

export async function getMediaPermalink(mediaId: string, accessToken: string): Promise<string | null> {
  try {
    const data = await graphFetch<{ permalink?: string }>(
      `/${mediaId}?fields=permalink&access_token=${encodeURIComponent(accessToken)}`
    );
    return data.permalink ?? null;
  } catch {
    return null;
  }
}
