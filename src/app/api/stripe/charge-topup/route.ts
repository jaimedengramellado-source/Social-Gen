import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient, getTopupCredits } from "@/lib/stripe";

// Cobro instantáneo de topup con la tarjeta guardada del cliente (sin pasar por Checkout).
// Si el usuario no tiene tarjeta guardada, requiere 3DS o el cargo falla, el frontend
// cae de vuelta al flujo de Checkout hospedado (/api/stripe/create-checkout).
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { amount, recurring } = await request.json();
  const amountNum = Math.round(Number(amount));

  if (!Number.isFinite(amountNum) || amountNum < 5 || amountNum > 500) {
    return NextResponse.json({ error: "INVALID_AMOUNT" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ instant: false, reason: "NO_SAVED_CARD" });
  }

  const stripe = getStripeClient();
  const customerId = profile.stripe_customer_id;

  let paymentMethodId: string | null = null;
  const customer = await stripe.customers.retrieve(customerId);
  if (!("deleted" in customer && customer.deleted)) {
    paymentMethodId = (customer.invoice_settings?.default_payment_method as string | null) ?? null;
  }
  if (!paymentMethodId) {
    const pms = await stripe.paymentMethods.list({ customer: customerId, type: "card", limit: 1 });
    paymentMethodId = pms.data[0]?.id ?? null;
  }

  if (!paymentMethodId) {
    return NextResponse.json({ instant: false, reason: "NO_SAVED_CARD" });
  }

  const credits = getTopupCredits(amountNum);
  const amountCents = amountNum * 100;

  try {
    if (recurring) {
      // Las suscripciones no admiten product_data inline (a diferencia de Checkout/PaymentIntents):
      // hace falta un Price real, así que reutilizamos un Product estable (idempotente) y creamos
      // un Price nuevo para este importe.
      const product = await stripe.products.create(
        { name: "Créditos — Social Flamingo" },
        { idempotencyKey: "credit-topup-product-v1" }
      );
      const price = await stripe.prices.create({
        currency: "eur",
        unit_amount: amountCents,
        recurring: { interval: "month" },
        product: product.id,
      });
      await stripe.subscriptions.create({
        customer: customerId,
        default_payment_method: paymentMethodId,
        items: [{ price: price.id }],
        metadata: { userId: user.id, type: "credit_topup_recurring_instant", credits: String(credits) },
        payment_behavior: "error_if_incomplete",
      });
    } else {
      await stripe.paymentIntents.create({
        amount: amountCents,
        currency: "eur",
        customer: customerId,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        metadata: { userId: user.id, type: "credit_topup_instant", credits: String(credits) },
      });
    }
    return NextResponse.json({ instant: true, credits });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "authentication_required") {
      return NextResponse.json({ instant: false, reason: "REQUIRES_ACTION" });
    }
    return NextResponse.json({ instant: false, reason: "CARD_DECLINED" });
  }
}
