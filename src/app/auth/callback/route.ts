import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/plan-intent";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeInternalPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Con plan elegido el pago es el paso 2; el onboarding llega tras el checkout
        if (next.startsWith("/pricing")) {
          return NextResponse.redirect(`${origin}${next}`);
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", user.id)
          .single();

        if (!profile?.onboarding_completed) {
          const url = new URL("/onboarding", origin);
          if (next !== "/dashboard") url.searchParams.set("next", next);
          return NextResponse.redirect(url.toString());
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }

    // El código ya se usó, caducó, o se abrió en un navegador distinto al de la
    // solicitud (PKCE liga el intercambio al navegador de origen). Para
    // recuperación de contraseña mandamos a pedir un enlace nuevo en vez de
    // fallar en silencio hacia /login.
    if (next === "/restablecer") {
      return NextResponse.redirect(`${origin}/recuperar?error=expired_link`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=expired_link`);
}
