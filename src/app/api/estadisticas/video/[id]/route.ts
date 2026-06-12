import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function getToken(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string> {
  const { data: conn } = await supabase.from("youtube_connections").select("*").eq("user_id", userId).single();
  if (!conn) throw new Error("NOT_CONNECTED");

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
  }).eq("user_id", userId);
  return data.access_token;
}

function colIdx(headers: { name: string }[], name: string) {
  return headers.findIndex(h => h.name === name);
}

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

  let token: string;
  try { token = await getToken(supabase, user.id); }
  catch { return NextResponse.json({ error: "TOKEN_ERROR" }, { status: 401 }); }

  const auth = `Bearer ${token}`;
  const analyticsBase = "https://youtubeanalytics.googleapis.com/v2/reports";
  const baseParams = `ids=channel==MINE&startDate=${startDate}&endDate=${endDate}&filters=video==${videoId}`;

  const [overviewRes, dailyRes, sourcesRes, detailRes] = await Promise.all([
    fetch(`${analyticsBase}?${baseParams}&metrics=views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,likes,comments,impressions,impressionClickThroughRate`, { headers: { Authorization: auth } }),
    fetch(`${analyticsBase}?${baseParams}&metrics=views,estimatedMinutesWatched&dimensions=day&sort=day`, { headers: { Authorization: auth } }),
    fetch(`${analyticsBase}?${baseParams}&metrics=views&dimensions=insightTrafficSourceType&sort=-views`, { headers: { Authorization: auth } }),
    fetch(`https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails,statistics`, { headers: { Authorization: auth } }),
  ]);

  const [overviewData, dailyData, sourcesData, detail] = await Promise.all([
    overviewRes.json(), dailyRes.json(), sourcesRes.json(), detailRes.json(),
  ]);

  const ovH: { name: string }[] = overviewData.columnHeaders ?? [];
  const ovR: number[] = overviewData.rows?.[0] ?? [];
  const ov = (name: string) => ovR[colIdx(ovH, name)] ?? 0;

  const dailyH: { name: string }[] = dailyData.columnHeaders ?? [];
  const dailyRows: (string | number)[][] = dailyData.rows ?? [];
  const daily = dailyRows.map(row => ({
    date: String(row[colIdx(dailyH, "day")]),
    views: Number(row[colIdx(dailyH, "views")] ?? 0),
    watchMinutes: Number(row[colIdx(dailyH, "estimatedMinutesWatched")] ?? 0),
  }));

  const sourcesH: { name: string }[] = sourcesData.columnHeaders ?? [];
  const sourcesRows: (string | number)[][] = sourcesData.rows ?? [];
  const totalSourceViews = sourcesRows.reduce((s, r) => s + Number(r[colIdx(sourcesH, "views")] ?? 0), 0);
  const trafficSources = sourcesRows.map(row => ({
    source: String(row[colIdx(sourcesH, "insightTrafficSourceType")]),
    views: Number(row[colIdx(sourcesH, "views")] ?? 0),
    pct: totalSourceViews > 0 ? Math.round(Number(row[colIdx(sourcesH, "views")] ?? 0) / totalSourceViews * 100) : 0,
  }));

  const item = detail.items?.[0];
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
      views: ov("views"),
      watchTimeHours: Math.round(ov("estimatedMinutesWatched") / 60 * 10) / 10,
      avgViewDuration: ov("averageViewDuration"),
      avgViewPercentage: ov("averageViewPercentage"),
      ctr: ov("impressionClickThroughRate"),
      impressions: ov("impressions"),
      likes: ov("likes"),
      comments: ov("comments"),
      subscribersGained: ov("subscribersGained"),
    },
    daily,
    trafficSources,
    period: { startDate, endDate, days },
  });
}
