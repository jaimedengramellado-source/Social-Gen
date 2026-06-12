import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const start = request.nextUrl.searchParams.get("start");
  const end = request.nextUrl.searchParams.get("end");
  if (!start || !end) return NextResponse.json({ error: "MISSING_PARAMS" }, { status: 400 });

  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("user_id", user.id)
    .gte("scheduled_at", `${start}T00:00:00`)
    .lte("scheduled_at", `${end}T23:59:59`)
    .order("scheduled_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await request.json();
  const { title, description, scheduled_at, remind_before_minutes, script_id } = body;
  if (!title || !scheduled_at) return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });

  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      user_id: user.id,
      title,
      description: description ?? null,
      scheduled_at,
      remind_before_minutes: remind_before_minutes ?? null,
      script_id: script_id ?? null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
