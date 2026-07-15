// Threads API (Meta). Mismo modelo de contenedores que Instagram: crear
// contenedor con la URL del vídeo → poll de status → threads_publish.
// Token largo de ~60 días renovable con th_refresh_token (si tiene >24h de vida).

const GRAPH = "https://graph.threads.net";

// threads_manage_insights: leer visitas del post (reglas de publicación cruzada)
export const THREADS_SCOPES = ["threads_basic", "threads_content_publish", "threads_manage_insights"];

export const THREADS_MAX_TEXT = 500;

export function threadsAuthUrl(redirectUri: string, state: string): string {
  const url = new URL("https://threads.net/oauth/authorize");
  url.searchParams.set("client_id", process.env.THREADS_APP_ID!);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", THREADS_SCOPES.join(","));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  return url.toString();
}

async function graphFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${GRAPH}${path}`, init);
  const data = await res.json();
  if (data.error) {
    throw new Error(
      data.error.message ?? data.error_message ?? `Threads error (${res.status})`
    );
  }
  return data as T;
}

// code → token corto → token largo (~60 días)
export async function exchangeThreadsCode(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; expiresAt: Date; userId: string }> {
  const short = await graphFetch<{ access_token: string; user_id: string | number }>(
    `/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.THREADS_APP_ID!,
        client_secret: process.env.THREADS_APP_SECRET!,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      }),
    }
  );

  const long = await graphFetch<{ access_token: string; expires_in?: number }>(
    `/access_token?grant_type=th_exchange_token` +
      `&client_secret=${process.env.THREADS_APP_SECRET}` +
      `&access_token=${encodeURIComponent(short.access_token)}`
  );

  return {
    accessToken: long.access_token,
    expiresAt: new Date(Date.now() + (long.expires_in ?? 60 * 86_400) * 1000),
    userId: String(short.user_id),
  };
}

export async function refreshThreadsToken(
  accessToken: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  const data = await graphFetch<{ access_token: string; expires_in?: number }>(
    `/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(accessToken)}`
  );
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 60 * 86_400) * 1000),
  };
}

export async function getThreadsUserInfo(accessToken: string): Promise<{
  id: string;
  username: string;
  avatar: string | null;
}> {
  const data = await graphFetch<{
    id: string;
    username: string;
    threads_profile_picture_url?: string;
  }>(
    `/v1.0/me?fields=id,username,threads_profile_picture_url&access_token=${encodeURIComponent(accessToken)}`
  );
  return {
    id: data.id,
    username: data.username,
    avatar: data.threads_profile_picture_url ?? null,
  };
}

export async function createThreadsVideoContainer(opts: {
  userId: string;
  accessToken: string;
  videoUrl: string;
  text: string;
}): Promise<string> {
  const params = new URLSearchParams({
    media_type: "VIDEO",
    video_url: opts.videoUrl,
    text: opts.text,
    access_token: opts.accessToken,
  });
  const data = await graphFetch<{ id: string }>(`/v1.0/${opts.userId}/threads?${params}`, {
    method: "POST",
  });
  return data.id;
}

export async function createThreadsImageContainer(opts: {
  userId: string;
  accessToken: string;
  imageUrl: string;
  text: string;
}): Promise<string> {
  const params = new URLSearchParams({
    media_type: "IMAGE",
    image_url: opts.imageUrl,
    text: opts.text,
    access_token: opts.accessToken,
  });
  const data = await graphFetch<{ id: string }>(`/v1.0/${opts.userId}/threads?${params}`, {
    method: "POST",
  });
  return data.id;
}

export type ThreadsContainerStatus = "FINISHED" | "IN_PROGRESS" | "ERROR" | "EXPIRED" | "PUBLISHED";

export async function getThreadsContainerStatus(
  containerId: string,
  accessToken: string
): Promise<{ status: ThreadsContainerStatus; errorMessage: string | null }> {
  const data = await graphFetch<{ status: ThreadsContainerStatus; error_message?: string }>(
    `/v1.0/${containerId}?fields=status,error_message&access_token=${encodeURIComponent(accessToken)}`
  );
  return { status: data.status, errorMessage: data.error_message ?? null };
}

export async function publishThreadsContainer(opts: {
  userId: string;
  containerId: string;
  accessToken: string;
}): Promise<string> {
  const data = await graphFetch<{ id: string }>(
    `/v1.0/${opts.userId}/threads_publish?creation_id=${opts.containerId}` +
      `&access_token=${encodeURIComponent(opts.accessToken)}`,
    { method: "POST" }
  );
  return data.id;
}

// Visitas de un post publicado. Requiere threads_manage_insights; null sin permiso.
export async function getThreadsViews(
  threadId: string,
  accessToken: string
): Promise<number | null> {
  try {
    const data = await graphFetch<{
      data?: Array<{
        name: string;
        values?: Array<{ value?: number }>;
        total_value?: { value?: number };
      }>;
    }>(
      `/v1.0/${threadId}/insights?metric=views&access_token=${encodeURIComponent(accessToken)}`
    );
    const metric = data.data?.find((m) => m.name === "views");
    const views = metric?.total_value?.value ?? metric?.values?.[0]?.value;
    return typeof views === "number" ? views : null;
  } catch {
    return null;
  }
}

export async function getThreadsPermalink(
  threadId: string,
  accessToken: string
): Promise<string | null> {
  try {
    const data = await graphFetch<{ permalink?: string }>(
      `/v1.0/${threadId}?fields=permalink&access_token=${encodeURIComponent(accessToken)}`
    );
    return data.permalink ?? null;
  } catch {
    return null;
  }
}
