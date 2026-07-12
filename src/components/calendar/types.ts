export type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  color: string | null;
  tag: string | null;
  script_id: string | null;
  remind_before_minutes: number | null;
  remind_times: number[] | null;
  sent_reminder_offsets: number[] | null;
  scheduled_at: string;
};

export const EVENT_TAGS = [
  { id: "grabar", label: "Grabar", emoji: "🎥" },
  { id: "editar", label: "Editar", emoji: "✂️" },
  { id: "publicar", label: "Publicar", emoji: "🚀" },
  { id: "idea", label: "Idea", emoji: "💡" },
  { id: "reunion", label: "Reunión", emoji: "🤝" },
] as const;

export type EventTagId = (typeof EVENT_TAGS)[number]["id"];

export function getEventTag(id: string | null | undefined) {
  if (!id) return null;
  return EVENT_TAGS.find((t) => t.id === id) ?? null;
}

export type LayoutEvent = CalendarEvent & {
  colIdx: number;
  totalCols: number;
};

export type Script = { id: string; title: string };

export const EVENT_COLORS = [
  "#1a73e8",
  "#0f9d58",
  "#f4511e",
  "#f6bf26",
  "#8e24aa",
  "#616161",
];

export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Time formatted according to user preference */
export function formatTime(iso: string, fmt: "24h" | "ampm"): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  if (fmt === "24h") {
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  }
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

/** Hour label for the left gutter (empty string for 00:00 to avoid crowding the header) */
export function formatHourLabel(hour: number, fmt: "24h" | "ampm"): string {
  if (hour === 0) return "";
  if (fmt === "24h") return `${hour.toString().padStart(2, "0")}:00`;
  const ampm = hour < 12 ? "AM" : "PM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12} ${ampm}`;
}

/** Ordered day abbreviations respecting week-start setting */
export function getDayNames(weekStartsOn: 0 | 1): string[] {
  return weekStartsOn === 1
    ? ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"]
    : ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
}

/** Simple 24-h time — kept for internal use where settings aren't available */
export function fmtTime(iso: string): string {
  return formatTime(iso, "24h");
}

export function getWeekStart(d: Date, weekStartsOn: 0 | 1 = 1): Date {
  const date = new Date(d);
  const dow = date.getDay(); // 0=Sun..6=Sat
  // How many days back to the start of the week
  const diff = ((dow - weekStartsOn + 7) % 7);
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export function getTzLabel(): string {
  try {
    const offset = -new Date().getTimezoneOffset();
    const h = Math.floor(Math.abs(offset) / 60);
    const m = Math.abs(offset) % 60;
    const sign = offset >= 0 ? "+" : "-";
    return `GMT${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
  } catch {
    return "GMT";
  }
}

export function computeEventLayout(events: CalendarEvent[]): LayoutEvent[] {
  if (!events.length) return [];

  const sorted = [...events].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );
  const result: LayoutEvent[] = sorted.map((ev) => ({ ...ev, colIdx: 0, totalCols: 1 }));
  const colEnds: number[] = [];

  for (const ev of result) {
    const start = new Date(ev.start_time).getTime();
    const end = ev.end_time ? new Date(ev.end_time).getTime() : start + 3_600_000;
    let col = colEnds.findIndex((e) => e <= start);
    if (col === -1) col = colEnds.length;
    colEnds[col] = end;
    ev.colIdx = col;
  }

  for (const ev of result) {
    const evS = new Date(ev.start_time).getTime();
    const evE = ev.end_time ? new Date(ev.end_time).getTime() : evS + 3_600_000;
    let maxCol = ev.colIdx;
    for (const o of result) {
      if (o === ev) continue;
      const oS = new Date(o.start_time).getTime();
      const oE = o.end_time ? new Date(o.end_time).getTime() : oS + 3_600_000;
      if (oS < evE && oE > evS) maxCol = Math.max(maxCol, o.colIdx);
    }
    ev.totalCols = maxCol + 1;
  }

  return result;
}
