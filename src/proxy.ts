import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

const protectedRoutes = [
  "/dashboard", "/crear", "/explorar", "/biblioteca", "/ajustes",
  "/imagenes", "/documentos", "/todos", "/calendario", "/estadisticas", "/onboarding",
];
const authRoutes = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const isProtected = protectedRoutes.some((r) => pathname.startsWith(r));
  const isAuthRoute = authRoutes.some((r) => pathname.startsWith(r));

  // Páginas públicas (landing, precios, legal, /api/*, etc.) no necesitan el
  // round-trip a Supabase: ni redirigen por auth ni leen `user`. Cada Route
  // Handler bajo /api valida su propia sesión con createClient()+getUser().
  if (!isProtected && !isAuthRoute) {
    return NextResponse.next({ request });
  }

  const { response, user } = await updateSession(request);

  if (isProtected && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthRoute && user) {
    // Conserva la intención de compra si venía a registrarse con un plan elegido
    const plan = request.nextUrl.searchParams.get("plan");
    const billing = request.nextUrl.searchParams.get("billing");
    if (plan && plan !== "free") {
      const url = new URL("/pricing", request.url);
      url.searchParams.set("plan", plan);
      if (billing) url.searchParams.set("billing", billing);
      return NextResponse.redirect(url);
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
