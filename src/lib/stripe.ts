import Stripe from "stripe";
import { Plan } from "@/types";

let _stripe: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return _stripe;
}

// Keep backward compat export for webhook route that needs stripe directly
export { Stripe };

export const STRIPE_PRICE_IDS: Record<Plan, { monthly: string; annual: string }> = {
  free: { monthly: "", annual: "" },
  starter: {
    monthly: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID ?? "",
    annual: process.env.STRIPE_STARTER_ANNUAL_PRICE_ID ?? "",
  },
  pro: {
    monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? "",
    annual: process.env.STRIPE_PRO_ANNUAL_PRICE_ID ?? "",
  },
  agency: {
    monthly: process.env.STRIPE_AGENCY_MONTHLY_PRICE_ID ?? "",
    annual: process.env.STRIPE_AGENCY_ANNUAL_PRICE_ID ?? "",
  },
};

export const CREDIT_PACK_PRICE_IDS = {
  pack_50: process.env.STRIPE_PACK_50_PRICE_ID ?? "",
  pack_150: process.env.STRIPE_PACK_150_PRICE_ID ?? "",
  pack_500: process.env.STRIPE_PACK_500_PRICE_ID ?? "",
};

export const CREDIT_PACK_AMOUNTS: Record<string, number> = {
  pack_50: 50,
  pack_150: 150,
  pack_500: 500,
};

export function getPlanFromPriceId(priceId: string): Plan | null {
  for (const [plan, prices] of Object.entries(STRIPE_PRICE_IDS)) {
    if (prices.monthly === priceId || prices.annual === priceId) {
      return plan as Plan;
    }
  }
  return null;
}
