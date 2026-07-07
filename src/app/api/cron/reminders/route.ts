import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { sendEmail, emailLayout, escapeHtml } from "@/lib/email";

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

  // Ventana: 2 días atrás (cron caído/retrasado) a 3 días adelante — el offset máximo
  // de aviso en la UI es 2 días (2880 min), así que nada más lejano puede estar due.
  const { data: allEvents, error } = await supabaseAdmin
    .from("calendar_events")
    .select("*")
    .gte("start_time", new Date(Date.now() - 2 * 86_400_000).toISOString())
    .lte("start_time", new Date(Date.now() + 3 * 86_400_000).toISOString());

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

  // Un aviso con más de 3h de retraso (cron caído) ya no aporta: se marca como
  // enviado sin mandar email para no avisar de eventos que ya pasaron.
  const STALE_GRACE_MS = 3 * 3_600_000;

  let sent = 0;
  for (const { ev, offsets, isLegacy } of due) {
    const email = emailMap[ev.user_id as string];
    if (!email) continue;

    const eventTime = new Date((ev.start_time ?? ev.scheduled_at) as string);
    const isStale = eventTime.getTime() < now - STALE_GRACE_MS;

    if (!isStale) {
      // El cron corre en UTC; sin timeZone las horas del email saldrían desfasadas 1-2h.
      const when = eventTime.toLocaleString("es-ES", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid",
      });

      const reminderNote =
        offsets.length === 1
          ? `Este aviso se envió ${offsetLabel(offsets[0])} antes del evento.`
          : `Avisos enviados: ${offsets.map(offsetLabel).join(", ")} antes del evento.`;

      const delivered = await sendEmail(
        email,
        `⏰ Recordatorio: ${ev.title as string}`,
        emailLayout({
          emoji: "📅",
          heading: escapeHtml(ev.title as string),
          bodyHtml: `
            <p style="color:#6b7280;font-size:14px;margin:0">📅 ${when}</p>
            ${ev.description ? `<p style="margin:12px 0 0;white-space:pre-line">📝 ${escapeHtml(ev.description as string)}</p>` : ""}
          `,
          ctaHref: `${process.env.NEXT_PUBLIC_APP_URL}/calendario`,
          ctaLabel: "Ver calendario →",
          footerNote: reminderNote,
        })
      );
      // Si Resend falla no se marca como enviado: se reintenta en el siguiente cron.
      if (!delivered) continue;
    }

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
    if (!isStale) sent++;
  }

  return NextResponse.json({ sent });
}
