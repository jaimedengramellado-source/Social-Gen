import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { xAuthUrl, generatePkcePair } from "@/lib/social/x";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (process.env.ENABLE_X_PUBLISHING !== "true") {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/publicar`);
  }
  if (!process.env.X_CLIENT_ID) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/publicar?error=x_not_configured`);
  }

  const state = crypto.randomUUID();
  const { verifier, challenge } = generatePkcePair();
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/x/callback`;

  const response = NextResponse.redirect(xAuthUrl(redirectUri, state, challenge));
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  } as const;
  response.cookies.set("x_oauth_state", state, cookieOpts);
  response.cookies.set("x_oauth_verifier", verifier, cookieOpts);
  return response;
}
