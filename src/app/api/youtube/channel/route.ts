import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getChannel } from "@/lib/youtube";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    const data = await getChannel(id);
    if (!data) return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    console.error("YouTube channel error:", err);
    return NextResponse.json({ error: "YouTube API error" }, { status: 500 });
  }
}
