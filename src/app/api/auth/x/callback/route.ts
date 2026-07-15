import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { exchangeXCode, getXUserInfo } from "@/lib/social/x";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${APP_URL}/publicar?error=x_access_denied`);
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("x_oauth_state")?.value;
  const verifier = cookieStore.get("x_oauth_verifier")?.value;
  if (!state || state !== savedState || !verifier) {
    return NextResponse.redirect(`${APP_URL}/publicar?error=x_invalid_state`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${APP_URL}/login`);

  try {
    const redirectUri = `${APP_URL}/api/auth/x/callback`;
    const tokens = await exchangeXCode(code, redirectUri, verifier);
    const info = await getXUserInfo(tokens.accessToken);

    await supabase.from("social_connections").upsert(
      {
        user_id: user.id,
        platform: "x",
        account_id: info.id,
        account_name: info.username,
        account_avatar: info.avatar,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: tokens.expiresAt.toISOString(),
        scopes: tokens.scope,
        metadata: { verified: info.verified, displayName: info.name },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,platform" }
    );
  } catch (err) {
    console.error("X OAuth callback failed:", err);
    return NextResponse.redirect(`${APP_URL}/publicar?error=x_token_failed`);
  }

  const response = NextResponse.redirect(`${APP_URL}/publicar`);
  response.cookies.delete("x_oauth_state");
  response.cookies.delete("x_oauth_verifier");
  return response;
}
