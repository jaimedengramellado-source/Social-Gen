import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { exchangeFacebookCode, listFacebookPages, FACEBOOK_SCOPES } from "@/lib/social/facebook";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${APP_URL}/publicar?error=fb_access_denied`);
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("fb_oauth_state")?.value;
  if (!state || state !== savedState) {
    return NextResponse.redirect(`${APP_URL}/publicar?error=fb_invalid_state`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${APP_URL}/login`);

  try {
    const redirectUri = `${APP_URL}/api/auth/facebook/callback`;
    const userTokens = await exchangeFacebookCode(code, redirectUri);
    const pages = await listFacebookPages(userTokens.accessToken);
    if (pages.length === 0) {
      return NextResponse.redirect(`${APP_URL}/publicar?error=fb_no_pages`);
    }

    // Se publica en la primera página; el resto queda en metadata por si algún
    // día se añade selector. Se guarda el token DE PÁGINA (no caduca) y el de
    // usuario solo para poder revocar al desconectar.
    const page = pages[0];
    await supabase.from("social_connections").upsert(
      {
        user_id: user.id,
        platform: "facebook",
        account_id: page.pageId,
        account_name: page.name,
        account_avatar: page.avatar,
        access_token: page.pageAccessToken,
        refresh_token: null,
        expires_at: null,
        page_id: page.pageId,
        scopes: FACEBOOK_SCOPES.join(","),
        metadata: {
          userToken: userTokens.accessToken,
          // sin pageAccessToken: los tokens de las otras páginas no se persisten
          candidates: pages.map((p) => ({
            pageId: p.pageId,
            name: p.name,
            username: p.username,
            avatar: p.avatar,
          })),
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,platform" }
    );
  } catch (err) {
    console.error("Facebook OAuth callback failed:", err);
    return NextResponse.redirect(`${APP_URL}/publicar?error=fb_token_failed`);
  }

  const response = NextResponse.redirect(`${APP_URL}/publicar`);
  response.cookies.delete("fb_oauth_state");
  return response;
}
