import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(`${APP_URL}/estadisticas?error=access_denied`);
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("yt_oauth_state")?.value;
  if (!state || state !== savedState) {
    return NextResponse.redirect(`${APP_URL}/estadisticas?error=invalid_state`);
  }

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${APP_URL}/api/auth/youtube/callback`,
      grant_type: "authorization_code",
    }),
  });
  const tokens = await tokenRes.json();
  if (!tokens.access_token) {
    console.error("YouTube token exchange failed:", JSON.stringify({
      status: tokenRes.status,
      error: tokens.error,
      description: tokens.error_description,
    }));
    return NextResponse.redirect(`${APP_URL}/estadisticas?error=token_failed`);
  }

  // Get channel info
  const channelRes = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  );
  const channelData = await channelRes.json();
  const channel = channelData.items?.[0];
  if (!channel) {
    return NextResponse.redirect(`${APP_URL}/estadisticas?error=no_channel`);
  }

  // Save to DB
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${APP_URL}/login`);

  await supabase.from("youtube_connections").upsert({
    user_id: user.id,
    channel_id: channel.id,
    channel_name: channel.snippet?.title ?? null,
    channel_thumbnail: channel.snippet?.thumbnails?.default?.url ?? null,
    subscriber_count: parseInt(channel.statistics?.subscriberCount ?? "0", 10),
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  const response = NextResponse.redirect(`${APP_URL}/estadisticas`);
  response.cookies.delete("yt_oauth_state");
  return response;
}
