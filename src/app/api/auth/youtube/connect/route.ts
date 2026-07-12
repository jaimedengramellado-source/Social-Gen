import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/estadisticas?error=not_configured`);
  }

  const state = crypto.randomUUID();
  const from = request.nextUrl.searchParams.get("from");

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  url.searchParams.set("redirect_uri", `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/youtube/callback`);
  url.searchParams.set("response_type", "code");
  // youtube.upload es un scope sensible: pedirlo antes de pasar la verificación
  // de Google haría saltar el aviso de "app no verificada" también al conectar
  // desde /estadisticas. Autorización incremental (mínimo privilegio): solo se
  // solicita al conectar desde Publicar y con la publicación activada;
  // include_granted_scopes conserva los permisos ya concedidos.
  const scopes = [
    "https://www.googleapis.com/auth/yt-analytics.readonly",
    "https://www.googleapis.com/auth/youtube.readonly",
  ];
  if (from === "publicar" && process.env.ENABLE_YOUTUBE_PUBLISHING === "true") {
    scopes.push("https://www.googleapis.com/auth/youtube.upload");
  }
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);

  const response = NextResponse.redirect(url.toString());
  response.cookies.set("yt_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  // Volver a la página de origen tras el OAuth (solo valores conocidos)
  if (from === "publicar") {
    response.cookies.set("yt_oauth_from", from, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 600,
      path: "/",
    });
  }
  return response;
}
