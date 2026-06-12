const requestMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  userId: string,
  maxPerMinute = 10
): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const entry = requestMap.get(userId);

  if (!entry || now > entry.resetAt) {
    requestMap.set(userId, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (entry.count >= maxPerMinute) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  return { ok: true };
}
