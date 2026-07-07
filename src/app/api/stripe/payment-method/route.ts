import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient, Stripe } from "@/lib/stripe";

// Devuelve un resumen de la tarjeta guardada del usuario: default del customer,
// si no la de su suscripción activa, si no la primera tarjeta adjunta.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ card: null });
  }

  const stripe = getStripeClient();
  let pm: Stripe.PaymentMethod | null = null;

  try {
    const customer = await stripe.customers.retrieve(profile.stripe_customer_id, {
      expand: ["invoice_settings.default_payment_method"],
    });
    if (!("deleted" in customer && customer.deleted)) {
      const def = customer.invoice_settings?.default_payment_method;
      if (def && typeof def !== "string") pm = def;
    }

    if (!pm && profile.stripe_subscription_id) {
      try {
        const sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id, {
          expand: ["default_payment_method"],
        });
        const def = sub.default_payment_method;
        if (def && typeof def !== "string") pm = def;
      } catch {
        // Suscripción no recuperable: seguimos con el fallback de tarjetas adjuntas.
      }
    }

    if (!pm) {
      const pms = await stripe.paymentMethods.list({
        customer: profile.stripe_customer_id,
        type: "card",
        limit: 1,
      });
      pm = pms.data[0] ?? null;
    }
  } catch (err) {
    console.error("Error consultando el método de pago en Stripe:", err);
    return NextResponse.json({ card: null });
  }

  if (!pm?.card) {
    return NextResponse.json({ card: null });
  }

  return NextResponse.json({
    card: {
      brand: pm.card.brand,
      last4: pm.card.last4,
      expMonth: pm.card.exp_month,
      expYear: pm.card.exp_year,
    },
  });
}
