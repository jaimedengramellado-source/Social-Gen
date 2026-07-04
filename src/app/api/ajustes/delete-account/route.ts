import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await createAdminClient();

  // Cancelar todas las suscripciones de Stripe antes de borrar; si no, el cliente
  // seguiría pagando sin cuenta. Si Stripe falla, abortamos el borrado.
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (profile?.stripe_customer_id) {
    try {
      const stripe = getStripeClient();
      const subs = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        status: "all",
        limit: 100,
      });
      for (const sub of subs.data) {
        if (sub.status !== "canceled" && sub.status !== "incomplete_expired") {
          await stripe.subscriptions.cancel(sub.id);
        }
      }
    } catch (err) {
      console.error("delete-account: error cancelando suscripciones de Stripe:", err);
      return NextResponse.json({ error: "STRIPE_CANCEL_FAILED" }, { status: 500 });
    }
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
