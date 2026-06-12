import { createAdminClient } from "@/lib/supabase/server";
import { CREDIT_COSTS, CreditAction } from "@/types";

export async function checkAndDeductCredits(
  userId: string,
  action: CreditAction
): Promise<{ ok: boolean; creditsRemaining?: number; error?: string }> {
  const cost = CREDIT_COSTS[action];
  const supabase = await createAdminClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("credits_remaining")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    return { ok: false, error: "PROFILE_NOT_FOUND" };
  }

  // -1 = unlimited (dev/test mode)
  if (profile.credits_remaining === -1) {
    return { ok: true, creditsRemaining: -1 };
  }

  if (profile.credits_remaining < cost) {
    return { ok: false, error: "NO_CREDITS", creditsRemaining: profile.credits_remaining };
  }

  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update({ credits_remaining: profile.credits_remaining - cost })
    .eq("id", userId)
    .select("credits_remaining")
    .single();

  if (updateError || !updated) {
    return { ok: false, error: "UPDATE_FAILED" };
  }

  await supabase.from("usage_logs").insert({
    user_id: userId,
    action,
    credits_spent: cost,
    metadata: {},
  });

  return { ok: true, creditsRemaining: updated.credits_remaining };
}

export function getCreditCost(action: CreditAction): number {
  return CREDIT_COSTS[action];
}
