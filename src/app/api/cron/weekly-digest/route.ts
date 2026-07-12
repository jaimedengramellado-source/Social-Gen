import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { sendEmail, emailLayout, escapeHtml } from "@/lib/email";

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const WEEK_MS = 7 * 86_400_000;
const STREAK_WEEKS_WINDOW = 26;

type Row = { user_id: string; created_at: string };

function addCount(map: Map<string, number>, userId: string) {
  map.set(userId, (map.get(userId) ?? 0) + 1);
}

// Semanas consecutivas (contando esta) con al menos una creación. La semana
// empieza en lunes, alineada con el envío del digest.
function computeStreak(timestamps: number[], now: number): number {
  if (timestamps.length === 0) return 0;
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // lunes de esta semana
  let weekStart = d.getTime();
  let streak = 0;
  for (let i = 0; i < STREAK_WEEKS_WINDOW; i++) {
    const weekEnd = weekStart + WEEK_MS;
    const hasActivity = timestamps.some((t) => t >= weekStart && t < weekEnd);
    if (!hasActivity) break;
    streak++;
    weekStart -= WEEK_MS;
  }
  return streak;
}

export async function GET(request: NextRequest) {
  // Fail closed: sin CRON_SECRET configurado el endpoint queda cerrado
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const weekAgoIso = new Date(now - WEEK_MS).toISOString();
  const weekAheadIso = new Date(now + WEEK_MS).toISOString();
  const streakWindowIso = new Date(now - STREAK_WEEKS_WINDOW * WEEK_MS).toISOString();

  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, weekly_digest")
    .eq("weekly_digest", true)
    .not("email", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!profiles?.length) return NextResponse.json({ sent: 0 });

  const userIds = profiles.map((p) => p.id);

  const [scriptsRes, ideasRes, imagesRes, eventsRes, streakScriptsRes, streakIdeasRes] =
    await Promise.all([
      supabaseAdmin.from("scripts").select("user_id, created_at")
        .in("user_id", userIds).gte("created_at", weekAgoIso),
      supabaseAdmin.from("ideas").select("user_id, created_at")
        .in("user_id", userIds).gte("created_at", weekAgoIso),
      supabaseAdmin.from("generated_images").select("user_id, created_at")
        .in("user_id", userIds).gte("created_at", weekAgoIso),
      supabaseAdmin.from("calendar_events").select("user_id, title, start_time, tag")
        .in("user_id", userIds)
        .gte("start_time", new Date(now).toISOString())
        .lte("start_time", weekAheadIso)
        .order("start_time"),
      supabaseAdmin.from("scripts").select("user_id, created_at")
        .in("user_id", userIds).gte("created_at", streakWindowIso),
      supabaseAdmin.from("ideas").select("user_id, created_at")
        .in("user_id", userIds).gte("created_at", streakWindowIso),
    ]);

  const scriptCounts = new Map<string, number>();
  for (const r of (scriptsRes.data ?? []) as Row[]) addCount(scriptCounts, r.user_id);
  const ideaCounts = new Map<string, number>();
  for (const r of (ideasRes.data ?? []) as Row[]) addCount(ideaCounts, r.user_id);
  const imageCounts = new Map<string, number>();
  for (const r of (imagesRes.data ?? []) as Row[]) addCount(imageCounts, r.user_id);

  type EventRow = { user_id: string; title: string; start_time: string; tag: string | null };
  const eventsByUser = new Map<string, EventRow[]>();
  for (const ev of (eventsRes.data ?? []) as EventRow[]) {
    const list = eventsByUser.get(ev.user_id) ?? [];
    list.push(ev);
    eventsByUser.set(ev.user_id, list);
  }

  const creationTimestamps = new Map<string, number[]>();
  for (const r of [...((streakScriptsRes.data ?? []) as Row[]), ...((streakIdeasRes.data ?? []) as Row[])]) {
    const list = creationTimestamps.get(r.user_id) ?? [];
    list.push(new Date(r.created_at).getTime());
    creationTimestamps.set(r.user_id, list);
  }

  const TAG_EMOJI: Record<string, string> = {
    grabar: "🎥", editar: "✂️", publicar: "🚀", idea: "💡", reunion: "🤝",
  };

  let sent = 0;
  for (const profile of profiles) {
    const scripts = scriptCounts.get(profile.id) ?? 0;
    const ideas = ideaCounts.get(profile.id) ?? 0;
    const images = imageCounts.get(profile.id) ?? 0;
    const events = eventsByUser.get(profile.id) ?? [];
    const streak = computeStreak(creationTimestamps.get(profile.id) ?? [], now);

    // Sin actividad ni planes no hay nada que resumir: no molestar
    if (scripts + ideas + images === 0 && events.length === 0) continue;

    const activityParts: string[] = [];
    if (scripts > 0) activityParts.push(`<strong>${scripts}</strong> guion${scripts !== 1 ? "es" : ""}`);
    if (ideas > 0) activityParts.push(`<strong>${ideas}</strong> idea${ideas !== 1 ? "s" : ""}`);
    if (images > 0) activityParts.push(`<strong>${images}</strong> imagen${images !== 1 ? "es" : ""}`);

    const activityHtml =
      activityParts.length > 0
        ? `<p style="margin:0 0 8px">Esta semana has creado ${activityParts.join(", ")}. ¡Sigue así!</p>`
        : `<p style="margin:0 0 8px">Esta semana no has creado contenido nuevo. Tu audiencia te espera 😉</p>`;

    const streakHtml =
      streak >= 2
        ? `<p style="margin:0 0 8px">🔥 Llevas <strong>${streak} semanas seguidas</strong> creando contenido.</p>`
        : "";

    const eventsHtml =
      events.length > 0
        ? `<p style="margin:16px 0 6px;font-weight:600;color:#0D0D0D">Próximos 7 días:</p>
           <table style="margin:0 auto;text-align:left;font-size:14px;color:#6B6B6B">${events
             .slice(0, 5)
             .map((ev) => {
               const when = new Date(ev.start_time).toLocaleString("es-ES", {
                 weekday: "short", day: "numeric", month: "short",
                 hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid",
               });
               const emoji = ev.tag ? `${TAG_EMOJI[ev.tag] ?? ""} ` : "";
               return `<tr><td style="padding:2px 10px 2px 0;white-space:nowrap">📅 ${when}</td><td style="padding:2px 0">${emoji}${escapeHtml(ev.title)}</td></tr>`;
             })
             .join("")}</table>`
        : "";

    const delivered = await sendEmail(
      profile.email,
      "🦩 Tu semana en Social Flamingo",
      emailLayout({
        emoji: "🦩",
        heading: profile.full_name
          ? `Hola, ${escapeHtml(profile.full_name.split(" ")[0])}`
          : "Tu resumen semanal",
        bodyHtml: `${activityHtml}${streakHtml}${eventsHtml}`,
        ctaHref: `${process.env.NEXT_PUBLIC_APP_URL}/crear`,
        ctaLabel: "Crear contenido →",
        footerNote: "Puedes desactivar este resumen en Ajustes → Cuenta → Emails.",
      })
    );
    if (delivered) sent++;
  }

  return NextResponse.json({ sent, eligible: profiles.length });
}
