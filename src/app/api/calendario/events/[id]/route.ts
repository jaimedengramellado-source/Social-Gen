import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const {
    title,
    description,
    start_time,
    end_time,
    color,
    tag,
    scheduled_at,
    remind_before_minutes,
    remind_times,
    script_id,
  } = body;

  const effectiveStartTime = start_time ?? scheduled_at;
  const effectiveScheduledAt = scheduled_at ?? start_time;

  const { data, error } = await supabase
    .from("calendar_events")
    .update({
      title,
      description: description ?? null,
      start_time: effectiveStartTime,
      end_time: end_time ?? null,
      color: color ?? "#1a73e8",
      tag: tag ?? null,
      scheduled_at: effectiveScheduledAt,
      remind_before_minutes: remind_before_minutes ?? null,
      remind_times: remind_times ?? [],
      // Reset sent offsets whenever reminders are changed, so cron re-fires
      sent_reminder_offsets: [],
      reminder_sent: false,
      script_id: script_id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { id } = await params;
  const { error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
