import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { refreshAccessToken, queryAnalytics, num, str, getReachStatsDaily } from "@/lib/youtube-analytics";

const PERIOD_DAYS: Record<string, number> = { "7": 7, "28": 28, "90": 90, "365": 365 };

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id: videoId } = await params;
  const periodParam = request.nextUrl.searchParams.get("period") ?? "28";
  const days = PERIOD_DAYS[periodParam] ?? 28;
  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - days * 86_400_000).toISOString().split("T")[0];

  const { data: conn } = await supabase.from("youtube_connections").select("*").eq("user_id", user.id).single();
  if (!conn) return NextResponse.json({ error: "NOT_CONNECTED" }, { status: 404 });

  let token: string;
  try { token = await refreshAccessToken(conn, supabase); }
  catch { return NextResponse.json({ error: "TOKEN_ERROR" }, { status: 401 }); }

  const filters = { video: videoId };

  const [overview, dailyResult, sourcesResult, playbackResult, deviceResult, detailRes, reachDaily, retentionResult] = await Promise.all([
    queryAnalytics({ token, startDate, endDate, filters, metrics: ["views", "estimatedMinutesWatched", "averageViewDuration", "averageViewPercentage", "subscribersGained", "likes", "comments", "shares"] }),
    queryAnalytics({ token, startDate, endDate, filters, metrics: ["views", "estimatedMinutesWatched"], dimensions: ["day"], sort: "day" }),
    queryAnalytics({ token, startDate, endDate, filters, metrics: ["views"], dimensions: ["insightTrafficSourceType"], sort: "-views" }),
    queryAnalytics({ token, startDate, endDate, filters, metrics: ["views"], dimensions: ["insightPlaybackLocationType"], sort: "-views" }),
    queryAnalytics({ token, startDate, endDate, filters, metrics: ["views"], dimensions: ["deviceType"], sort: "-views" }),
    fetch(`https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails,statistics`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    getReachStatsDaily(supabase, user.id, videoId, startDate, endDate),
    queryAnalytics({ token, startDate, endDate, filters, metrics: ["audienceWatchRatio", "relativeRetentionPerformance"], dimensions: ["elapsedVideoTimeRatio"], sort: "elapsedVideoTimeRatio" }),
  ]);

  const ovRow = overview.rows[0];

  const daily = dailyResult.rows.map(row => ({
    date: str(row, "day"),
    views: num(row, "views"),
    watchMinutes: num(row, "estimatedMinutesWatched"),
  }));

  const totalSourceViews = sourcesResult.rows.reduce((s, r) => s + num(r, "views"), 0);
  const trafficSources = sourcesResult.rows.map(row => ({
    source: str(row, "insightTrafficSourceType"),
    views: num(row, "views"),
    pct: totalSourceViews > 0 ? Math.round(num(row, "views") / totalSourceViews * 100) : 0,
  }));

  const totalPlaybackViews = playbackResult.rows.reduce((s, r) => s + num(r, "views"), 0);
  const playbackLocations = playbackResult.rows.map(row => ({
    location: str(row, "insightPlaybackLocationType"),
    views: num(row, "views"),
    pct: totalPlaybackViews > 0 ? Math.round(num(row, "views") / totalPlaybackViews * 100) : 0,
  }));

  const totalDeviceViews = deviceResult.rows.reduce((s, r) => s + num(r, "views"), 0);
  const devices = deviceResult.rows.map(row => ({
    device: str(row, "deviceType"),
    views: num(row, "views"),
    pct: totalDeviceViews > 0 ? Math.round(num(row, "views") / totalDeviceViews * 100) : 0,
  }));

  const totalImpressions = reachDaily.reduce((s, r) => s + r.impressions, 0);
  const weightedCtr = reachDaily.reduce((s, r) => s + r.impressions * r.ctr, 0);

  const retention = retentionResult.rows.map(row => ({
    elapsed: num(row, "elapsedVideoTimeRatio"),
    audienceWatchRatio: num(row, "audienceWatchRatio"),
    relativeRetentionPerformance: num(row, "relativeRetentionPerformance"),
  }));

  const item = detailRes.items?.[0];
  const snippet = item?.snippet ?? {};
  const thumbnails = snippet.thumbnails ?? {};

  return NextResponse.json({
    video: {
      id: videoId,
      title: snippet.title ?? videoId,
      thumbnail: thumbnails.maxres?.url ?? thumbnails.medium?.url ?? thumbnails.default?.url ?? null,
      publishedAt: snippet.publishedAt ?? null,
      description: snippet.description ?? "",
    },
    metrics: {
      views: num(ovRow, "views"),
      watchTimeHours: Math.round(num(ovRow, "estimatedMinutesWatched") / 60 * 10) / 10,
      avgViewDuration: num(ovRow, "averageViewDuration"),
      avgViewPercentage: num(ovRow, "averageViewPercentage"),
      ctr: totalImpressions > 0 ? weightedCtr / totalImpressions : 0,
      impressions: totalImpressions,
      hasReachData: reachDaily.length > 0,
      likes: num(ovRow, "likes"),
      comments: num(ovRow, "comments"),
      shares: num(ovRow, "shares"),
      subscribersGained: num(ovRow, "subscribersGained"),
    },
    daily,
    reachDaily,
    trafficSources,
    playbackLocations,
    devices,
    retention,
    period: { startDate, endDate, days },
  });
}
