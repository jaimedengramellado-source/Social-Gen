import { createAdminClient } from "@/lib/supabase/server";

// Fast path por instancia. En serverless cada instancia tiene su propio Map,
// así que el límite real entre instancias lo aplica el check contra usage_logs.
const requestMap = new Map<string, { count: number; resetAt: number }>();

export async function checkRateLimit(
  userId: string,
  maxPerMinute = 10
): Promise<{ ok: boolean; retryAfter?: number }> {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const entry = requestMap.get(userId);

  if (!entry || now > entry.resetAt) {
    requestMap.set(userId, { count: 1, resetAt: now + windowMs });
  } else if (entry.count >= maxPerMinute) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  } else {
    entry.count += 1;
  }

  try {
    const supabase = await createAdminClient();
    const { count } = await supabase
      .from("usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gt("credits_spent", 0)
      .gte("created_at", new Date(now - windowMs).toISOString());

    if ((count ?? 0) >= maxPerMinute) {
      return { ok: false, retryAfter: 60 };
    }
  } catch {
    // Si el check en DB falla, dejamos pasar: el fast path y los créditos siguen limitando.
  }

  return { ok: true };
}
