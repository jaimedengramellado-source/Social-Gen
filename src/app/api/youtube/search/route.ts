import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchChannels, type YTChannel } from "@/lib/youtube";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q       = searchParams.get("q")?.trim() ?? "";
  const nicho   = searchParams.get("nicho") ?? "";
  const minSubs = Number(searchParams.get("minSubs") ?? 0);
  const maxSubs = Number(searchParams.get("maxSubs") ?? Infinity);

  if (!q && !nicho) return NextResponse.json({ error: "q or nicho required" }, { status: 400 });

  try {
    let channels: YTChannel[] = await searchChannels(q || nicho, nicho || undefined);

    if (minSubs > 0 || maxSubs < Infinity) {
      channels = channels.filter(c => c.subscribers >= minSubs && c.subscribers < maxSubs);
    }

    return NextResponse.json({ channels });
  } catch (err) {
    console.error("YouTube search error:", err);
    return NextResponse.json({ error: "YouTube API error" }, { status: 500 });
  }
}
