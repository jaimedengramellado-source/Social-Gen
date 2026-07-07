import { NextRequest, NextResponse } from "next/server";
import { getStripeClient, getPlanFromPriceId, CREDIT_PACK_AMOUNTS } from "@/lib/stripe";
import { createClient as createSupabaseAdmin, SupabaseClient } from "@supabase/supabase-js";
import { PLAN_CREDITS, Plan } from "@/types";
import { sendEmail, emailLayout } from "@/lib/email";
import type Stripe from "stripe";

const PLAN_LABELS: Record<Plan, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  agency: "Agency",
};

function getAdminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getUserEmail(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("email").eq("id", userId).single();
  return data?.email ?? null;
}

// En versiones de API ≥2025-03-31 el campo `invoice.subscription` no existe: la referencia
// vive en `invoice.parent.subscription_details.subscription`. El payload del webhook usa la
// versión configurada en el endpoint, así que soportamos ambas formas.
function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const legacy = (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }).subscription;
  const raw = invoice.parent?.subscription_details?.subscription ?? legacy ?? null;
  if (!raw) return null;
  return typeof raw === "string" ? raw : raw.id;
}

// Un evento de una suscripción que ya no es la vigente del perfil (p. ej. la antigua
// cancelada tras un upgrade) no debe tocar el plan del usuario.
async function isCurrentSubscription(supabase: SupabaseClient, userId: string, subId: string): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("stripe_subscription_id")
    .eq("id", userId)
    .single();
  return !data?.stripe_subscription_id || data.stripe_subscription_id === subId;
}

// Checkout liga la tarjeta al PaymentIntent o a la suscripción, no al cliente. Guardarla
// como default del customer la hace visible en Facturación y reutilizable (recarga
// instantánea, cobros futuros). Con force solo se pisa el default existente cuando el
// pago es de un plan: esa es "la tarjeta" del usuario a partir de ese momento.
async function setCustomerDefaultPaymentMethod(session: Stripe.Checkout.Session, force: boolean) {
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (!customerId) return;
  const stripe = getStripeClient();
  try {
    if (!force) {
      const customer = await stripe.customers.retrieve(customerId);
      if (!("deleted" in customer && customer.deleted) && customer.invoice_settings?.default_payment_method) return;
    }
    let pmId: string | null = null;
    if (session.payment_intent) {
      const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string);
      pmId = typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method?.id ?? null;
    } else if (session.subscription) {
      const sub = await stripe.subscriptions.retrieve(session.subscription as string);
      pmId = typeof sub.default_payment_method === "string" ? sub.default_payment_method : sub.default_payment_method?.id ?? null;
    }
    if (pmId) {
      await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: pmId } });
    }
  } catch (err) {
    console.error("Webhook: error guardando la tarjeta como default del cliente:", err);
  }
}

async function sendCreditsEmail(to: string, credits: number, heading: string, subject: string) {
  await sendEmail(
    to,
    subject,
    emailLayout({
      emoji: "💳",
      heading,
      bodyHtml: `<p style="margin:0">Se han añadido <strong>${credits} créditos</strong> a tu cuenta.</p>`,
      ctaHref: `${process.env.NEXT_PUBLIC_APP_URL}/crear`,
      ctaLabel: "Empezar a crear →",
    })
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

      const sessionEmail = session.customer_details?.email ?? null;

      // Legacy credit pack
      if (session.metadata?.type === "credit_pack") {
        const packId = session.metadata.packId;
        const amount = CREDIT_PACK_AMOUNTS[packId] || 0;
        if (amount > 0) {
          await supabase.rpc("add_credits", { p_user_id: userId, p_amount: amount });
          const to = sessionEmail ?? (await getUserEmail(supabase, userId));
          if (to) await sendCreditsEmail(to, amount, "Recarga completada", "💳 Recarga de créditos confirmada");
        }
        if (session.customer) {
          await supabase.from("profiles").update({ stripe_customer_id: session.customer as string }).eq("id", userId).is("stripe_customer_id", null);
        }
        await setCustomerDefaultPaymentMethod(session, false);
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
          const to = sessionEmail ?? (await getUserEmail(supabase, userId));
          if (to) await sendCreditsEmail(to, credits, "Recarga completada", "💳 Recarga de créditos confirmada");
        }
        // Persist customer ID if not already set
        if (session.customer) {
          await supabase.from("profiles").update({ stripe_customer_id: session.customer as string }).eq("id", userId).is("stripe_customer_id", null);
        }
        await setCustomerDefaultPaymentMethod(session, false);
        break;
      }

      // Plan subscription — first payment
      if (session.subscription) {
        const sub = await getStripeClient().subscriptions.retrieve(session.subscription as string);
        const plan = (session.metadata?.plan || "starter") as Plan;
        const credits = PLAN_CREDITS[plan] || 100;

        await supabase.from("profiles").update({
          plan,
          credits_remaining: credits,
          credits_total: credits,
          credits_refreshed_at: new Date().toISOString(),
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: sub.id,
        }).eq("id", userId);

        await setCustomerDefaultPaymentMethod(session, true);

        // Un upgrade/downgrade crea una suscripción nueva en Checkout: cancela las demás
        // suscripciones de plan del cliente para que no se cobren dos a la vez. Las de
        // recarga de créditos (metadata type credit_topup_*) no se tocan.
        try {
          const stripe = getStripeClient();
          const existing = await stripe.subscriptions.list({
            customer: session.customer as string,
            status: "all",
            limit: 100,
          });
          for (const other of existing.data) {
            const isTopup = other.metadata?.type?.startsWith("credit_topup");
            if (
              other.id !== sub.id &&
              !isTopup &&
              other.status !== "canceled" &&
              other.status !== "incomplete_expired"
            ) {
              await stripe.subscriptions.cancel(other.id);
            }
          }
        } catch (err) {
          console.error("Webhook: error cancelando suscripciones de plan antiguas:", err);
        }

        const to = sessionEmail ?? (await getUserEmail(supabase, userId));
        if (to) {
          await sendEmail(
            to,
            "🎉 Tu plan está activo",
            emailLayout({
              emoji: "🎉",
              heading: `¡Bienvenido al plan ${PLAN_LABELS[plan]}!`,
              bodyHtml: `<p style="margin:0">Tu suscripción está activa. Tienes <strong>${credits} créditos</strong> disponibles.</p>`,
              ctaHref: `${process.env.NEXT_PUBLIC_APP_URL}/crear`,
              ctaLabel: "Empezar a crear →",
            })
          );
        }
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
          const to = pi.receipt_email ?? (await getUserEmail(supabase, userId));
          if (to) await sendCreditsEmail(to, credits, "Recarga completada", "💳 Recarga de créditos confirmada");
        }
      }
      break;
    }

    case "customer.updated": {
      const customer = event.data.object as Stripe.Customer;
      const prev = event.data.previous_attributes as Partial<Stripe.Customer> | undefined;
      // Solo interesa el cambio de tarjeta por defecto (p. ej. desde el portal de Stripe).
      // Las suscripciones creadas por Checkout fijan su propia tarjeta, que prevalece sobre
      // la del customer: sin esta sincronización, el cobro semanal seguiría usando la antigua.
      if (!prev || !("invoice_settings" in prev)) break;

      const rawDefault = customer.invoice_settings?.default_payment_method;
      const pmId = typeof rawDefault === "string" ? rawDefault : rawDefault?.id ?? null;
      if (!pmId) break;

      const stripe = getStripeClient();
      try {
        const subs = await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 100 });
        for (const sub of subs.data) {
          if (!["active", "trialing", "past_due"].includes(sub.status)) continue;
          const currentPm = typeof sub.default_payment_method === "string"
            ? sub.default_payment_method
            : sub.default_payment_method?.id ?? null;
          if (currentPm === pmId) continue;
          try {
            await stripe.subscriptions.update(sub.id, { default_payment_method: pmId });
          } catch (err) {
            console.error(`Webhook: error actualizando la tarjeta de la suscripción ${sub.id}:`, err);
          }
        }
      } catch (err) {
        console.error("Webhook: error propagando la nueva tarjeta a las suscripciones:", err);
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      // Credit topup subscriptions don't affect the user's plan
      if (sub.metadata?.type === "credit_topup_recurring" || sub.metadata?.type === "credit_topup_recurring_instant") break;

      const userId = sub.metadata?.userId;
      if (!userId) break;
      if (!(await isCurrentSubscription(supabase, userId, sub.id))) break;

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
      if (!(await isCurrentSubscription(supabase, userId, sub.id))) break;

      await supabase.from("profiles").update({
        plan: "free",
        credits_remaining: 10,
        credits_total: 10,
        stripe_subscription_id: null,
      }).eq("id", userId);

      const cancelledPlan = getPlanFromPriceId(sub.items.data[0]?.price.id ?? "");
      const to = await getUserEmail(supabase, userId);
      if (to) {
        await sendEmail(
          to,
          "Tu plan se ha cancelado",
          emailLayout({
            emoji: "👋",
            heading: cancelledPlan
              ? `Tu plan ${PLAN_LABELS[cancelledPlan]} se ha cancelado`
              : "Tu plan se ha cancelado",
            bodyHtml: `<p style="margin:0 0 8px">Tu suscripción ha terminado y no se te harán más cobros.</p><p style="margin:0">Sigues en el plan Free con <strong>10 créditos a la semana</strong>. Puedes reactivar tu plan cuando quieras.</p>`,
            ctaHref: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
            ctaLabel: "Reactivar mi plan →",
          })
        );
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = getInvoiceSubscriptionId(invoice);
      if (!subscriptionId) break;

      // Stripe reintenta el cobro varias veces (Smart Retries) y emite este evento en
      // cada intento: avisamos solo en el primero para no bombardear al usuario. La
      // cancelación definitiva ya tiene su email en customer.subscription.deleted.
      if ((invoice.attempt_count ?? 0) > 1) break;

      const sub = await getStripeClient().subscriptions.retrieve(subscriptionId);
      const userId = sub.metadata?.userId;
      if (!userId) break;

      const isTopup =
        sub.metadata?.type === "credit_topup_recurring" ||
        sub.metadata?.type === "credit_topup_recurring_instant";
      if (!isTopup && !(await isCurrentSubscription(supabase, userId, sub.id))) break;

      const amount = `${(invoice.amount_due / 100).toFixed(2).replace(".", ",")}€`;
      const plan = getPlanFromPriceId(sub.items.data[0]?.price.id ?? "");
      const heading = isTopup
        ? "No pudimos procesar tu recarga automática"
        : plan
        ? `No pudimos cobrar tu plan ${PLAN_LABELS[plan]}`
        : "No pudimos cobrar tu plan";

      const to = invoice.customer_email ?? (await getUserEmail(supabase, userId));
      if (to) {
        await sendEmail(
          to,
          "⚠️ Problema con tu pago",
          emailLayout({
            emoji: "💳",
            heading,
            bodyHtml: `<p style="margin:0 0 8px">El cobro de <strong>${amount}</strong> ha fallado. Volveremos a intentarlo automáticamente en los próximos días.</p><p style="margin:0">Para ${isTopup ? "seguir recibiendo tus créditos" : "no perder tu plan y tus créditos"}, comprueba que tu tarjeta esté al día.</p>`,
            ctaHref: `${process.env.NEXT_PUBLIC_APP_URL}/ajustes?tab=facturacion`,
            ctaLabel: "Actualizar mi tarjeta →",
          })
        );
      }
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = getInvoiceSubscriptionId(invoice);
      if (!subscriptionId) break;

      const sub = await getStripeClient().subscriptions.retrieve(subscriptionId);
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
            const to = invoice.customer_email ?? (await getUserEmail(supabase, userId));
            if (to) await sendCreditsEmail(to, credits, "Recarga automática completada", "🔄 Recarga de créditos confirmada");
          }
        }
        break;
      }

      // Plan subscription renewal — reset weekly credits
      if (invoice.billing_reason === "subscription_cycle") {
        if (!(await isCurrentSubscription(supabase, userId, sub.id))) break;
        const priceId = sub.items.data[0]?.price.id;
        const plan = (getPlanFromPriceId(priceId) || "starter") as Plan;
        const credits = PLAN_CREDITS[plan] || 100;

        const { data: profile } = await supabase
          .from("profiles")
          .select("email, plan_renewal_email_sent_at")
          .eq("id", userId)
          .single();

        await supabase.from("profiles").update({
          credits_remaining: credits,
          credits_total: credits,
          credits_refreshed_at: new Date().toISOString(),
        }).eq("id", userId);

        // El plan se renueva cada semana (créditos incluidos), pero el aviso por
        // email solo se manda cada ~2 meses para no saturar al usuario.
        const RENEWAL_EMAIL_INTERVAL_MS = 60 * 24 * 60 * 60 * 1000;
        const lastSent = profile?.plan_renewal_email_sent_at
          ? new Date(profile.plan_renewal_email_sent_at).getTime()
          : 0;

        if (Date.now() - lastSent >= RENEWAL_EMAIL_INTERVAL_MS) {
          const to = invoice.customer_email ?? profile?.email ?? null;
          if (to) {
            await sendEmail(
              to,
              "🔄 Tu plan se ha renovado",
              emailLayout({
                emoji: "🔄",
                heading: `Tu plan ${PLAN_LABELS[plan]} se ha renovado`,
                bodyHtml: `<p style="margin:0">Tus créditos se han actualizado a <strong>${credits}</strong> para este ciclo.</p>`,
                ctaHref: `${process.env.NEXT_PUBLIC_APP_URL}/crear`,
                ctaLabel: "Empezar a crear →",
              })
            );
            await supabase
              .from("profiles")
              .update({ plan_renewal_email_sent_at: new Date().toISOString() })
              .eq("id", userId);
          }
        }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
