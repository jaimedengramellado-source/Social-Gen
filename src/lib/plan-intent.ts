const PAID_PLANS = ["starter", "pro", "agency"];

// Ruta que retoma la compra de un plan: /pricing auto-lanza el checkout si hay sesión
export function planCheckoutPath(plan?: string | null, billing?: string | null): string | null {
  if (!plan || !PAID_PLANS.includes(plan)) return null;
  const b = billing === "annual" ? "annual" : "weekly";
  return `/pricing?plan=${plan}&billing=${b}`;
}

// Solo rutas internas: evita open redirects en el parámetro next
export function safeInternalPath(path: string | null | undefined, fallback = "/crear"): string {
  if (path && path.startsWith("/") && !path.startsWith("//")) return path;
  return fallback;
}
