const BASE = "https://www.googleapis.com/youtube/v3";

function key() {
  const k = process.env.YOUTUBE_API_KEY;
  if (!k) throw new Error("YOUTUBE_API_KEY not set");
  return k;
}

export interface YTChannel {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  subscribers: number;
  totalViews: number;
  videoCount: number;
  customUrl?: string;
  country?: string;
}

export interface YTVideo {
  id: string;
  title: string;
  thumbnail: string;
  views: number;
  likes: number;
  comments: number;
  publishedAt: string;
  duration: string;
  durationSecs: number;
  description: string;
  channelId?: string;
  channelName?: string;
  tags?: string[];
  categoryId?: string;
  madeForKids?: boolean;
}

export function parseDuration(iso: string): { label: string; secs: number } {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  const h = parseInt(m?.[1] ?? "0") || 0;
  const min = parseInt(m?.[2] ?? "0") || 0;
  const sec = parseInt(m?.[3] ?? "0") || 0;
  const secs = h * 3600 + min * 60 + sec;
  const label = h > 0
    ? `${h}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${min}:${String(sec).padStart(2, "0")}`;
  return { label, secs };
}

export function formatCount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

// Generates an estimated view-growth curve for the chart
export function estimateViewEvolution(totalViews: number, publishedAt: string): { label: string; views: number }[] {
  const daysSince = Math.max(1, Math.floor((Date.now() - new Date(publishedAt).getTime()) / 86400000));

  const allPoints = [
    { label: "Día 1", pct: 0.20 },
    { label: "Día 2", pct: 0.13 },
    { label: "Día 3", pct: 0.08 },
    { label: "Día 5", pct: 0.06 },
    { label: "Sem 2", pct: 0.12 },
    { label: "Mes 1", pct: 0.10 },
    { label: "Mes 3", pct: 0.14 },
    { label: "Hoy",   pct: 0.17 },
  ];

  const cap = daysSince < 2 ? 1 : daysSince < 3 ? 2 : daysSince < 5 ? 3 : daysSince < 7 ? 4 : daysSince < 14 ? 5 : daysSince < 30 ? 6 : daysSince < 90 ? 7 : 8;
  const points = allPoints.slice(0, cap);

  const totalPct = points.reduce((s, p) => s + p.pct, 0);
  return points.map(p => ({
    label: p.label,
    views: Math.round(totalViews * (p.pct / totalPct)),
  }));
}

type RawVideoItem = {
  id: string;
  snippet: {
    title: string;
    thumbnails: {
      maxres?: { url: string };
      standard?: { url: string };
      high?: { url: string };
      medium?: { url: string };
      default?: { url: string };
    };
    publishedAt: string;
    description: string;
    channelId: string;
    channelTitle: string;
    tags?: string[];
    categoryId?: string;
  };
  statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
  contentDetails: { duration: string };
  status?: { madeForKids?: boolean };
};

function parseVideoItems(items: RawVideoItem[]): YTVideo[] {
  return items.map(v => {
    const { label, secs } = parseDuration(v.contentDetails.duration);
    // Prefer API-provided URL; fall back to constructed URL (always valid for public videos)
    const thumbnail =
      v.snippet.thumbnails.maxres?.url ??
      v.snippet.thumbnails.high?.url ??
      v.snippet.thumbnails.medium?.url ??
      `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`;
    return {
      id: v.id,
      title: v.snippet.title,
      thumbnail,
      views: parseInt(v.statistics.viewCount ?? "0"),
      likes: parseInt(v.statistics.likeCount ?? "0"),
      comments: parseInt(v.statistics.commentCount ?? "0"),
      publishedAt: v.snippet.publishedAt,
      duration: label,
      durationSecs: secs,
      description: v.snippet.description ?? "",
      channelId: v.snippet.channelId,
      channelName: v.snippet.channelTitle,
      tags: v.snippet.tags ?? [],
      categoryId: v.snippet.categoryId,
      madeForKids: v.status?.madeForKids ?? false,
    };
  });
}

export async function searchChannels(q: string, nicho?: string): Promise<YTChannel[]> {
  const query = nicho ? `${q} ${nicho}` : q;
  const searchUrl = `${BASE}/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=20&key=${key()}`;
  const searchRes = await fetch(searchUrl, { next: { revalidate: 300 } });
  if (!searchRes.ok) throw new Error("YouTube search failed");
  const searchData = await searchRes.json();

  if (!searchData.items?.length) return [];

  const ids = searchData.items
    .map((i: { snippet: { channelId: string } }) => i.snippet.channelId)
    .join(",");

  const statsUrl = `${BASE}/channels?part=snippet,statistics&id=${ids}&key=${key()}`;
  const statsRes = await fetch(statsUrl, { next: { revalidate: 300 } });
  const statsData = await statsRes.json();

  return (statsData.items ?? []).map((c: {
    id: string;
    snippet: { title: string; description: string; thumbnails: { high?: { url: string }; medium?: { url: string } }; customUrl?: string; country?: string };
    statistics: { subscriberCount?: string; viewCount?: string; videoCount?: string };
  }) => ({
    id: c.id,
    name: c.snippet.title,
    description: c.snippet.description,
    thumbnail: c.snippet.thumbnails.high?.url ?? c.snippet.thumbnails.medium?.url ?? "",
    subscribers: parseInt(c.statistics.subscriberCount ?? "0"),
    totalViews: parseInt(c.statistics.viewCount ?? "0"),
    videoCount: parseInt(c.statistics.videoCount ?? "0"),
    customUrl: c.snippet.customUrl,
    country: c.snippet.country,
  })) as YTChannel[];
}

export async function getChannel(channelId: string): Promise<{ channel: YTChannel; videos: YTVideo[] } | null> {
  const [chanRes, vidSearchRes] = await Promise.all([
    fetch(`${BASE}/channels?part=snippet,statistics,brandingSettings&id=${channelId}&key=${key()}`, { next: { revalidate: 60 } }),
    fetch(`${BASE}/search?part=snippet&channelId=${channelId}&type=video&order=viewCount&maxResults=25&key=${key()}`, { next: { revalidate: 60 } }),
  ]);

  if (!chanRes.ok) return null;
  const chanData = await chanRes.json();
  const chanItem = chanData.items?.[0];
  if (!chanItem) return null;

  const channel: YTChannel = {
    id: chanItem.id,
    name: chanItem.snippet.title,
    description: chanItem.snippet.description,
    thumbnail: chanItem.snippet.thumbnails.high?.url ?? chanItem.snippet.thumbnails.medium?.url ?? "",
    subscribers: parseInt(chanItem.statistics.subscriberCount ?? "0"),
    totalViews: parseInt(chanItem.statistics.viewCount ?? "0"),
    videoCount: parseInt(chanItem.statistics.videoCount ?? "0"),
    customUrl: chanItem.snippet.customUrl,
    country: chanItem.snippet.country,
  };

  const vidSearchData = await vidSearchRes.json();
  if (!vidSearchData.items?.length) return { channel, videos: [] };

  const videoIds = vidSearchData.items
    .map((v: { id: { videoId: string } }) => v.id.videoId)
    .filter(Boolean)
    .join(",");

  const vidStatsRes = await fetch(`${BASE}/videos?part=snippet,statistics,contentDetails,status&id=${videoIds}&key=${key()}`, { next: { revalidate: 60 } });
  const vidStatsData = await vidStatsRes.json();

  return { channel, videos: parseVideoItems(vidStatsData.items ?? []) };
}

const PERIOD_DAYS: Record<string, number> = {
  "24h": 1, "week": 7, "month": 30, "3months": 90, "year": 365,
};

// The YouTube search API requires a non-empty `q` when using order=viewCount+publishedAfter.
// Without `q` the API returns 0 results — this is a documented quirk.
// We use the broadest possible query per language: a single very-common word that
// appears in virtually every video's title, description, or tags.
const REGION_BROAD_Q: Record<string, string> = {
  JP: "動画",     // "video" in Japanese
  KR: "영상",     // "video" in Korean
  CN: "视频",     // "video" in Chinese
  // All other regions (Latin-script): "a" appears in nearly every title/description
};

function broadQuery(regionCode: string): string {
  return REGION_BROAD_Q[regionCode] ?? "a";
}

// ── search.list helper (100 quota units / call) ────────────────────────────

async function searchAndFetch(params: URLSearchParams): Promise<YTVideo[]> {
  const res = await fetch(`${BASE}/search?${params}`, { next: { revalidate: 900 } });
  if (!res.ok) return [];
  const data = await res.json();
  if (!data.items?.length) return [];

  const ids = (data.items as { id: { videoId?: string } }[])
    .map(i => i.id.videoId).filter(Boolean).join(",");
  if (!ids) return [];

  const detailRes = await fetch(
    `${BASE}/videos?part=snippet,statistics,contentDetails,status&id=${ids}&key=${params.get("key")}`,
    { next: { revalidate: 900 } }
  );
  if (!detailRes.ok) return [];
  const detailData = await detailRes.json();
  return parseVideoItems(detailData.items ?? []);
}

// ── videos.list chart=mostPopular (1 quota unit / call — fallback only) ───

async function fetchMostPopular(regionCode: string): Promise<YTVideo[]> {
  const params = new URLSearchParams({
    part: "snippet,statistics,contentDetails,status",
    chart: "mostPopular",
    maxResults: "50",
    regionCode,
    key: key(),
  });
  const res = await fetch(`${BASE}/videos?${params}`, { next: { revalidate: 900 } });
  if (!res.ok) return [];
  const data = await res.json();
  return parseVideoItems(data.items ?? []);
}

const GLOBAL_FALLBACK_REGIONS = ["US", "MX", "BR"];

export async function getTrending({
  period = "24h",
  country = "GLOBAL",
  contentType = "all",
  excludeKids = true,
  excludeMusic = true,
}: {
  period?: string;
  country?: string;
  contentType?: "short" | "long" | "all";
  excludeKids?: boolean;
  excludeMusic?: boolean;
}): Promise<YTVideo[]> {
  const days = PERIOD_DAYS[period] ?? 1;
  const publishedAfter = new Date(Date.now() - days * 86400000).toISOString();
  const isGlobal = country === "GLOBAL";

  // ── Build search params ─────────────────────────────────────────────────
  // q is REQUIRED: without it, order=viewCount+publishedAfter returns nothing.
  // "shorts" gives best coverage for short content; broad language query for the rest.
  const buildParams = (regionCode?: string): URLSearchParams => {
    const q = contentType === "short" ? "shorts"
      : regionCode ? broadQuery(regionCode)
      : "a"; // global search: "a" covers all Latin-script content
    const p = new URLSearchParams({
      part: "snippet", type: "video", order: "viewCount",
      publishedAfter, maxResults: "50", q, key: key(),
    });
    if (regionCode) p.set("regionCode", regionCode);
    if (contentType === "short") p.set("videoDuration", "short");
    if (contentType === "long") p.set("videoDuration", "long");
    return p;
  };

  const merge = (lists: YTVideo[][]): YTVideo[] => {
    const seen = new Set<string>();
    const out: YTVideo[] = [];
    for (const list of lists)
      for (const v of list)
        if (!seen.has(v.id)) { seen.add(v.id); out.push(v); }
    return out;
  };

  let videos: YTVideo[];

  if (isGlobal) {
    // ── GLOBAL: search without regionCode (YouTube returns globally popular content)
    // Fallback: sample multiple regions with mostPopular
    const [searchResults, ...popularBatches] = await Promise.all([
      searchAndFetch(buildParams()).catch(() => []),
      ...GLOBAL_FALLBACK_REGIONS.map(r => fetchMostPopular(r).catch(() => [])),
    ]);
    videos = merge([searchResults, ...popularBatches]);
    videos.sort((a, b) => b.views - a.views);
  } else {
    // ── SPECIFIC COUNTRY: combine both sources in parallel ──────────────────
    // search?regionCode  → most viewed recently in the region (time-filtered)
    // chart=mostPopular&regionCode → genuine local trending (language-accurate)
    // Combining both gives the best coverage of country-specific + time-filtered content.
    const [searchResults, popularResults] = await Promise.all([
      searchAndFetch(buildParams(country)).catch(() => []),
      fetchMostPopular(country).catch(() => []),
    ]);

    // Prioritise search results (time-filtered), enrich with local trending
    videos = merge([searchResults, popularResults]);

    // Apply period filter on the merged set — soft: relax if < 5 results remain
    const cutoff = new Date(Date.now() - days * 86400000);
    const periodFiltered = videos.filter(v => new Date(v.publishedAt) >= cutoff);
    if (periodFiltered.length >= 5) videos = periodFiltered;

    videos.sort((a, b) => b.views - a.views);
  }

  // ── Apply content type and audience filters ─────────────────────────────
  if (contentType === "short") videos = videos.filter(v => v.durationSecs <= 180);
  if (contentType === "long") videos = videos.filter(v => v.durationSecs > 180);
  if (excludeKids) videos = videos.filter(v => !v.madeForKids);
  if (excludeMusic) videos = videos.filter(v => v.categoryId !== "10");

  return videos.slice(0, 30);
}

export async function getVideo(videoId: string): Promise<{
  video: YTVideo;
  channel: YTChannel | null;
  channelAvgViews: number;
  channelRecentVideos: YTVideo[];
} | null> {
  const videoRes = await fetch(
    `${BASE}/videos?part=snippet,statistics,contentDetails,status&id=${videoId}&key=${key()}`,
    { next: { revalidate: 300 } }
  );
  if (!videoRes.ok) return null;
  const videoData = await videoRes.json();
  const item = videoData.items?.[0];
  if (!item) return null;

  const [parsed] = parseVideoItems([item]);
  const video = parsed;

  // Parallel: channel info + channel's recent videos
  const [chanRes, vidSearchRes] = await Promise.all([
    fetch(`${BASE}/channels?part=snippet,statistics&id=${item.snippet.channelId}&key=${key()}`, { next: { revalidate: 300 } }),
    fetch(`${BASE}/search?part=snippet&channelId=${item.snippet.channelId}&type=video&order=viewCount&maxResults=12&key=${key()}`, { next: { revalidate: 300 } }),
  ]);

  const chanData = await chanRes.json();
  const chanItem = chanData.items?.[0];
  const channel: YTChannel | null = chanItem ? {
    id: chanItem.id,
    name: chanItem.snippet.title,
    description: chanItem.snippet.description,
    thumbnail: chanItem.snippet.thumbnails.high?.url ?? chanItem.snippet.thumbnails.medium?.url ?? "",
    subscribers: parseInt(chanItem.statistics.subscriberCount ?? "0"),
    totalViews: parseInt(chanItem.statistics.viewCount ?? "0"),
    videoCount: parseInt(chanItem.statistics.videoCount ?? "0"),
    customUrl: chanItem.snippet.customUrl,
    country: chanItem.snippet.country,
  } : null;

  // Fetch video details for channel comparison
  const vidSearchData = await vidSearchRes.json();
  let channelRecentVideos: YTVideo[] = [];
  let channelAvgViews = 0;

  if (vidSearchData.items?.length) {
    const ids = vidSearchData.items
      .map((v: { id: { videoId: string } }) => v.id.videoId)
      .filter(Boolean)
      .join(",");
    const detailRes = await fetch(`${BASE}/videos?part=snippet,statistics,contentDetails&id=${ids}&key=${key()}`, { next: { revalidate: 300 } });
    const detailData = await detailRes.json();
    channelRecentVideos = parseVideoItems(detailData.items ?? []);
    if (channelRecentVideos.length) {
      channelAvgViews = Math.round(channelRecentVideos.reduce((s, v) => s + v.views, 0) / channelRecentVideos.length);
    }
  }

  return { video, channel, channelAvgViews, channelRecentVideos };
}

export async function searchIdeasVideos(query: string): Promise<YTVideo[]> {
  const params = new URLSearchParams({
    part: "snippet", type: "video", order: "viewCount",
    q: query, maxResults: "20", key: key(),
  });
  return searchAndFetch(params);
}
