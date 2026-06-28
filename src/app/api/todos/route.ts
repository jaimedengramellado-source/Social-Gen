import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const filter = request.nextUrl.searchParams.get("filter") ?? "all";
  let query = supabase.from("todos").select("*").eq("user_id", user.id);
  if (filter === "pending") query = query.eq("completed", false);
  if (filter === "completed") query = query.eq("completed", true);
  query = query.order("completed").order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { title, urgency, importance, due_date, category, parent_id } = await request.json();
  if (!title?.trim()) return NextResponse.json({ error: "MISSING_TITLE" }, { status: 400 });

  const { data, error } = await supabase.from("todos").insert({
    user_id: user.id,
    title: title.trim(),
    urgency: urgency ?? "media",
    importance: importance ?? "normal",
    due_date: due_date ?? null,
    category: category?.trim() || null,
    parent_id: parent_id ?? null,
  }).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
