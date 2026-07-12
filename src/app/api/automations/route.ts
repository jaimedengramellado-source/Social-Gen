import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_AUTOMATIONS = 10;
const VALID_THRESHOLDS = [100, 500, 1000, 5000, 10000, 50000, 100000];

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { data, error } = await supabase
    .from("post_automations")
    .select("*")
    .eq("user_id", user.id)
    .order("threshold");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  if (process.env.ENABLE_AUTOMATIONS !== "true") {
    return NextResponse.json({ error: "Las automatizaciones aún no están disponibles." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await request.json();
  const threshold = Number(body.threshold);
  if (!VALID_THRESHOLDS.includes(threshold)) {
    return NextResponse.json({ error: "Umbral inválido." }, { status: 400 });
  }

  const { count } = await supabase
    .from("post_automations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= MAX_AUTOMATIONS) {
    return NextResponse.json({ error: `Máximo ${MAX_AUTOMATIONS} automatizaciones.` }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("post_automations")
    .insert({
      user_id: user.id,
      platform: "youtube",
      trigger: "views_milestone",
      threshold,
      action: "email",
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
