import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { PLAN_CREDITS, Plan } from "@/types";

// Recarga semanal de créditos. Los planes de pago con cobro semanal ya se recargan
// vía webhook de Stripe (invoice.payment_succeeded); este cron cubre el plan free y
// las suscripciones anuales, cuya factura solo llega una vez al año.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const refreshedAt = new Date().toISOString();
  const results: Record<string, number> = {};

  for (const [plan, credits] of Object.entries(PLAN_CREDITS) as [Plan, number][]) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update({
        credits_remaining: credits,
        credits_total: credits,
        credits_refreshed_at: refreshedAt,
      })
      .eq("plan", plan)
      .neq("credits_remaining", -1)
      .lt("credits_refreshed_at", cutoff)
      .select("id");

    if (error) {
      console.error(`[refill-credits] error en plan ${plan}:`, error.message);
      continue;
    }
    results[plan] = data?.length ?? 0;
  }

  return NextResponse.json({ refreshed: results });
}
