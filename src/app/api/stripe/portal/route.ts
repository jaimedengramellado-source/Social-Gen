import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: "NO_CUSTOMER" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const { flow, returnTab } = await request
    .json()
    .catch(() => ({} as { flow?: string; returnTab?: string }));
  const returnUrl = returnTab === "facturacion" ? `${appUrl}/ajustes?tab=facturacion` : `${appUrl}/ajustes`;

  const session = await getStripeClient().billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: returnUrl,
    ...(flow === "payment_method_update"
      ? {
          flow_data: {
            type: "payment_method_update" as const,
            after_completion: {
              type: "redirect" as const,
              redirect: { return_url: `${appUrl}/ajustes?card=updated` },
            },
          },
        }
      : {}),
  });

  return NextResponse.json({ url: session.url });
}
