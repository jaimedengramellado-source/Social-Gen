import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

const protectedRoutes = [
  "/dashboard", "/crear", "/explorar", "/biblioteca", "/ajustes",
  "/imagenes", "/documentos", "/todos", "/calendario", "/estadisticas", "/onboarding",
];
const authRoutes = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  const isProtected = protectedRoutes.some((r) => pathname.startsWith(r));
  const isAuthRoute = authRoutes.some((r) => pathname.startsWith(r));

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
