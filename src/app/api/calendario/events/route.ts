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
    .gte("start_time", `${start}T00:00:00`)
    .lte("start_time", `${end}T23:59:59`)
    .order("start_time");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await request.json();
  const {
    title,
    description,
    start_time,
    end_time,
    color,
    scheduled_at,
    remind_before_minutes,
    remind_times,
    script_id,
  } = body;

  const effectiveStartTime = start_time ?? scheduled_at;
  const effectiveScheduledAt = scheduled_at ?? start_time;

  if (!title || !effectiveStartTime) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("calendar_events")
    .insert({
      user_id: user.id,
      title,
      description: description ?? null,
      start_time: effectiveStartTime,
      end_time: end_time ?? null,
      color: color ?? "#1a73e8",
      scheduled_at: effectiveScheduledAt,
      remind_before_minutes: remind_before_minutes ?? null,
      remind_times: remind_times ?? [],
      sent_reminder_offsets: [],
      script_id: script_id ?? null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
