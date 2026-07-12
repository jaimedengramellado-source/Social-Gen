import React from "react";
import { LayoutDashboard, PlayCircle, Compass, Users, Heart } from "lucide-react";

export const YT_RED = "#FF0000";
export const PRIMARY = "var(--color-primary)";

export type Connection = {
  channel_id: string; channel_name: string | null;
  channel_thumbnail: string | null; subscriber_count: number; updated_at: string;
};

export type VideoMetric = {
  id: string; title: string; thumbnail: string | null; publishedAt: string | null;
  isShort: boolean; durationSec: number; views: number; watchTimeMinutes: number;
  avgViewDuration: number; avgViewPercentage: number; ctr: number;
  impressions: number; likes: number; comments: number; subscribersGained: number;
};

export type TrendPoint = { date: string; views: number; watchMinutes: number; likes: number; comments: number; shares: number };
export type SubsTrendPoint = { date: string; gained: number; lost: number };

export type AnalyticsData = {
  channel: { id: string; name: string; thumbnail: string; subscriberCount: number };
  overview: {
    views: number; watchTimeHours: number; avgViewPercentage: number;
    subscribersGained: number; subscribersLost: number; likes: number; comments: number;
    shares: number; ctr: number; impressions: number; hasReachData: boolean;
  };
  videos: VideoMetric[];
  viewsTrend: TrendPoint[];
  subscribersTrend: SubsTrendPoint[];
  period: { startDate: string; endDate: string; days: number };
  reachSyncedUntil: string | null;
};

export type Breakdown = { views: number; pct: number };
export type AudienceData = {
  demographics: { ageGroup: string; gender: string; viewerPercentage: number }[];
  geography: (Breakdown & { country: string })[];
  devices: (Breakdown & { device: string })[];
  subscribedStatus: (Breakdown & { status: string })[];
  period: { startDate: string; endDate: string; days: number };
};

export type RetentionPoint = { elapsed: number; audienceWatchRatio: number; relativeRetentionPerformance: number };

export type VideoDetail = {
  video: { id: string; title: string; thumbnail: string | null; publishedAt: string | null };
  metrics: {
    views: number; watchTimeHours: number; avgViewDuration: number; avgViewPercentage: number;
    ctr: number; impressions: number; hasReachData: boolean; likes: number; comments: number;
    shares: number; subscribersGained: number;
  };
  daily: { date: string; views: number; watchMinutes: number }[];
  reachDaily: { date: string; impressions: number; ctr: number }[];
  trafficSources: (Breakdown & { source: string })[];
  playbackLocations: (Breakdown & { location: string })[];
  devices: (Breakdown & { device: string })[];
  retention: RetentionPoint[];
  period: { startDate: string; endDate: string; days: number };
};

export type TrafficData = {
  sources: (Breakdown & { source: string })[];
  playbackLocations: (Breakdown & { location: string })[];
  searchTerms: { term: string; views: number }[];
  sharingServices: (Breakdown & { service: string })[];
  period: { startDate: string; endDate: string; days: number };
};

export const PERIODS = [
  { label: "7 días", value: "7" },
  { label: "28 días", value: "28" },
  { label: "3 meses", value: "90" },
  { label: "1 año", value: "365" },
];

export const SOURCE_LABELS: Record<string, string> = {
  YT_SEARCH: "Búsqueda YouTube",
  EXT_URL: "Fuentes externas",
  NO_LINK_EMBEDDED: "Directo / Sin enlace",
  NO_LINK_OTHER: "Directo / Otro",
  SUBSCRIBER: "Suscriptores",
  YT_CHANNEL: "Página del canal",
  YT_SHORT: "Shorts",
  PLAYLIST: "Listas de reproducción",
  YT_OTHER_PAGE: "Otras páginas YouTube",
  NOTIFICATION: "Notificaciones",
  RELATED_VIDEO: "Vídeos sugeridos",
  SHORTS: "Shorts",
  ADVERTISING: "Publicidad",
  END_SCREEN: "Pantallas finales",
  CAMPAIGN_CARD: "Tarjetas",
};

export const PLAYBACK_LOCATION_LABELS: Record<string, string> = {
  WATCH: "Página de reproducción",
  EMBEDDED: "Insertado en otras webs",
  CHANNEL: "Página del canal",
  SEARCH: "Resultados de búsqueda",
  EXTERNAL_APP: "App externa",
  MOBILE: "App móvil de YouTube",
  BROWSE: "Explorar / inicio",
  YT_OTHER: "Otra ubicación de YouTube",
};

export const DEVICE_LABELS: Record<string, string> = {
  MOBILE: "Móvil",
  DESKTOP: "Ordenador",
  TABLET: "Tablet",
  TV: "TV",
  GAME_CONSOLE: "Consola",
  UNKNOWN_PLATFORM: "Desconocido",
};

export const GENDER_LABELS: Record<string, string> = {
  MALE: "Hombres",
  FEMALE: "Mujeres",
  USER_SPECIFIED: "Otro",
  GENDER_OTHER: "Otro",
};

export const SUB_STATUS_LABELS: Record<string, string> = {
  SUBSCRIBED: "Suscriptores",
  UNSUBSCRIBED: "No suscriptores",
};

export const SHARING_SERVICE_LABELS: Record<string, string> = {
  WHATS_APP: "WhatsApp",
  FACEBOOK: "Facebook",
  TWITTER: "X (Twitter)",
  COPY_PASTE: "Copiar enlace",
  SMS: "Mensaje de texto",
  EMBED: "Insertado",
  GMAIL: "Gmail",
  TELEGRAM: "Telegram",
  MESSENGER: "Messenger",
  REDDIT: "Reddit",
  LINE: "LINE",
  LINKEDIN: "LinkedIn",
  PINTEREST: "Pinterest",
  TUMBLR: "Tumblr",
  VIBER: "Viber",
  KAKAO_STORY: "KakaoStory",
  KAKAO_TALK: "KakaoTalk",
  HANGOUTS: "Hangouts",
  ANDROID_MESSAGING: "Mensajería Android",
  IOS_SYSTEM_ACTIVITY_DIALOG: "Compartir de iOS",
  DIRECT: "Directo",
  BLOGGER: "Blogger",
  UNKNOWN: "Desconocido",
  OTHER: "Otro",
};

export function fmtAgeGroup(ageGroup: string): string {
  return ageGroup.replace("age", "");
}

export function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(Math.round(n));
}
export function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60); const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
export function fmtPct(v: number): string { return v.toFixed(1) + "%"; }
export function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}
export function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

let regionNames: Intl.DisplayNames | null = null;
export function countryName(code: string): string {
  if (code === "ZZ" || !code) return "Desconocido";
  try {
    regionNames ??= new Intl.DisplayNames(["es"], { type: "region" });
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

export function MetricCard({ icon: Icon, label, value, sub, color = PRIMARY }: {
  icon: React.ElementType; label: string; value: string; sub?: React.ReactNode; color?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5" style={{ boxShadow: "var(--shadow-card)" }}>
      <Icon size={14} className="mb-3" style={{ color }} />
      <p className="text-2xl font-black" style={{ color, fontFamily: "var(--font-serif)" }}>{value}</p>
      <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-[var(--color-muted-foreground)] mt-1 opacity-70">{sub}</p>}
    </div>
  );
}

export function ReachBadge({ hasReachData, reachSyncedUntil }: { hasReachData: boolean; reachSyncedUntil?: string | null }) {
  if (!hasReachData) {
    return (
      <span className="inline-flex items-center text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-[var(--color-muted)] text-[var(--color-muted-foreground)]" title="Los datos de CTR e impresiones tardan ~48h en aparecer tras conectar el canal">
        Sin datos aún
      </span>
    );
  }
  const label = reachSyncedUntil
    ? `Actualizado ${fmtDateShort(reachSyncedUntil)}`
    : "≈48h de retraso";
  return (
    <span className="inline-flex items-center text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-[var(--color-muted)] text-[var(--color-muted-foreground)]" title="El CTR y las impresiones de miniatura llegan con ~48h de retraso (limitación de la API de YouTube)">
      {label}
    </span>
  );
}

export function BreakdownBars({ items, labelFor, unit = "vistas" }: {
  items: { label: string; views: number; pct: number }[];
  labelFor?: (label: string) => string;
  unit?: string;
}) {
  if (items.length === 0) return <p className="text-xs text-[var(--color-muted-foreground)] py-4 text-center">Sin datos en este período.</p>;
  return (
    <div className="space-y-3">
      {items.map(item => (
        <div key={item.label}>
          <div className="flex justify-between text-xs mb-1">
            <span>{labelFor ? labelFor(item.label) : item.label}</span>
            <span className="font-semibold">{fmtNum(item.views)} {unit} · {item.pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--color-muted)] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${item.pct}%`, backgroundColor: PRIMARY }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-[var(--color-border)] p-5 ${className}`} style={{ boxShadow: "var(--shadow-card)" }}>
      {children}
    </div>
  );
}

export type StatsSection = "overview" | "content" | "traffic" | "audience" | "engagement";

export const STATS_SECTIONS: { id: StatsSection; label: string; description: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Resumen", description: "Vistas, retención y suscriptores", icon: LayoutDashboard },
  { id: "content", label: "Contenido", description: "Rendimiento por vídeo", icon: PlayCircle },
  { id: "traffic", label: "Tráfico", description: "De dónde vienen tus vistas", icon: Compass },
  { id: "audience", label: "Audiencia", description: "Quién te ve", icon: Users },
  { id: "engagement", label: "Interacción", description: "Likes, comentarios y shares", icon: Heart },
];

export function StatsSidebar({ active, onChange }: { active: StatsSection; onChange: (s: StatsSection) => void }) {
  return (
    <nav className="space-y-1">
      {STATS_SECTIONS.map(s => {
        const isActive = s.id === active;
        return (
          <button
            key={s.id}
            onClick={() => onChange(s.id)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
            style={{
              backgroundColor: isActive ? "var(--color-primary-light)" : "transparent",
              color: isActive ? "var(--color-primary)" : "var(--color-foreground)",
            }}
          >
            <s.icon size={16} strokeWidth={isActive ? 2.5 : 2} className="flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">{s.label}</p>
              <p className="text-[11px] leading-tight mt-0.5 truncate" style={{ color: isActive ? "var(--color-primary)" : "var(--color-muted-foreground)", opacity: isActive ? 0.8 : 1 }}>
                {s.description}
              </p>
            </div>
          </button>
        );
      })}
    </nav>
  );
}

export function StatsMobileTabs({ active, onChange }: { active: StatsSection; onChange: (s: StatsSection) => void }) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 md:hidden" style={{ scrollbarWidth: "none" }}>
      {STATS_SECTIONS.map(s => {
        const isActive = s.id === active;
        return (
          <button
            key={s.id}
            onClick={() => onChange(s.id)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors"
            style={{
              backgroundColor: isActive ? PRIMARY : "var(--color-muted)",
              color: isActive ? "white" : "var(--color-muted-foreground)",
            }}
          >
            <s.icon size={13} />
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
