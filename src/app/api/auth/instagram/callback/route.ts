import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { exchangeInstagramCode, listInstagramAccounts, INSTAGRAM_SCOPES } from "@/lib/social/instagram";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${APP_URL}/publicar?error=ig_access_denied`);
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("ig_oauth_state")?.value;
  if (!state || state !== savedState) {
    return NextResponse.redirect(`${APP_URL}/publicar?error=ig_invalid_state`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${APP_URL}/login`);

  try {
    const redirectUri = `${APP_URL}/api/auth/instagram/callback`;
    const { accessToken, expiresAt } = await exchangeInstagramCode(code, redirectUri);

    const accounts = await listInstagramAccounts(accessToken);
    if (accounts.length === 0) {
      return NextResponse.redirect(`${APP_URL}/publicar?error=ig_no_business_account`);
    }

    // Se activa la primera; el resto queda en metadata.candidates para cambiar desde la UI
    const active = accounts[0];
    await supabase.from("social_connections").upsert(
      {
        user_id: user.id,
        platform: "instagram",
        account_id: active.igId,
        account_name: active.username,
        account_avatar: active.avatar,
        page_id: active.pageId,
        access_token: accessToken,
        expires_at: expiresAt.toISOString(),
        scopes: INSTAGRAM_SCOPES.join(","),
        metadata: { candidates: accounts },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,platform" }
    );
  } catch (err) {
    console.error("Instagram OAuth callback failed:", err);
    return NextResponse.redirect(`${APP_URL}/publicar?error=ig_token_failed`);
  }

  const response = NextResponse.redirect(`${APP_URL}/publicar`);
  response.cookies.delete("ig_oauth_state");
  return response;
}
