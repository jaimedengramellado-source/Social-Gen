import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseDuration } from "@/lib/youtube";
import { refreshAccessToken, queryAnalytics, num, str, getReachStatsByVideo } from "@/lib/youtube-analytics";

const PERIOD_DAYS: Record<string, number> = { "7": 7, "28": 28, "90": 90, "365": 365 };

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const { data: conn } = await supabase
      .from("youtube_connections")
      .select("*")
      .eq("user_id", user.id)
      .single();
    if (!conn) return NextResponse.json({ error: "NOT_CONNECTED" }, { status: 404 });

    let token: string;
    try { token = await refreshAccessToken(conn, supabase); }
    catch { return NextResponse.json({ error: "TOKEN_ERROR" }, { status: 401 }); }

    const periodParam = request.nextUrl.searchParams.get("period") ?? "28";
    const days = PERIOD_DAYS[periodParam] ?? 28;
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - days * 86_400_000).toISOString().split("T")[0];

    const coreMetrics = ["views", "estimatedMinutesWatched", "averageViewDuration", "averageViewPercentage", "subscribersGained", "subscribersLost", "likes", "comments", "shares"];

    const [overview, videosResult, viewsTrend, subscribersTrend] = await Promise.all([
      queryAnalytics({ token, startDate, endDate, metrics: coreMetrics }),
      queryAnalytics({ token, startDate, endDate, metrics: coreMetrics, dimensions: ["video"], sort: "-views", maxResults: 50 }),
      queryAnalytics({ token, startDate, endDate, metrics: ["views", "estimatedMinutesWatched", "likes", "comments", "shares"], dimensions: ["day"], sort: "day" }),
      queryAnalytics({ token, startDate, endDate, metrics: ["subscribersGained", "subscribersLost"], dimensions: ["day"], sort: "day" }),
    ]);

    const ovRow = overview.rows[0];

    if (videosResult.rows.length === 0) {
      const debug = process.env.NODE_ENV !== "production" ? {
        videosError: videosResult.error, overviewError: overview.error,
      } : undefined;
      return NextResponse.json({
        channel: { id: conn.channel_id, name: conn.channel_name, thumbnail: conn.channel_thumbnail, subscriberCount: conn.subscriber_count },
        overview: { views: 0, watchTimeHours: 0, avgViewPercentage: 0, subscribersGained: 0, subscribersLost: 0, likes: 0, comments: 0, shares: 0, ctr: 0, impressions: 0, hasReachData: false },
        videos: [],
        viewsTrend: [],
        subscribersTrend: [],
        period: { startDate, endDate, days },
        reachSyncedUntil: conn.reach_synced_until ?? null,
        ...(debug ? { debug } : {}),
      });
    }

    const videoIds = videosResult.rows.map(r => str(r, "video")).filter(Boolean);

    const [detailsRes, reachStats] = await Promise.all([
      fetch(
        `https://www.googleapis.com/youtube/v3/videos?id=${videoIds.join(",")}&part=snippet,contentDetails&key=${process.env.YOUTUBE_API_KEY}`,
        { headers: { Authorization: `Bearer ${token}` } }
      ).then(r => r.json()),
      getReachStatsByVideo(supabase, user.id, videoIds, startDate, endDate),
    ]);

    const videoDetails: Record<string, { snippet: Record<string, unknown>; contentDetails: Record<string, unknown> }> = {};
    for (const item of detailsRes.items ?? []) videoDetails[item.id] = item;

    const hasReachData = Object.keys(reachStats).length > 0;

    const videos = videosResult.rows
      .map(row => {
        const id = str(row, "video");
        const detail = videoDetails[id];
        const durationSec = detail ? parseDuration(String(detail.contentDetails?.duration ?? "PT0S")).secs : 0;
        const snippet = detail?.snippet ?? {};
        const thumbnails = (snippet.thumbnails as Record<string, { url: string }> | undefined) ?? {};
        const reach = reachStats[id];
        return {
          id,
          title: String(snippet.title ?? id),
          thumbnail: thumbnails.medium?.url ?? thumbnails.default?.url ?? null,
          publishedAt: String(snippet.publishedAt ?? "") || null,
          isShort: durationSec > 0 && durationSec <= 60,
          durationSec,
          views: num(row, "views"),
          watchTimeMinutes: num(row, "estimatedMinutesWatched"),
          avgViewDuration: num(row, "averageViewDuration"),
          avgViewPercentage: num(row, "averageViewPercentage"),
          ctr: reach?.ctr ?? 0,
          impressions: reach?.impressions ?? 0,
          likes: num(row, "likes"),
          comments: num(row, "comments"),
          subscribersGained: num(row, "subscribersGained"),
        };
      })
      .sort((a, b) => {
        if (!a.publishedAt) return 1;
        if (!b.publishedAt) return -1;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      });

    const totalImpressions = Object.values(reachStats).reduce((s, r) => s + r.impressions, 0);
    const weightedCtr = Object.values(reachStats).reduce((s, r) => s + r.impressions * r.ctr, 0);

    return NextResponse.json({
      channel: { id: conn.channel_id, name: conn.channel_name, thumbnail: conn.channel_thumbnail, subscriberCount: conn.subscriber_count },
      overview: {
        views: num(ovRow, "views"),
        watchTimeHours: Math.round(num(ovRow, "estimatedMinutesWatched") / 60),
        avgViewPercentage: num(ovRow, "averageViewPercentage"),
        subscribersGained: num(ovRow, "subscribersGained"),
        subscribersLost: num(ovRow, "subscribersLost"),
        likes: num(ovRow, "likes"),
        comments: num(ovRow, "comments"),
        shares: num(ovRow, "shares"),
        ctr: totalImpressions > 0 ? weightedCtr / totalImpressions : 0,
        impressions: totalImpressions,
        hasReachData,
      },
      videos,
      viewsTrend: viewsTrend.rows.map(r => ({
        date: str(r, "day"), views: num(r, "views"), watchMinutes: num(r, "estimatedMinutesWatched"),
        likes: num(r, "likes"), comments: num(r, "comments"), shares: num(r, "shares"),
      })),
      subscribersTrend: subscribersTrend.rows.map(r => ({ date: str(r, "day"), gained: num(r, "subscribersGained"), lost: num(r, "subscribersLost") })),
      period: { startDate, endDate, days },
      reachSyncedUntil: conn.reach_synced_until ?? null,
    });

  } catch (err) {
    console.error("analytics error:", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
