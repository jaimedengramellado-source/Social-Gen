import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient, STRIPE_PRICE_IDS, CREDIT_PACK_PRICE_IDS } from "@/lib/stripe";
import type { Plan } from "@/types";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json();
  const { plan, billing = "monthly", packId } = body;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Credit pack purchase
  if (packId) {
    const priceId = CREDIT_PACK_PRICE_IDS[packId as keyof typeof CREDIT_PACK_PRICE_IDS];
    if (!priceId) {
      return NextResponse.json({ error: "INVALID_PACK" }, { status: 400 });
    }

    const session = await getStripeClient().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId: user.id, type: "credit_pack", packId },
      success_url: `${appUrl}/dashboard?payment=success`,
      cancel_url: `${appUrl}/pricing`,
    });

    return NextResponse.json({ url: session.url });
  }

  // Subscription
  const planPrices = STRIPE_PRICE_IDS[plan as Plan];
  if (!planPrices || !planPrices[billing as "monthly" | "annual"]) {
    return NextResponse.json({ error: "INVALID_PLAN" }, { status: 400 });
  }

  const priceId = planPrices[billing as "monthly" | "annual"];

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, email")
    .eq("id", user.id)
    .single();

  const session = await getStripeClient().checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer: profile?.stripe_customer_id || undefined,
    customer_email: !profile?.stripe_customer_id ? (profile?.email || user.email) : undefined,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { userId: user.id, plan, billing },
    subscription_data: { metadata: { userId: user.id, plan } },
    success_url: `${appUrl}/dashboard?payment=success`,
    cancel_url: `${appUrl}/pricing`,
  });

  return NextResponse.json({ url: session.url });
}
