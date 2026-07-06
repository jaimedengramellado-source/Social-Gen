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

  // Idempotencia: Stripe reintenta webhooks; un evento ya procesado no debe repetir abonos.
  const { error: dedupeError } = await supabase
    .from("stripe_events")
    .insert({ id: event.id });
  if (dedupeError) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      if (!userId) break;

      // Legacy credit pack
      if (session.metadata?.type === "credit_pack") {
        const packId = session.metadata.packId;
        const amount = CREDIT_PACK_AMOUNTS[packId] || 0;
        if (amount > 0) {
          await supabase.rpc("add_credits", { p_user_id: userId, p_amount: amount });
        }
        break;
      }

      // Custom credit topup (one-time or first payment of recurring)
      if (
        session.metadata?.type === "credit_topup" ||
        session.metadata?.type === "credit_topup_recurring"
      ) {
        const credits = parseInt(session.metadata.credits || "0", 10);
        if (credits > 0) {
          await supabase.rpc("add_credits", { p_user_id: userId, p_amount: credits });
        }
        // Persist customer ID if not already set
        if (session.customer) {
          await supabase.from("profiles").update({ stripe_customer_id: session.customer as string }).eq("id", userId).is("stripe_customer_id", null);
        }
        break;
      }

      // Plan subscription — first payment
      if (session.subscription) {
        const sub = await getStripeClient().subscriptions.retrieve(session.subscription as string);
        const plan = session.metadata?.plan || "starter";
        const credits = PLAN_CREDITS[plan as keyof typeof PLAN_CREDITS] || 100;

        await supabase.from("profiles").update({
          plan,
          credits_remaining: credits,
          credits_total: credits,
          credits_refreshed_at: new Date().toISOString(),
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: sub.id,
        }).eq("id", userId);
      }
      break;
    }

    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      if (pi.metadata?.type === "credit_topup_instant") {
        const userId = pi.metadata.userId;
        const credits = parseInt(pi.metadata.credits || "0", 10);
        if (userId && credits > 0) {
          await supabase.rpc("add_credits", { p_user_id: userId, p_amount: credits });
        }
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      // Credit topup subscriptions don't affect the user's plan
      if (sub.metadata?.type === "credit_topup_recurring" || sub.metadata?.type === "credit_topup_recurring_instant") break;

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
      // Cancelling a credit topup subscription doesn't reset the user's plan
      if (sub.metadata?.type === "credit_topup_recurring" || sub.metadata?.type === "credit_topup_recurring_instant") break;

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

      // Credit topup subscription renewal — add credits each month.
      // "_instant" subs are created directly (no Checkout), so their first invoice
      // (billing_reason "subscription_create") must be credited here too; the
      // regular "credit_topup_recurring" (Checkout-based) already got its first
      // credit from checkout.session.completed, so only renewals count for those.
      if (sub.metadata?.type === "credit_topup_recurring" || sub.metadata?.type === "credit_topup_recurring_instant") {
        const isInstant = sub.metadata?.type === "credit_topup_recurring_instant";
        if (isInstant || invoice.billing_reason === "subscription_cycle") {
          const credits = parseInt(sub.metadata.credits || "0", 10);
          if (credits > 0) {
            await supabase.rpc("add_credits", { p_user_id: userId, p_amount: credits });
          }
        }
        break;
      }

      // Plan subscription renewal — reset weekly credits
      if (invoice.billing_reason === "subscription_cycle") {
        const priceId = sub.items.data[0]?.price.id;
        const plan = getPlanFromPriceId(priceId) || "starter";
        const credits = PLAN_CREDITS[plan as keyof typeof PLAN_CREDITS] || 100;

        await supabase.from("profiles").update({
          credits_remaining: credits,
          credits_total: credits,
          credits_refreshed_at: new Date().toISOString(),
        }).eq("id", userId);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
