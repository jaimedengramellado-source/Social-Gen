import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { exchangeTikTokCode, getTikTokUserInfo, queryCreatorInfo } from "@/lib/social/tiktok";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${APP_URL}/publicar?error=tt_access_denied`);
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("tt_oauth_state")?.value;
  if (!state || state !== savedState) {
    return NextResponse.redirect(`${APP_URL}/publicar?error=tt_invalid_state`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${APP_URL}/login`);

  try {
    const redirectUri = `${APP_URL}/api/auth/tiktok/callback`;
    const tokens = await exchangeTikTokCode(code, redirectUri);
    const info = await getTikTokUserInfo(tokens.accessToken);

    // creator_info dicta las opciones de privacidad reales (sin audit: solo SELF_ONLY)
    const creatorInfo = await queryCreatorInfo(tokens.accessToken).catch(() => null);

    await supabase.from("social_connections").upsert(
      {
        user_id: user.id,
        platform: "tiktok",
        account_id: tokens.openId,
        account_name: info.username ?? info.displayName,
        account_avatar: info.avatar,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: tokens.expiresAt.toISOString(),
        scopes: tokens.scope,
        metadata: creatorInfo ? { creatorInfo } : {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,platform" }
    );
  } catch (err) {
    console.error("TikTok OAuth callback failed:", err);
    return NextResponse.redirect(`${APP_URL}/publicar?error=tt_token_failed`);
  }

  const response = NextResponse.redirect(`${APP_URL}/publicar`);
  response.cookies.delete("tt_oauth_state");
  return response;
}
