import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revokeInstagramAccess } from "@/lib/social/instagram";
import { revokeTikTokAccess } from "@/lib/social/tiktok";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await request.json();
  const platform = body.platform;
  if (platform !== "instagram" && platform !== "tiktok") {
    return NextResponse.json({ error: "INVALID_PLATFORM" }, { status: 400 });
  }

  const { data: conn } = await supabase
    .from("social_connections")
    .select("access_token")
    .eq("user_id", user.id)
    .eq("platform", platform)
    .single();

  if (conn?.access_token) {
    if (platform === "instagram") await revokeInstagramAccess(conn.access_token);
    else await revokeTikTokAccess(conn.access_token);
  }

  const { error } = await supabase
    .from("social_connections")
    .delete()
    .eq("user_id", user.id)
    .eq("platform", platform);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
