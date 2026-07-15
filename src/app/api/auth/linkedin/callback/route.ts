import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { exchangeLinkedInCode, getLinkedInUserInfo } from "@/lib/social/linkedin";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${APP_URL}/publicar?error=li_access_denied`);
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("li_oauth_state")?.value;
  if (!state || state !== savedState) {
    return NextResponse.redirect(`${APP_URL}/publicar?error=li_invalid_state`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${APP_URL}/login`);

  try {
    const redirectUri = `${APP_URL}/api/auth/linkedin/callback`;
    const tokens = await exchangeLinkedInCode(code, redirectUri);
    const info = await getLinkedInUserInfo(tokens.accessToken);

    await supabase.from("social_connections").upsert(
      {
        user_id: user.id,
        platform: "linkedin",
        account_id: info.id,
        account_name: info.name,
        account_avatar: info.avatar,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: tokens.expiresAt.toISOString(),
        scopes: tokens.scope,
        metadata: {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,platform" }
    );
  } catch (err) {
    console.error("LinkedIn OAuth callback failed:", err);
    return NextResponse.redirect(`${APP_URL}/publicar?error=li_token_failed`);
  }

  const response = NextResponse.redirect(`${APP_URL}/publicar`);
  response.cookies.delete("li_oauth_state");
  return response;
}
