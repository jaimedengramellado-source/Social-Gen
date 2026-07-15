import type { ScheduledPost } from "@/types";

export type BestSlot = { weekday: number; hour: number; quality: "top" | "buena" };

export const WEEKDAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export const STATUS_META: Record<ScheduledPost["status"], { label: string; color: string; bg: string }> = {
  uploading: { label: "Subiendo", color: "var(--color-warning)", bg: "rgba(217,119,6,0.12)" },
  scheduled: { label: "Programado", color: "var(--text-info)", bg: "var(--bg-info)" },
  publishing: { label: "Publicando", color: "var(--color-warning)", bg: "rgba(217,119,6,0.12)" },
  published: { label: "Publicado", color: "var(--color-success)", bg: "var(--bg-success)" },
  failed: { label: "Error", color: "var(--color-destructive)", bg: "var(--destructive-muted)" },
};

export const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  x: "X",
  linkedin: "LinkedIn",
  threads: "Threads",
};

// Límite de caracteres del texto por red (YouTube: descripción; el título va aparte)
export const PLATFORM_TEXT_LIMITS: Record<string, number> = {
  youtube: 5000,
  instagram: 2200,
  facebook: 5000,
  tiktok: 2200,
  x: 280,
  linkedin: 3000,
  threads: 500,
};

export function formatBytes(n: number): string {
  if (n >= 1_073_741_824) return `${(n / 1_073_741_824).toFixed(2).replace(".", ",")} GB`;
  if (n >= 1_048_576) return `${(n / 1_048_576).toFixed(1).replace(".", ",")} MB`;
  return `${Math.round(n / 1024)} KB`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

// datetime-local necesita la hora LOCAL sin zona ("YYYY-MM-DDTHH:mm")
export function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function nextOccurrence(weekday: number, hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7));
  d.setHours(hour, 0, 0, 0);
  if (d.getTime() <= Date.now() + 10 * 60_000) d.setDate(d.getDate() + 7);
  return d;
}

export function postPermalink(post: ScheduledPost): string | null {
  if (typeof post.settings?.permalink === "string") return post.settings.permalink;
  if (post.platform === "youtube" && post.youtube_video_id) {
    return `https://www.youtube.com/watch?v=${post.youtube_video_id}`;
  }
  return null;
}
