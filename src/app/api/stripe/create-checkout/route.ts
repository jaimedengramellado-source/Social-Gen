import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient, STRIPE_PRICE_IDS, CREDIT_PACK_PRICE_IDS, getTopupCredits } from "@/lib/stripe";
import type { Plan } from "@/types";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json();
  const { plan, billing = "weekly", packId, topup } = body;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, email, onboarding_completed")
    .eq("id", user.id)
    .single();

  const customerOptions = {
    customer: profile?.stripe_customer_id || undefined,
    customer_email: !profile?.stripe_customer_id ? (profile?.email || user.email || undefined) : undefined,
  };

  // Legacy credit pack purchase
  if (packId) {
    const priceId = CREDIT_PACK_PRICE_IDS[packId as keyof typeof CREDIT_PACK_PRICE_IDS];
    if (!priceId) {
      return NextResponse.json({ error: "INVALID_PACK" }, { status: 400 });
    }

    const session = await getStripeClient().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      ...customerOptions,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId: user.id, type: "credit_pack", packId },
      success_url: `${appUrl}/ajustes?topup=success`,
      cancel_url: `${appUrl}/ajustes`,
    });

    return NextResponse.json({ url: session.url });
  }

  // Custom credit topup (one-time or recurring)
  if (topup) {
    const amountNum = Math.round(Number(topup.amount));
    const recurring = Boolean(topup.recurring);

    if (!Number.isFinite(amountNum) || amountNum < 5 || amountNum > 500) {
      return NextResponse.json({ error: "INVALID_AMOUNT" }, { status: 400 });
    }

    const amountCents = amountNum * 100;
    const credits = getTopupCredits(amountNum);
    const productName = `${credits} créditos — Social Gen`;

    if (recurring) {
      const session = await getStripeClient().checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        ...customerOptions,
        line_items: [{
          price_data: {
            currency: "eur",
            product_data: { name: productName },
            unit_amount: amountCents,
            recurring: { interval: "month" },
          },
          quantity: 1,
        }],
        metadata: { userId: user.id, type: "credit_topup_recurring", credits: String(credits) },
        subscription_data: {
          metadata: { userId: user.id, type: "credit_topup_recurring", credits: String(credits) },
        },
        success_url: `${appUrl}/ajustes?topup=success`,
        cancel_url: `${appUrl}/ajustes`,
      });
      return NextResponse.json({ url: session.url });
    } else {
      const session = await getStripeClient().checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        ...customerOptions,
        line_items: [{
          price_data: {
            currency: "eur",
            product_data: { name: productName },
            unit_amount: amountCents,
          },
          quantity: 1,
        }],
        metadata: { userId: user.id, type: "credit_topup", credits: String(credits) },
        success_url: `${appUrl}/ajustes?topup=success`,
        cancel_url: `${appUrl}/ajustes`,
      });
      return NextResponse.json({ url: session.url });
    }
  }

  // Plan subscription
  const planPrices = STRIPE_PRICE_IDS[plan as Plan];
  if (!planPrices || !planPrices[billing as "weekly" | "annual"]) {
    return NextResponse.json({ error: "INVALID_PLAN" }, { status: 400 });
  }

  const priceId = planPrices[billing as "weekly" | "annual"];

  const session = await getStripeClient().checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    ...customerOptions,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { userId: user.id, plan, billing },
    subscription_data: { metadata: { userId: user.id, plan } },
    success_url: profile?.onboarding_completed
      ? `${appUrl}/dashboard?payment=success`
      : `${appUrl}/onboarding?payment=success`,
    cancel_url: `${appUrl}/pricing`,
  });

  return NextResponse.json({ url: session.url });
}
