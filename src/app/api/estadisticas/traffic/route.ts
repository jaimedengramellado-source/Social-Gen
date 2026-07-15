import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { refreshAccessToken, queryAnalytics, num, str, LIFETIME_START_DATE } from "@/lib/youtube-analytics";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { data: conn } = await supabase.from("youtube_connections").select("*").eq("user_id", user.id).single();
  if (!conn) return NextResponse.json({ error: "NOT_CONNECTED" }, { status: 404 });

  let token: string;
  try { token = await refreshAccessToken(conn, supabase); }
  catch { return NextResponse.json({ error: "TOKEN_ERROR" }, { status: 401 }); }

  const endDate = new Date().toISOString().split("T")[0];
  const startDate = LIFETIME_START_DATE;

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
  });
}
