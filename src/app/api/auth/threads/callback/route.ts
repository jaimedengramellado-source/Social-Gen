import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { exchangeThreadsCode, getThreadsUserInfo, THREADS_SCOPES } from "@/lib/social/threads";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${APP_URL}/publicar?error=th_access_denied`);
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("th_oauth_state")?.value;
  if (!state || state !== savedState) {
    return NextResponse.redirect(`${APP_URL}/publicar?error=th_invalid_state`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${APP_URL}/login`);

  try {
    const redirectUri = `${APP_URL}/api/auth/threads/callback`;
    const tokens = await exchangeThreadsCode(code, redirectUri);
    const info = await getThreadsUserInfo(tokens.accessToken);

    await supabase.from("social_connections").upsert(
      {
        user_id: user.id,
        platform: "threads",
        account_id: info.id,
        account_name: info.username,
        account_avatar: info.avatar,
        access_token: tokens.accessToken,
        // Threads renueva el propio token largo (th_refresh_token), no hay refresh token aparte
        refresh_token: null,
        expires_at: tokens.expiresAt.toISOString(),
        scopes: THREADS_SCOPES.join(","),
        metadata: {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,platform" }
    );
  } catch (err) {
    console.error("Threads OAuth callback failed:", err);
    return NextResponse.redirect(`${APP_URL}/publicar?error=th_token_failed`);
  }

  const response = NextResponse.redirect(`${APP_URL}/publicar`);
  response.cookies.delete("th_oauth_state");
  return response;
}
