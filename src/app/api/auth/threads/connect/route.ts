import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { threadsAuthUrl } from "@/lib/social/threads";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (process.env.ENABLE_THREADS_PUBLISHING !== "true") {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/publicar`);
  }
  if (!process.env.THREADS_APP_ID || !process.env.THREADS_APP_SECRET) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/publicar?error=th_not_configured`);
  }

  const state = crypto.randomUUID();
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/threads/callback`;

  const response = NextResponse.redirect(threadsAuthUrl(redirectUri, state));
  response.cookies.set("th_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return response;
}
