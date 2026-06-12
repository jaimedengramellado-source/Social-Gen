import { NextRequest, NextResponse } from "next/server";
import { getStripeClient, getPlanFromPriceId, CREDIT_PACK_AMOUNTS } from "@/lib/stripe";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { PLAN_CREDITS } from "@/types";
import type Stripe from "stripe";

function getAdminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Webhook signature error:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = getAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      if (!userId) break;

      if (session.metadata?.type === "credit_pack") {
        const packId = session.metadata.packId;
        const amount = CREDIT_PACK_AMOUNTS[packId] || 0;
        const { data: profile } = await supabase
          .from("profiles")
          .select("credits_remaining")
          .eq("id", userId)
          .single();

        if (profile) {
          await supabase
            .from("profiles")
            .update({ credits_remaining: profile.credits_remaining + amount })
            .eq("id", userId);
        }
        break;
      }

      if (session.subscription) {
        const sub = await getStripeClient().subscriptions.retrieve(session.subscription as string);
        const plan = session.metadata?.plan || "starter";
        const credits = PLAN_CREDITS[plan as keyof typeof PLAN_CREDITS] || 100;

        await supabase.from("profiles").update({
          plan,
          credits_remaining: credits,
          credits_total: credits,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: sub.id,
        }).eq("id", userId);
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      if (!userId) break;

      const priceId = sub.items.data[0]?.price.id;
      const plan = getPlanFromPriceId(priceId) || "starter";
      const credits = PLAN_CREDITS[plan as keyof typeof PLAN_CREDITS] || 100;
      const isActive = sub.status === "active" || sub.status === "trialing";

      await supabase.from("profiles").update({
        plan: isActive ? plan : "free",
        stripe_subscription_id: sub.id,
        ...(isActive ? { credits_total: credits } : { credits_remaining: 10, credits_total: 10 }),
      }).eq("id", userId);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.userId;
      if (!userId) break;

      await supabase.from("profiles").update({
        plan: "free",
        credits_remaining: 10,
        credits_total: 10,
        stripe_subscription_id: null,
      }).eq("id", userId);
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice & {
        subscription?: string | null;
        billing_reason?: string;
      };
      if (!invoice.subscription) break;

      const sub = await getStripeClient().subscriptions.retrieve(invoice.subscription as string);
      const userId = sub.metadata?.userId;
      if (!userId) break;

      // Only reset credits on renewal (not on first payment)
      if (invoice.billing_reason === "subscription_cycle") {
        const priceId = sub.items.data[0]?.price.id;
        const plan = getPlanFromPriceId(priceId) || "starter";
        const credits = PLAN_CREDITS[plan as keyof typeof PLAN_CREDITS] || 100;

        await supabase.from("profiles").update({
          credits_remaining: credits,
          credits_total: credits,
        }).eq("id", userId);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
