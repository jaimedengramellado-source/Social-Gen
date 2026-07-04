import { createAdminClient } from "@/lib/supabase/server";
import { CREDIT_COSTS, CreditAction } from "@/types";

export async function checkAndDeductCredits(
  userId: string,
  action: CreditAction
): Promise<{ ok: boolean; creditsRemaining?: number; error?: string; logId?: string }> {
  const cost = CREDIT_COSTS[action];
  const supabase = await createAdminClient();

  const { data, error } = await supabase.rpc("deduct_credits", {
    p_user_id: userId,
    p_amount: cost,
  });

  if (error) {
    return { ok: false, error: "UPDATE_FAILED" };
  }

  // La RPC devuelve null tanto si el perfil no existe como si no hay saldo
  if (data === null) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("credits_remaining")
      .eq("id", userId)
      .single();
    if (!profile) return { ok: false, error: "PROFILE_NOT_FOUND" };
    return { ok: false, error: "NO_CREDITS", creditsRemaining: profile.credits_remaining };
  }

  const { data: log } = await supabase
    .from("usage_logs")
    .insert({
      user_id: userId,
      action,
      credits_spent: cost,
      metadata: {},
    })
    .select("id")
    .single();

  return { ok: true, creditsRemaining: data as number, logId: log?.id };
}

export interface TokenUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

// Adjunta el consumo real de tokens al registro del cobro. Sirve para calibrar
// los precios en créditos por acción con datos reales (coste medio y P95).
export async function recordTokenUsage(
  logId: string | undefined,
  model: string,
  usage: TokenUsage | undefined
): Promise<void> {
  if (!logId || !usage) return;
  try {
    const supabase = await createAdminClient();
    await supabase
      .from("usage_logs")
      .update({
        metadata: {
          model,
          input_tokens: usage.input_tokens ?? 0,
          output_tokens: usage.output_tokens ?? 0,
          cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
          cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
        },
      })
      .eq("id", logId);
  } catch (err) {
    console.error("recordTokenUsage error:", err);
  }
}

// Devuelve los créditos si la llamada a la IA falló después de cobrar.
export async function refundCredits(userId: string, action: CreditAction): Promise<void> {
  const cost = CREDIT_COSTS[action];
  const supabase = await createAdminClient();
  await supabase.rpc("add_credits", { p_user_id: userId, p_amount: cost });
  await supabase.from("usage_logs").insert({
    user_id: userId,
    action: `refund_${action}`,
    credits_spent: -cost,
    metadata: {},
  });
}

export function getCreditCost(action: CreditAction): number {
  return CREDIT_COSTS[action];
}
