import { NextRequest, NextResponse } from "next/server";
import { getTrending } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const period      = sp.get("period")      ?? "24h";
  const country     = sp.get("country")     ?? "GLOBAL";
  const contentType = (sp.get("type")       ?? "all") as "short" | "long" | "all";
  const excludeKids  = sp.get("excludeKids")  !== "false";
  const excludeMusic = sp.get("excludeMusic") !== "false";

  try {
    const videos = await getTrending({ period, country, contentType, excludeKids, excludeMusic });
    return NextResponse.json({ videos });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[trending]", message);
    return NextResponse.json({ videos: [], error: message }, { status: 500 });
  }
}
