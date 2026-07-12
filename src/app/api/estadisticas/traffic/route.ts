import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { refreshAccessToken, queryAnalytics, num, str } from "@/lib/youtube-analytics";

const PERIOD_DAYS: Record<string, number> = { "7": 7, "28": 28, "90": 90, "365": 365 };

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { data: conn } = await supabase.from("youtube_connections").select("*").eq("user_id", user.id).single();
  if (!conn) return NextResponse.json({ error: "NOT_CONNECTED" }, { status: 404 });

  let token: string;
  try { token = await refreshAccessToken(conn, supabase); }
  catch { return NextResponse.json({ error: "TOKEN_ERROR" }, { status: 401 }); }

  const periodParam = request.nextUrl.searchParams.get("period") ?? "28";
  const days = PERIOD_DAYS[periodParam] ?? 28;
  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - days * 86_400_000).toISOString().split("T")[0];

  const [sourcesResult, playbackResult, searchTermsResult, sharingResult] = await Promise.all([
    queryAnalytics({ token, startDate, endDate, metrics: ["views"], dimensions: ["insightTrafficSourceType"], sort: "-views" }),
    queryAnalytics({ token, startDate, endDate, metrics: ["views"], dimensions: ["insightPlaybackLocationType"], sort: "-views" }),
    queryAnalytics({
      token, startDate, endDate, metrics: ["views"], dimensions: ["insightTrafficSourceDetail"],
      filters: { insightTrafficSourceType: "YT_SEARCH" }, sort: "-views", maxResults: 15,
    }),
    queryAnalytics({ token, startDate, endDate, metrics: ["shares"], dimensions: ["sharingService"], sort: "-shares", maxResults: 10 }),
  ]);

  const totalSourceViews = sourcesResult.rows.reduce((s, r) => s + num(r, "views"), 0);
  const totalPlaybackViews = playbackResult.rows.reduce((s, r) => s + num(r, "views"), 0);
  const totalShares = sharingResult.rows.reduce((s, r) => s + num(r, "shares"), 0);

  return NextResponse.json({
    sources: sourcesResult.rows.map(r => ({
      source: str(r, "insightTrafficSourceType"),
      views: num(r, "views"),
      pct: totalSourceViews > 0 ? Math.round(num(r, "views") / totalSourceViews * 100) : 0,
    })),
    playbackLocations: playbackResult.rows.map(r => ({
      location: str(r, "insightPlaybackLocationType"),
      views: num(r, "views"),
      pct: totalPlaybackViews > 0 ? Math.round(num(r, "views") / totalPlaybackViews * 100) : 0,
    })),
    searchTerms: searchTermsResult.rows
      .map(r => ({ term: str(r, "insightTrafficSourceDetail"), views: num(r, "views") }))
      .filter(t => t.term),
    sharingServices: sharingResult.rows.map(r => ({
      service: str(r, "sharingService"),
      views: num(r, "shares"),
      pct: totalShares > 0 ? Math.round(num(r, "shares") / totalShares * 100) : 0,
    })),
    period: { startDate, endDate, days },
  });
}
