import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { refreshAccessToken, queryAnalytics, num, str } from "@/lib/youtube-analytics";

export type BestTimeSlot = {
  weekday: number; // 0=domingo ... 6=sábado (convención JS getDay)
  hour: number; // inicio de franja de 2h
  quality: "top" | "buena";
  avgViews?: number;
  videos?: number;
};

// Franjas recomendadas para audiencia en España cuando no hay datos propios
// suficientes (fuentes: estudios de engagement por franja de Metricool/Hootsuite).
const HEURISTIC_SLOTS: Record<string, BestTimeSlot[]> = {
  tiktok: [
    { weekday: 2, hour: 19, quality: "top" },
    { weekday: 4, hour: 18, quality: "top" },
    { weekday: 4, hour: 21, quality: "buena" },
    { weekday: 0, hour: 17, quality: "buena" },
    { weekday: 3, hour: 13, quality: "buena" },
  ],
  reels: [
    { weekday: 3, hour: 19, quality: "top" },
    { weekday: 1, hour: 13, quality: "top" },
    { weekday: 4, hour: 14, quality: "buena" },
    { weekday: 0, hour: 18, quality: "buena" },
    { weekday: 2, hour: 20, quality: "buena" },
  ],
  youtube_shorts: [
    { weekday: 5, hour: 17, quality: "top" },
    { weekday: 0, hour: 16, quality: "top" },
    { weekday: 6, hour: 12, quality: "buena" },
    { weekday: 4, hour: 18, quality: "buena" },
    { weekday: 3, hour: 17, quality: "buena" },
  ],
  youtube_long: [
    { weekday: 5, hour: 17, quality: "top" },
    { weekday: 6, hour: 11, quality: "top" },
    { weekday: 0, hour: 16, quality: "buena" },
    { weekday: 4, hour: 19, quality: "buena" },
    { weekday: 3, hour: 17, quality: "buena" },
  ],
};

const MIN_VIDEOS_FOR_PERSONALIZED = 8;
const BUCKET_HOURS = 2;

function madridParts(iso: string): { weekday: number; hour: number } | null {
  try {
    const d = new Date(iso);
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Madrid",
      weekday: "short",
      hour: "numeric",
      hour12: false,
    });
    const parts = fmt.formatToParts(d);
    const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const wd = wdMap[parts.find((p) => p.type === "weekday")?.value ?? ""];
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? NaN);
    if (wd === undefined || Number.isNaN(hour)) return null;
    return { weekday: wd, hour: hour === 24 ? 0 : hour };
  } catch {
    return null;
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("main_platform")
    .eq("id", user.id)
    .single();
  const platform = profile?.main_platform ?? "tiktok";

  const heuristic = {
    source: "heuristic" as const,
    platform,
    slots: HEURISTIC_SLOTS[platform] ?? HEURISTIC_SLOTS.tiktok,
  };

  const { data: conn } = await supabase
    .from("youtube_connections")
    .select("*")
    .eq("user_id", user.id)
    .single();
  if (!conn) return NextResponse.json(heuristic);

  let token: string;
  try {
    token = await refreshAccessToken(conn, supabase);
  } catch {
    return NextResponse.json(heuristic);
  }

  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - 365 * 86_400_000).toISOString().split("T")[0];

  const videosResult = await queryAnalytics({
    token,
    startDate,
    endDate,
    metrics: ["views"],
    dimensions: ["video"],
    sort: "-views",
    maxResults: 200,
  });

  const viewsByVideo: Record<string, number> = {};
  for (const row of videosResult.rows) {
    const id = str(row, "video");
    if (id) viewsByVideo[id] = num(row, "views");
  }
  const videoIds = Object.keys(viewsByVideo);
  if (videoIds.length < MIN_VIDEOS_FOR_PERSONALIZED) return NextResponse.json(heuristic);

  // La API de vídeos acepta máx. 50 ids por request
  const publishedAt: Record<string, string> = {};
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${batch.join(",")}&part=snippet&key=${process.env.YOUTUBE_API_KEY}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    for (const item of data.items ?? []) {
      const ts = item.snippet?.publishedAt;
      if (ts) publishedAt[item.id] = ts;
    }
  }

  type Bucket = { totalViews: number; videos: number };
  const buckets: Record<string, Bucket> = {};
  let scored = 0;
  for (const [id, views] of Object.entries(viewsByVideo)) {
    const ts = publishedAt[id];
    if (!ts) continue;
    const parts = madridParts(ts);
    if (!parts) continue;
    const bucketHour = Math.floor(parts.hour / BUCKET_HOURS) * BUCKET_HOURS;
    const key = `${parts.weekday}-${bucketHour}`;
    buckets[key] = buckets[key] ?? { totalViews: 0, videos: 0 };
    buckets[key].totalViews += views;
    buckets[key].videos += 1;
    scored++;
  }
  if (scored < MIN_VIDEOS_FOR_PERSONALIZED) return NextResponse.json(heuristic);

  const ranked = Object.entries(buckets)
    // Con un solo vídeo en la franja el dato es anécdota, no patrón
    .filter(([, b]) => b.videos >= 2)
    .map(([key, b]) => {
      const [weekday, hour] = key.split("-").map(Number);
      return { weekday, hour, avgViews: Math.round(b.totalViews / b.videos), videos: b.videos };
    })
    .sort((a, b) => b.avgViews - a.avgViews)
    .slice(0, 5);

  if (ranked.length < 3) return NextResponse.json(heuristic);

  const slots: BestTimeSlot[] = ranked.map((r, i) => ({
    ...r,
    quality: i < 2 ? "top" : "buena",
  }));

  return NextResponse.json({ source: "youtube", platform, slots });
}
