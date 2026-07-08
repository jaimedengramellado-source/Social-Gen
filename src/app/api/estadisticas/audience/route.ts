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

  const [demographics, geography, devices, subscribedStatus] = await Promise.all([
    queryAnalytics({ token, startDate, endDate, metrics: ["viewerPercentage"], dimensions: ["ageGroup", "gender"] }),
    queryAnalytics({ token, startDate, endDate, metrics: ["views"], dimensions: ["country"], sort: "-views", maxResults: 10 }),
    queryAnalytics({ token, startDate, endDate, metrics: ["views"], dimensions: ["deviceType"], sort: "-views" }),
    queryAnalytics({ token, startDate, endDate, metrics: ["views"], dimensions: ["subscribedStatus"] }),
  ]);

  const totalGeoViews = geography.rows.reduce((s, r) => s + num(r, "views"), 0);
  const totalDeviceViews = devices.rows.reduce((s, r) => s + num(r, "views"), 0);
  const totalSubStatusViews = subscribedStatus.rows.reduce((s, r) => s + num(r, "views"), 0);

  return NextResponse.json({
    demographics: demographics.rows.map(r => ({
      ageGroup: str(r, "ageGroup"),
      gender: str(r, "gender"),
      viewerPercentage: num(r, "viewerPercentage"),
    })),
    geography: geography.rows.map(r => ({
      country: str(r, "country"),
      views: num(r, "views"),
      pct: totalGeoViews > 0 ? Math.round(num(r, "views") / totalGeoViews * 100) : 0,
    })),
    devices: devices.rows.map(r => ({
      device: str(r, "deviceType"),
      views: num(r, "views"),
      pct: totalDeviceViews > 0 ? Math.round(num(r, "views") / totalDeviceViews * 100) : 0,
    })),
    subscribedStatus: subscribedStatus.rows.map(r => ({
      status: str(r, "subscribedStatus"),
      views: num(r, "views"),
      pct: totalSubStatusViews > 0 ? Math.round(num(r, "views") / totalSubStatusViews * 100) : 0,
    })),
    period: { startDate, endDate, days },
  });
}
