import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { revokeInstagramAccess } from "@/lib/social/instagram";
import { revokeTikTokAccess } from "@/lib/social/tiktok";
import { revokeXAccess } from "@/lib/social/x";
import { revokeFacebookAccess } from "@/lib/social/facebook";

const PLATFORMS = ["instagram", "facebook", "tiktok", "x", "linkedin", "threads"];

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await request.json();
  const platform = body.platform;
  if (!PLATFORMS.includes(platform)) {
    return NextResponse.json({ error: "INVALID_PLATFORM" }, { status: 400 });
  }

  const { data: conn } = await supabase
    .from("social_connections")
    .select("access_token, metadata")
    .eq("user_id", user.id)
    .eq("platform", platform)
    .single();

  // LinkedIn y Threads no exponen revocación programática: basta borrar los tokens
  if (conn?.access_token) {
    if (platform === "instagram") await revokeInstagramAccess(conn.access_token);
    else if (platform === "tiktok") await revokeTikTokAccess(conn.access_token);
    else if (platform === "x") await revokeXAccess(conn.access_token);
    else if (platform === "facebook") {
      // Facebook publica con el token de página; el que revoca permisos es el de usuario
      const userToken = (conn.metadata as Record<string, unknown> | null)?.userToken;
      if (typeof userToken === "string") await revokeFacebookAccess(userToken);
    }
  }

  const { error } = await supabase
    .from("social_connections")
    .delete()
    .eq("user_id", user.id)
    .eq("platform", platform);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
