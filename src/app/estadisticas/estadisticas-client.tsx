"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Eye, Clock, TrendingUp, Users, Zap, PlayCircle,
  RefreshCw, LogOut, AlertCircle, ArrowLeft, ThumbsUp, MessageSquare,
} from "lucide-react";

const YT_RED = "#FF0000";
const PRIMARY = "var(--color-primary)";

type Connection = {
  channel_id: string; channel_name: string | null;
  channel_thumbnail: string | null; subscriber_count: number; updated_at: string;
};
type VideoMetric = {
  id: string; title: string; thumbnail: string | null; publishedAt: string | null;
  isShort: boolean; durationSec: number; views: number; watchTimeMinutes: number;
  avgViewDuration: number; avgViewPercentage: number; ctr: number;
  impressions: number; likes: number; comments: number; subscribersGained: number;
};
type AnalyticsData = {
  channel: { id: string; name: string; thumbnail: string; subscriberCount: number };
  overview: { views: number; watchTimeHours: number; avgCtr: number; subscribersGained: number; impressions: number };
  videos: VideoMetric[];
  period: { startDate: string; endDate: string; days: number };
};
type VideoDetail = {
  video: { id: string; title: string; thumbnail: string | null; publishedAt: string | null };
  metrics: { views: number; watchTimeHours: number; avgViewDuration: number; avgViewPercentage: number; ctr: number; impressions: number; likes: number; comments: number; subscribersGained: number };
  daily: { date: string; views: number; watchMinutes: number }[];
  trafficSources: { source: string; views: number; pct: number }[];
  period: { startDate: string; endDate: string; days: number };
};

const PERIODS = [
  { label: "7 días", value: "7" },
  { label: "28 días", value: "28" },
  { label: "3 meses", value: "90" },
  { label: "1 año", value: "365" },
];

const SOURCE_LABELS: Record<string, string> = {
  YT_SEARCH: "Búsqueda YouTube",
  EXT_URL: "Fuentes externas",
  NO_LINK_EMBEDDED: "Directo / Sin enlace",
  SUBSCRIBER: "Suscriptores",
  YT_CHANNEL: "Página del canal",
  YT_SHORT: "Shorts",
  PLAYLIST: "Listas de reproducción",
  YT_OTHER_PAGE: "Otras páginas YouTube",
  NOTIFICATION: "Notificaciones",
  RELATED_VIDEO: "Vídeos sugeridos",
  SHORTS: "Shorts",
};

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(Math.round(n));
}
function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60); const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
function fmtPct(v: number): string { return (v * 100).toFixed(1) + "%"; }
function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

function MetricCard({ icon: Icon, label, value, sub, color = PRIMARY }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color?: string;
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

function ViewsChart({ daily }: { daily: { date: string; views: number }[] }) {
  if (!daily.length) return null;
  const max = Math.max(...daily.map(d => d.views), 1);
  return (
    <div>
      <p className="text-xs font-semibold mb-3">Vistas por día</p>
      <div className="flex items-end gap-0.5 h-24">
        {daily.map(d => (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5 group relative">
            <div
              className="w-full rounded-sm transition-opacity hover:opacity-80"
              style={{ height: `${Math.max(2, Math.round((d.views / max) * 96))}px`, backgroundColor: PRIMARY, opacity: 0.75 }}
            />
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#0D0D0D] text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10">
              {fmtNum(d.views)} · {d.date.slice(5)}
            </div>
          </div>
        ))}
      </div>
      {daily.length <= 14 && (
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-[var(--color-muted-foreground)]">{daily[0]?.date.slice(5)}</span>
          <span className="text-[9px] text-[var(--color-muted-foreground)]">{daily[daily.length - 1]?.date.slice(5)}</span>
        </div>
      )}
    </div>
  );
}

function ComingSoonPlatforms() {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-4">Próximamente</p>
      <div className="grid grid-cols-2 gap-4">

        {/* TikTok */}
        <div className="relative rounded-2xl border border-[var(--color-border)] overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #010101 0%, #1a1a1a 100%)" }} />
          <div className="relative p-6">
            <div className="flex items-start justify-between mb-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/>
                </svg>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}>
                Próximamente
              </span>
            </div>
            <h3 className="text-base font-bold text-white mb-1">TikTok Analytics</h3>
            <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
              Conecta tu cuenta y accede a vistas, seguidores, retención y rendimiento de cada vídeo directamente aquí.
            </p>
          </div>
        </div>

        {/* Instagram */}
        <div className="relative rounded-2xl border border-[var(--color-border)] overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)" }} />
          <div className="relative p-6">
            <div className="flex items-start justify-between mb-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
                </svg>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.85)" }}>
                Próximamente
              </span>
            </div>
            <h3 className="text-base font-bold text-white mb-1">Instagram Analytics</h3>
            <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
              Conecta tu cuenta profesional y visualiza alcance, impresiones, engagement y estadísticas de tus Reels.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

const OAUTH_ERRORS: Record<string, string> = {
  not_configured: "Las credenciales de Google no están configuradas en .env.local.",
  access_denied: "Acceso denegado. Prueba de nuevo y acepta los permisos.",
  invalid_state: "Error de seguridad en el flujo OAuth. Inténtalo de nuevo.",
  token_failed: "No se pudo obtener el token de acceso.",
  no_channel: "No se encontró ningún canal de YouTube en tu cuenta.",
};

export function EstadisticasClient({ connection }: { connection: Connection | null }) {
  const searchParams = useSearchParams();
  const oauthError = searchParams.get("error");
  const [period, setPeriod] = useState("28");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(!!connection);
  const [error, setError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [videoDetail, setVideoDetail] = useState<VideoDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchData = useCallback((p: string) => {
    if (!connection) return;
    setLoading(true);
    setError(null);
    fetch(`/api/estadisticas/analytics?period=${p}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(`Error de API: ${d.error}`); setLoading(false); return; }
        if (!Array.isArray(d.videos)) { setError("Respuesta inesperada del servidor."); setLoading(false); return; }
        setData(d); setLoading(false);
      })
      .catch(() => { setError("No se pudieron cargar los datos."); setLoading(false); });
  }, [connection]);

  useEffect(() => { fetchData(period); }, [fetchData, period]);

  function handlePeriodChange(p: string) {
    setPeriod(p);
    setSelectedVideo(null);
    setVideoDetail(null);
  }

  async function handleSelectVideo(videoId: string) {
    setSelectedVideo(videoId);
    setVideoDetail(null);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/estadisticas/video/${videoId}?period=${period}`);
      const d = await res.json();
      setVideoDetail(d);
    } catch { /* ignore */ }
    finally { setLoadingDetail(false); }
  }

  function handleBack() { setSelectedVideo(null); setVideoDetail(null); }

  async function handleDisconnect() {
    setDisconnecting(true);
    await fetch("/api/estadisticas/disconnect", { method: "DELETE" });
    window.location.reload();
  }

  // ── Not connected ──
  if (!connection) {
    return (
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12">

        {/* Platforms grid */}
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-4">Plataformas</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* YouTube */}
          <div className="relative rounded-2xl border border-[var(--color-border)] overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #1a0000 0%, #2d0000 100%)" }} />
            <div className="relative p-6 flex flex-col h-full">
              <div className="flex items-start justify-between mb-5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                  <PlayCircle size={20} color="white" />
                </div>
                {oauthError && (
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: "rgba(255,0,0,0.3)", color: "rgba(255,255,255,0.9)" }}>
                    Error
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-white mb-1">YouTube Analytics</h3>
              <p className="text-xs leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.5)" }}>
                Accede a CTR, retención, fuentes de tráfico y mucho más. Nunca publicamos nada en tu canal.
              </p>
              {oauthError && (
                <p className="text-[10px] mb-3" style={{ color: "rgba(255,100,100,0.9)" }}>
                  {OAUTH_ERRORS[oauthError] ?? "Error desconocido. Inténtalo de nuevo."}
                </p>
              )}
              <a href="/api/auth/youtube/connect"
                className="mt-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white font-semibold text-xs transition-opacity hover:opacity-80"
                style={{ backgroundColor: YT_RED }}>
                <PlayCircle size={13} /> Conectar YouTube
              </a>
            </div>
          </div>

          {/* TikTok */}
          <div className="relative rounded-2xl border border-[var(--color-border)] overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #010101 0%, #1a1a1a 100%)" }} />
            <div className="relative p-6">
              <div className="flex items-start justify-between mb-5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/>
                  </svg>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}>
                  Próximamente
                </span>
              </div>
              <h3 className="text-base font-bold text-white mb-1">TikTok Analytics</h3>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                Conecta tu cuenta y accede a vistas, seguidores, retención y rendimiento de cada vídeo directamente aquí.
              </p>
            </div>
          </div>

          {/* Instagram */}
          <div className="relative rounded-2xl border border-[var(--color-border)] overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)" }} />
            <div className="relative p-6">
              <div className="flex items-start justify-between mb-5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
                  </svg>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.85)" }}>
                  Próximamente
                </span>
              </div>
              <h3 className="text-base font-bold text-white mb-1">Instagram Analytics</h3>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
                Conecta tu cuenta profesional y visualiza alcance, impresiones, engagement y estadísticas de tus Reels.
              </p>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // ── Loading skeleton ──
  const skeleton = (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-full bg-[var(--color-muted)] animate-pulse" />
        <div className="space-y-1.5">
          <div className="h-4 w-32 rounded bg-[var(--color-muted)] animate-pulse" />
          <div className="h-3 w-20 rounded bg-[var(--color-muted)] animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[1,2,3,4].map(i => <div key={i} className="h-28 rounded-2xl bg-[var(--color-muted)] animate-pulse" />)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {[1,2,3,4,5,6].map(i => <div key={i} className="h-48 rounded-2xl bg-[var(--color-muted)] animate-pulse" />)}
      </div>
    </div>
  );

  if (loading && !data) return skeleton;
  if (error && !data) return (
    <div className="max-w-4xl mx-auto px-6 py-20 text-center">
      <p className="text-sm text-[var(--color-muted-foreground)] mb-4">{error}</p>
      <button onClick={() => fetchData(period)}
        className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-foreground)] transition-colors">
        <RefreshCw size={13} /> Reintentar
      </button>
    </div>
  );
  if (!data) return null;

  const avgViews = data.videos.length ? data.videos.reduce((s, v) => s + v.views, 0) / data.videos.length : 0;

  // ── Video detail view ──
  if (selectedVideo) {
    const videoRow = data.videos.find(v => v.id === selectedVideo);
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <button onClick={handleBack}
          className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] mb-6 transition-colors">
          <ArrowLeft size={14} /> Volver a todos los vídeos
        </button>

        {loadingDetail && (
          <div className="space-y-4">
            <div className="h-40 rounded-2xl bg-[var(--color-muted)] animate-pulse" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1,2,3,4].map(i => <div key={i} className="h-24 rounded-2xl bg-[var(--color-muted)] animate-pulse" />)}
            </div>
          </div>
        )}

        {!loadingDetail && videoDetail && (
          <div className="space-y-6">
            {/* Video header */}
            <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5 flex gap-5" style={{ boxShadow: "var(--shadow-card)" }}>
              {videoDetail.video.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={videoDetail.video.thumbnail} alt={videoDetail.video.title}
                  className="w-40 h-[90px] object-cover rounded-xl flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 mb-2">
                  {videoRow?.isShort && (
                    <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded text-white mt-0.5" style={{ backgroundColor: YT_RED }}>SHORT</span>
                  )}
                  <h2 className="font-semibold text-sm leading-snug">{videoDetail.video.title}</h2>
                </div>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  Publicado el {fmtDate(videoDetail.video.publishedAt)} · Período: {videoDetail.period.startDate} → {videoDetail.period.endDate}
                </p>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard icon={Eye} label="Vistas" value={fmtNum(videoDetail.metrics.views)} />
              <MetricCard icon={Clock} label="CTR miniatura" value={videoDetail.metrics.ctr > 0 ? fmtPct(videoDetail.metrics.ctr) : "—"} />
              <MetricCard icon={TrendingUp} label="Retención media" value={videoDetail.metrics.avgViewPercentage > 0 ? videoDetail.metrics.avgViewPercentage.toFixed(1) + "%" : "—"} />
              <MetricCard icon={Users} label="Suscriptores" value={`+${fmtNum(videoDetail.metrics.subscribersGained)}`} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MetricCard icon={ThumbsUp} label="Likes" value={fmtNum(videoDetail.metrics.likes)} color="#16a34a" />
              <MetricCard icon={MessageSquare} label="Comentarios" value={fmtNum(videoDetail.metrics.comments)} color="#2563eb" />
            </div>

            {/* Chart */}
            {videoDetail.daily.length > 0 && (
              <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5" style={{ boxShadow: "var(--shadow-card)" }}>
                <ViewsChart daily={videoDetail.daily} />
              </div>
            )}

            {/* Traffic sources */}
            {videoDetail.trafficSources.length > 0 && (
              <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5" style={{ boxShadow: "var(--shadow-card)" }}>
                <p className="text-xs font-semibold mb-4">Fuentes de tráfico</p>
                <div className="space-y-3">
                  {videoDetail.trafficSources.map(src => (
                    <div key={src.source}>
                      <div className="flex justify-between text-xs mb-1">
                        <span>{SOURCE_LABELS[src.source] ?? src.source}</span>
                        <span className="font-semibold">{fmtNum(src.views)} vistas · {src.pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--color-muted)] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${src.pct}%`, backgroundColor: PRIMARY }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Main dashboard ──
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">

      {/* Channel header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {data.channel.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.channel.thumbnail} alt={data.channel.name} className="w-11 h-11 rounded-full" />
          ) : (
            <div className="w-11 h-11 rounded-full bg-[var(--color-muted)] flex items-center justify-center">
              <PlayCircle size={20} style={{ color: YT_RED }} />
            </div>
          )}
          <div>
            <p className="font-semibold text-sm">{data.channel.name}</p>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              {fmtNum(data.channel.subscriberCount)} suscriptores · <span className="text-green-600 font-medium">● Conectado</span>
            </p>
          </div>
        </div>
        <button onClick={handleDisconnect} disabled={disconnecting}
          className="flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] px-2 py-1 rounded-lg hover:bg-[var(--color-muted)] transition-colors">
          <LogOut size={11} /> Desconectar
        </button>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-2 mb-6">
        {PERIODS.map(p => (
          <button key={p.value} onClick={() => handlePeriodChange(p.value)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{
              backgroundColor: period === p.value ? PRIMARY : "var(--color-muted)",
              color: period === p.value ? "white" : "var(--color-muted-foreground)",
            }}>
            {p.label}
          </button>
        ))}
        <span className="text-xs text-[var(--color-muted-foreground)] ml-auto">
          {data.period.startDate} → {data.period.endDate}
        </span>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <MetricCard icon={Eye} label="Vistas" value={fmtNum(data.overview.views)} sub={`últimos ${data.period.days} días`} />
        <MetricCard icon={Clock} label="Horas vistas" value={fmtNum(data.overview.watchTimeHours)} sub="tiempo de visualización" />
        <MetricCard icon={TrendingUp} label="CTR medio" value={data.overview.avgCtr > 0 ? fmtPct(data.overview.avgCtr) : "—"} sub="clic en miniatura" />
        <MetricCard icon={Users} label="Suscriptores ganados"
          value={data.overview.subscribersGained >= 0 ? `+${fmtNum(data.overview.subscribersGained)}` : fmtNum(data.overview.subscribersGained)} />
      </div>

      {/* Video grid sorted by date */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold">Últimos vídeos</h2>
        <span className="text-xs text-[var(--color-muted-foreground)]">{data.videos.length} vídeos</span>
      </div>

      {data.videos.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)] text-center py-12">Sin vídeos en este período.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {data.videos.map(video => (
            <button key={video.id} onClick={() => handleSelectVideo(video.id)}
              className="bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden text-left hover:border-[var(--color-foreground)] transition-all hover:shadow-md group"
              style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="relative">
                {video.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={video.thumbnail} alt={video.title}
                    className="w-full aspect-video object-cover group-hover:scale-[1.02] transition-transform duration-200" />
                ) : (
                  <div className="w-full aspect-video bg-[var(--color-muted)]" />
                )}
                <span className="absolute bottom-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded text-white"
                  style={{ backgroundColor: video.isShort ? YT_RED : "rgba(0,0,0,0.75)" }}>
                  {video.isShort ? "SHORT" : fmtDuration(video.durationSec)}
                </span>
                {video.views > avgViews * 2 && (
                  <span className="absolute top-2 left-2 flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: PRIMARY }}>
                    <Zap size={9} /> viral
                  </span>
                )}
              </div>
              <div className="p-3">
                <p className="text-xs font-semibold leading-snug line-clamp-2 mb-2">{video.title}</p>
                <p className="text-[10px] text-[var(--color-muted-foreground)] mb-2">{fmtDate(video.publishedAt)}</p>
                <div className="flex items-center gap-3 text-[10px] text-[var(--color-muted-foreground)]">
                  <span className="font-semibold text-[var(--color-foreground)]">{fmtNum(video.views)}</span> vistas
                  {video.ctr > 0 && <><span>·</span><span>{fmtPct(video.ctr)} CTR</span></>}
                  {video.avgViewPercentage > 0 && <><span>·</span><span>{video.avgViewPercentage.toFixed(0)}% ret.</span></>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Próximas integraciones ── */}
      <div className="mt-10">
        <ComingSoonPlatforms />
      </div>
    </div>
  );
}
