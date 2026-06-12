import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function refreshAccessToken(conn: {
  user_id: string; refresh_token: string | null; expires_at: string; access_token: string;
}, supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
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

function parseIsoDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] ?? "0") * 3600) + (parseInt(m[2] ?? "0") * 60) + parseInt(m[3] ?? "0");
}

function colIdx(headers: { name: string }[], name: string): number {
  return headers.findIndex(h => h.name === name);
}

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
    const auth = `Bearer ${token}`;
    const analyticsBase = "https://youtubeanalytics.googleapis.com/v2/reports";
    const dataBase = "https://www.googleapis.com/youtube/v3";
    const baseParams = `ids=channel==MINE&startDate=${startDate}&endDate=${endDate}`;

    // Core metrics — universally available for all channels
    const coreMetrics = "views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,likes,comments";
    // CTR metrics — only available for channels meeting YouTube's threshold
    const ctrMetrics = "impressions,impressionClickThroughRate";

    const [overviewRes, videoRes, ctrRes] = await Promise.all([
      fetch(`${analyticsBase}?${baseParams}&metrics=${coreMetrics},${ctrMetrics}`, { headers: { Authorization: auth } }),
      fetch(`${analyticsBase}?${baseParams}&metrics=${coreMetrics}&dimensions=video&sort=-views&maxResults=50`, { headers: { Authorization: auth } }),
      fetch(`${analyticsBase}?${baseParams}&metrics=${ctrMetrics}&dimensions=video&maxResults=200`, { headers: { Authorization: auth } }),
    ]);

    const [overviewData, videoData, ctrData] = await Promise.all([
      overviewRes.json(), videoRes.json(), ctrRes.json(),
    ]);

    // Overview
    const ovH: { name: string }[] = overviewData.columnHeaders ?? [];
    const ovR: number[] = overviewData.rows?.[0] ?? [];
    const ov = (name: string) => ovR[colIdx(ovH, name)] ?? 0;

    // Per-video analytics rows
    const vH: { name: string }[] = videoData.columnHeaders ?? [];
    const vRows: (string | number)[][] = videoData.rows ?? [];
    const vGet = (row: (string | number)[], name: string) => {
      const i = colIdx(vH, name);
      return i >= 0 ? row[i] : 0;
    };

    // CTR per video (separate query, may be empty)
    const ctrH: { name: string }[] = ctrData.columnHeaders ?? [];
    const ctrMap: Record<string, { ctr: number; impressions: number }> = {};
    for (const row of ctrData.rows ?? []) {
      const id = String(row[colIdx(ctrH, "video")]);
      ctrMap[id] = {
        ctr: Number(row[colIdx(ctrH, "impressionClickThroughRate")] ?? 0),
        impressions: Number(row[colIdx(ctrH, "impressions")] ?? 0),
      };
    }

    if (vRows.length === 0) {
      const debug = process.env.NODE_ENV !== "production" ? {
        videoDataError: videoData.error ?? null,
        overviewDataError: overviewData.error ?? null,
        ctrDataError: ctrData.error ?? null,
        videoDataKind: videoData.kind ?? null,
      } : undefined;
      return NextResponse.json({
        channel: { id: conn.channel_id, name: conn.channel_name, thumbnail: conn.channel_thumbnail, subscriberCount: conn.subscriber_count },
        overview: { views: 0, watchTimeHours: 0, avgCtr: 0, subscribersGained: 0, impressions: 0 },
        videos: [],
        period: { startDate, endDate, days },
        ...(debug ? { debug } : {}),
      });
    }

    // Fetch video details
    const videoIds = vRows.map(r => String(r[colIdx(vH, "video")])).filter(Boolean);
    let videoDetails: Record<string, { snippet: Record<string, unknown>; contentDetails: Record<string, unknown> }> = {};
    if (videoIds.length > 0) {
      const detailsRes = await fetch(
        `${dataBase}/videos?id=${videoIds.join(",")}&part=snippet,contentDetails&key=${process.env.YOUTUBE_API_KEY}`,
        { headers: { Authorization: auth } }
      );
      const details = await detailsRes.json();
      for (const item of details.items ?? []) videoDetails[item.id] = item;
    }

    const videos = vRows
      .map(row => {
        const id = String(row[colIdx(vH, "video")]);
        const detail = videoDetails[id];
        const durationSec = detail ? parseIsoDuration(String(detail.contentDetails?.duration ?? "PT0S")) : 0;
        const snippet = detail?.snippet ?? {};
        const thumbnails = (snippet.thumbnails as Record<string, { url: string }> | undefined) ?? {};
        return {
          id,
          title: String(snippet.title ?? id),
          thumbnail: thumbnails.medium?.url ?? thumbnails.default?.url ?? null,
          publishedAt: String(snippet.publishedAt ?? "") || null,
          isShort: durationSec > 0 && durationSec <= 60,
          durationSec,
          views: Number(vGet(row, "views")),
          watchTimeMinutes: Number(vGet(row, "estimatedMinutesWatched")),
          avgViewDuration: Number(vGet(row, "averageViewDuration")),
          avgViewPercentage: Number(vGet(row, "averageViewPercentage")),
          ctr: ctrMap[id]?.ctr ?? 0,
          impressions: ctrMap[id]?.impressions ?? 0,
          likes: Number(vGet(row, "likes")),
          comments: Number(vGet(row, "comments")),
          subscribersGained: Number(vGet(row, "subscribersGained")),
        };
      })
      .sort((a, b) => {
        if (!a.publishedAt) return 1;
        if (!b.publishedAt) return -1;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      });

    return NextResponse.json({
      channel: { id: conn.channel_id, name: conn.channel_name, thumbnail: conn.channel_thumbnail, subscriberCount: conn.subscriber_count },
      overview: {
        views: ov("views"),
        watchTimeHours: Math.round(ov("estimatedMinutesWatched") / 60),
        avgCtr: ov("impressionClickThroughRate"),
        subscribersGained: ov("subscribersGained"),
        impressions: ov("impressions"),
      },
      videos,
      period: { startDate, endDate, days },
    });

  } catch (err) {
    console.error("analytics error:", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
