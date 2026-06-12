import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
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

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: pending, error } = await supabaseAdmin
    .from("calendar_events")
    .select("*")
    .not("remind_before_minutes", "is", null)
    .eq("reminder_sent", false)
    .lte("scheduled_at", new Date(Date.now() + 366 * 86_400_000).toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  const due = (pending ?? []).filter(ev => {
    const fireAt = new Date(ev.scheduled_at).getTime() - ev.remind_before_minutes * 60_000;
    return fireAt <= now;
  });

  if (due.length === 0) return NextResponse.json({ sent: 0 });

  // Get emails for affected users
  const userIds = [...new Set(due.map((e: { user_id: string }) => e.user_id))];
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, email")
    .in("id", userIds);
  const emailMap = Object.fromEntries((profiles ?? []).map((p: { id: string; email: string }) => [p.id, p.email]));

  let sent = 0;
  for (const ev of due) {
    const email = emailMap[ev.user_id];
    if (!email) continue;

    const when = new Date(ev.scheduled_at).toLocaleString("es-ES", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

    await sendEmail(
      email,
      `⏰ Recordatorio: ${ev.title}`,
      `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
          <h2 style="font-size:20px;font-weight:700;margin-bottom:8px">Tienes un evento próximo</h2>
          <div style="background:#f5f3ff;border-radius:12px;padding:20px;margin-bottom:20px">
            <p style="font-size:16px;font-weight:600;margin:0 0 6px">${ev.title}</p>
            <p style="color:#6b7280;font-size:14px;margin:0">📅 ${when}</p>
            ${ev.description ? `<p style="color:#374151;font-size:14px;margin:12px 0 0;white-space:pre-line">📝 ${ev.description}</p>` : ""}
          </div>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/calendario"
             style="display:inline-block;background:#7C3AED;color:white;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600">
            Ver calendario →
          </a>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px">ViralCraft · Este aviso se envió automáticamente.</p>
        </div>
      `
    );

    await supabaseAdmin.from("calendar_events").update({ reminder_sent: true }).eq("id", ev.id);
    sent++;
  }

  return NextResponse.json({ sent });
}
