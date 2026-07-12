import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_SNIPPETS = 20;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { data, error } = await supabase
    .from("snippets")
    .select("*")
    .eq("user_id", user.id)
    .order("sort_order")
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!name || !content) {
    return NextResponse.json({ error: "Nombre y contenido son obligatorios." }, { status: 400 });
  }
  if (name.length > 60 || content.length > 1000) {
    return NextResponse.json({ error: "Nombre (máx. 60) o contenido (máx. 1000) demasiado largos." }, { status: 400 });
  }

  const { count } = await supabase
    .from("snippets")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= MAX_SNIPPETS) {
    return NextResponse.json({ error: `Máximo ${MAX_SNIPPETS} firmas.` }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("snippets")
    .insert({ user_id: user.id, name, content, sort_order: count ?? 0 })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
