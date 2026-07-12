import { createClient } from "@/lib/supabase/server";

export interface YTConnectionToken {
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
}

export async function refreshAccessToken(
  conn: YTConnectionToken,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
  if (new Date(conn.expires_at) > new Date(Date.now() + 60_000)) return conn.access_token;
  if (!conn.refresh_token) throw new Error("NO_REFRESH_TOKEN");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: conn.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("REFRESH_FAILED");

  await supabase.from("youtube_connections").update({
    access_token: data.access_token,
    expires_at: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("user_id", conn.user_id);

  return data.access_token;
}

export type AnalyticsRow = Record<string, string | number>;

export interface AnalyticsQueryParams {
  token: string;
  startDate: string;
  endDate: string;
  metrics: string[];
  dimensions?: string[];
  filters?: Record<string, string>;
  sort?: string;
  maxResults?: number;
}

export interface AnalyticsResult {
  rows: AnalyticsRow[];
  error: { code?: number; message: string } | null;
}

// Wrapper around the YouTube Analytics API (reports.query). Metrics that don't
// exist for this endpoint (e.g. impressions/impressionClickThroughRate — those
// only exist via the batch YouTube Reporting API, see youtube-reach-sync cron)
// must never be passed here: the API 400s the WHOLE request, not just that metric.
export async function queryAnalytics({
  token, startDate, endDate, metrics, dimensions, filters, sort, maxResults,
}: AnalyticsQueryParams): Promise<AnalyticsResult> {
  const params = new URLSearchParams({
    ids: "channel==MINE",
    startDate,
    endDate,
    metrics: metrics.join(","),
  });
  if (dimensions?.length) params.set("dimensions", dimensions.join(","));
  if (filters) {
    const f = Object.entries(filters).map(([k, v]) => `${k}==${v}`).join(";");
    if (f) params.set("filters", f);
  }
  if (sort) params.set("sort", sort);
  if (maxResults) params.set("maxResults", String(maxResults));

  const res = await fetch(`https://youtubeanalytics.googleapis.com/v2/reports?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();

  if (data.error) return { rows: [], error: data.error };

  const headers: { name: string }[] = data.columnHeaders ?? [];
  const rawRows: (string | number)[][] = data.rows ?? [];
  const rows: AnalyticsRow[] = rawRows.map(row => {
    const obj: AnalyticsRow = {};
    headers.forEach((h, i) => { obj[h.name] = row[i]; });
    return obj;
  });
  return { rows, error: null };
}

export function num(row: AnalyticsRow | undefined, key: string): number {
  if (!row) return 0;
  return Number(row[key] ?? 0);
}
export function str(row: AnalyticsRow | undefined, key: string): string {
  if (!row) return "";
  return String(row[key] ?? "");
}

// Returns every video ID in the channel's uploads playlist (not just ones with
// activity in a given date range) so the Content tab can list the full catalog,
// matching what YouTube Studio shows regardless of the selected period.
export async function getAllUploadedVideoIds(token: string, maxVideos = 150): Promise<string[]> {
  const chanRes = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true",
    { headers: { Authorization: `Bearer ${token}` } }
  ).then(r => r.json());
  const uploadsPlaylistId = chanRes.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) return [];

  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ part: "contentDetails", playlistId: uploadsPlaylistId, maxResults: "50" });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).then(r => r.json());
    for (const item of res.items ?? []) {
      const vid = item.contentDetails?.videoId;
      if (vid) ids.push(vid);
    }
    pageToken = res.nextPageToken;
  } while (pageToken && ids.length < maxVideos);

  return ids.slice(0, maxVideos);
}

// videos.list only accepts up to 50 IDs per call.
export async function fetchVideoDetailsBatched(
  token: string,
  videoIds: string[]
): Promise<Record<string, { snippet: Record<string, unknown>; contentDetails: Record<string, unknown> }>> {
  const result: Record<string, { snippet: Record<string, unknown>; contentDetails: Record<string, unknown> }> = {};
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${batch.join(",")}&part=snippet,contentDetails`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).then(r => r.json());
    for (const item of res.items ?? []) result[item.id] = item;
  }
  return result;
}

export interface ReachStat { impressions: number; ctr: number }

// Reads cached reach stats (video_thumbnail_impressions / ctr) written by the
// youtube-reach-sync cron. This data always lags ~48h behind live — it is never
// fetched from the live Analytics API because that endpoint doesn't expose it.
export async function getReachStatsByVideo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  videoIds: string[],
  startDate: string,
  endDate: string
): Promise<Record<string, ReachStat>> {
  if (videoIds.length === 0) return {};
  const { data } = await supabase
    .from("youtube_reach_stats")
    .select("video_id, impressions, ctr")
    .eq("user_id", userId)
    .in("video_id", videoIds)
    .gte("date", startDate)
    .lte("date", endDate);

  const acc: Record<string, { impressions: number; weightedCtr: number }> = {};
  for (const row of data ?? []) {
    const id = row.video_id as string;
    const impressions = Number(row.impressions ?? 0);
    const ctr = Number(row.ctr ?? 0);
    if (!acc[id]) acc[id] = { impressions: 0, weightedCtr: 0 };
    acc[id].impressions += impressions;
    acc[id].weightedCtr += impressions * ctr;
  }
  const result: Record<string, ReachStat> = {};
  for (const [id, v] of Object.entries(acc)) {
    result[id] = { impressions: v.impressions, ctr: v.impressions > 0 ? v.weightedCtr / v.impressions : 0 };
  }
  return result;
}

export async function getReachStatsDaily(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  videoId: string,
  startDate: string,
  endDate: string
): Promise<{ date: string; impressions: number; ctr: number }[]> {
  const { data } = await supabase
    .from("youtube_reach_stats")
    .select("date, impressions, ctr")
    .eq("user_id", userId)
    .eq("video_id", videoId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });

  return (data ?? []).map(r => ({
    date: String(r.date),
    impressions: Number(r.impressions ?? 0),
    ctr: Number(r.ctr ?? 0),
  }));
}
