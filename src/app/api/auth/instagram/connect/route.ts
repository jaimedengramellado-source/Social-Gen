import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { instagramAuthUrl } from "@/lib/social/instagram";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (process.env.ENABLE_INSTAGRAM_PUBLISHING !== "true") {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/publicar`);
  }
  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/publicar?error=ig_not_configured`);
  }

  const state = crypto.randomUUID();
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`;

  const response = NextResponse.redirect(instagramAuthUrl(redirectUri, state));
  response.cookies.set("ig_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return response;
}
