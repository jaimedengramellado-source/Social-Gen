import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { searchIdeasVideos } from "@/lib/youtube";

export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export async function GET(req: NextRequest) {
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json({ videos: [] });

  const query = q.trim().toLowerCase();

  try {
    const supabase = await createClient();

    // Try Supabase cache (table: ideas_cache — query TEXT PK, results JSONB, cached_at TIMESTAMPTZ)
    const cutoff = new Date(Date.now() - CACHE_TTL_MS).toISOString();
    const { data: cached } = await supabase
      .from("ideas_cache")
      .select("results")
      .eq("query", query)
      .gte("cached_at", cutoff)
      .maybeSingle();

    if (cached?.results) {
      return NextResponse.json({ videos: cached.results, cached: true });
    }

    // Fetch fresh from YouTube
    const videos = await searchIdeasVideos(q);

    // Write to cache con admin client: la tabla es compartida entre usuarios y
    // ya no acepta INSERT/UPDATE desde el rol authenticated (ver RLS).
    try {
      const admin = await createAdminClient();
      await admin.from("ideas_cache").upsert({
        query,
        results: videos,
        cached_at: new Date().toISOString(),
      });
    } catch { /* fail silently, la respuesta ya se sirve sin cache */ }

    return NextResponse.json({ videos });
  } catch (err) {
    console.error("search-ideas error:", err);
    return NextResponse.json({ error: "API error" }, { status: 500 });
  }
}
