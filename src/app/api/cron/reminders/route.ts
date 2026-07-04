import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[reminders] RESEND_API_KEY not set — skipping email to ${to}: ${subject}`);
    return;
  }
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL ?? "ViralCraft <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });
}

function offsetLabel(mins: number): string {
  if (mins < 60) return `${mins} min`;
  if (mins < 1440) return `${Math.round(mins / 60)} h`;
  const days = Math.round(mins / 1440);
  return `${days} día${days !== 1 ? "s" : ""}`;
}

export async function GET(request: NextRequest) {
  // Fail closed: sin CRON_SECRET configurado el endpoint queda cerrado
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch events within a generous window: 2 days in the past (late cron runs) to 1 year ahead
  const { data: allEvents, error } = await supabaseAdmin
    .from("calendar_events")
    .select("*")
    .gte("start_time", new Date(Date.now() - 2 * 86_400_000).toISOString())
    .lte("start_time", new Date(Date.now() + 366 * 86_400_000).toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  type DueItem = { ev: Record<string, unknown>; offsets: number[]; isLegacy: boolean };
  const due: DueItem[] = [];

  for (const ev of allEvents ?? []) {
    const eventTimeMs = new Date(ev.start_time as string).getTime();
    const remindTimes: number[] = Array.isArray(ev.remind_times) ? (ev.remind_times as number[]) : [];
    const sentOffsets: number[] = Array.isArray(ev.sent_reminder_offsets)
      ? (ev.sent_reminder_offsets as number[])
      : [];

    if (remindTimes.length > 0) {
      // New-style: remind_times array, track per-offset delivery in sent_reminder_offsets
      const dueOffsets = remindTimes.filter(
        (offset) => !sentOffsets.includes(offset) && eventTimeMs - offset * 60_000 <= now
      );
      if (dueOffsets.length > 0) due.push({ ev, offsets: dueOffsets, isLegacy: false });
    } else if (ev.remind_before_minutes != null && !ev.reminder_sent) {
      // Legacy: single remind_before_minutes with boolean reminder_sent flag
      const fireAt =
        new Date((ev.scheduled_at ?? ev.start_time) as string).getTime() -
        (ev.remind_before_minutes as number) * 60_000;
      if (fireAt <= now) {
        due.push({ ev, offsets: [ev.remind_before_minutes as number], isLegacy: true });
      }
    }
  }

  if (due.length === 0) return NextResponse.json({ sent: 0 });

  // Batch-fetch emails for affected users
  const userIds = [...new Set(due.map(({ ev }) => ev.user_id as string))];
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, email")
    .in("id", userIds);
  const emailMap = Object.fromEntries(
    (profiles ?? []).map((p: { id: string; email: string }) => [p.id, p.email])
  );

  let sent = 0;
  for (const { ev, offsets, isLegacy } of due) {
    const email = emailMap[ev.user_id as string];
    if (!email) continue;

    const eventTime = new Date((ev.start_time ?? ev.scheduled_at) as string);
    const when = eventTime.toLocaleString("es-ES", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

    const reminderNote =
      offsets.length === 1
        ? `Este aviso se envió ${offsetLabel(offsets[0])} antes del evento.`
        : `Avisos enviados: ${offsets.map(offsetLabel).join(", ")} antes del evento.`;

    await sendEmail(
      email,
      `⏰ Recordatorio: ${ev.title as string}`,
      `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
          <h2 style="font-size:20px;font-weight:700;margin-bottom:8px">Tienes un evento próximo</h2>
          <div style="background:#f5f3ff;border-radius:12px;padding:20px;margin-bottom:20px">
            <p style="font-size:16px;font-weight:600;margin:0 0 6px">${ev.title as string}</p>
            <p style="color:#6b7280;font-size:14px;margin:0">📅 ${when}</p>
            ${ev.description ? `<p style="color:#374151;font-size:14px;margin:12px 0 0;white-space:pre-line">📝 ${ev.description as string}</p>` : ""}
          </div>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/calendario"
             style="display:inline-block;background:#8C2230;color:white;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600">
            Ver calendario →
          </a>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px">${reminderNote}</p>
          <p style="color:#9ca3af;font-size:12px;margin-top:4px">Social Gen · Gestiona tus avisos en el calendario.</p>
        </div>
      `
    );

    if (isLegacy) {
      await supabaseAdmin
        .from("calendar_events")
        .update({ reminder_sent: true })
        .eq("id", ev.id as string);
    } else {
      const currentSent: number[] = Array.isArray(ev.sent_reminder_offsets)
        ? (ev.sent_reminder_offsets as number[])
        : [];
      await supabaseAdmin
        .from("calendar_events")
        .update({ sent_reminder_offsets: [...new Set([...currentSent, ...offsets])] })
        .eq("id", ev.id as string);
    }
    sent++;
  }

  return NextResponse.json({ sent });
}
