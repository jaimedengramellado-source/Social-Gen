import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { tiktokAuthUrl } from "@/lib/social/tiktok";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (process.env.ENABLE_TIKTOK_PUBLISHING !== "true") {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/publicar`);
  }
  if (!process.env.TIKTOK_CLIENT_KEY || !process.env.TIKTOK_CLIENT_SECRET) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/publicar?error=tt_not_configured`);
  }

  const state = crypto.randomUUID();
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/tiktok/callback`;

  const response = NextResponse.redirect(tiktokAuthUrl(redirectUri, state));
  response.cookies.set("tt_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return response;
}
