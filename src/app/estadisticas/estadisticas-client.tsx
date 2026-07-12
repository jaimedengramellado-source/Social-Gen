"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { PlayCircle, RefreshCw, LogOut } from "lucide-react";
import {
  Connection, AnalyticsData, VideoDetail, StatsSection, PERIODS, YT_RED, PRIMARY, fmtNum,
  StatsSidebar, StatsMobileTabs,
} from "./shared";
import { OverviewTab } from "./overview-tab";
import { ContentTab } from "./content-tab";
import { AudienceTab } from "./audience-tab";
import { EngagementTab } from "./engagement-tab";
import { TrafficTab } from "./traffic-tab";
import { VideoDetailView } from "./video-detail";

function ComingSoonCard({
  gradient, iconBg, icon, title, description,
}: {
  gradient: string; iconBg: string;
  icon: React.ReactNode; title: string; description: string;
}) {
  const [notified, setNotified] = React.useState(false);
  return (
    <div className="relative rounded-2xl border border-[var(--color-border)] overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="absolute inset-0" style={{ background: gradient }} />
      <div className="relative p-6 flex flex-col h-full">
        <div className="flex items-start justify-between mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: iconBg }}>
            {icon}
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)" }}>
            Próximamente
          </span>
        </div>
        <h3 className="text-base font-bold text-white mb-1">{title}</h3>
        <p className="text-xs leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.55)" }}>{description}</p>
        <button
          onClick={() => setNotified(true)}
          disabled={notified}
          className="mt-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
          style={{
            backgroundColor: notified ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.9)",
            border: "1px solid rgba(255,255,255,0.2)",
          }}
        >
          {notified ? "✓ Te avisaremos" : "🔔 Avisarme cuando esté disponible"}
        </button>
      </div>
    </div>
  );
}

function ComingSoonPlatforms() {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-4">Próximamente</p>
      <div className="grid grid-cols-2 gap-4">
        <ComingSoonCard
          gradient="linear-gradient(135deg, #010101 0%, #1a1a1a 100%)"
          iconBg="rgba(255,255,255,0.08)"
          title="TikTok Analytics"
          description="Conecta tu cuenta y accede a vistas, seguidores, retención y rendimiento de cada vídeo directamente aquí."
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/>
            </svg>
          }
        />
        <ComingSoonCard
          gradient="linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)"
          iconBg="rgba(255,255,255,0.15)"
          title="Instagram Analytics"
          description="Conecta tu cuenta profesional y visualiza alcance, impresiones, engagement y estadísticas de tus Reels."
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
            </svg>
          }
        />
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
  const [section, setSection] = useState<StatsSection>("overview");
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

  function handleSectionChange(s: StatsSection) {
    setSection(s);
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
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-4">Plataformas</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                Accede a CTR, retención, fuentes de tráfico y mucho más. Solo pedimos permisos de lectura.
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
              <p className="text-[10px] mt-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
                Al conectar aceptas los{" "}
                <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
                  Términos de YouTube
                </a>{" "}
                y la{" "}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">
                  Política de Privacidad de Google
                </a>.
              </p>
            </div>
          </div>

          <ComingSoonCard
            gradient="linear-gradient(135deg, #010101 0%, #1a1a1a 100%)"
            iconBg="rgba(255,255,255,0.08)"
            title="TikTok Analytics"
            description="Conecta tu cuenta y accede a vistas, seguidores, retención y rendimiento de cada vídeo directamente aquí."
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/>
              </svg>
            }
          />
          <ComingSoonCard
            gradient="linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)"
            iconBg="rgba(255,255,255,0.15)"
            title="Instagram Analytics"
            description="Conecta tu cuenta profesional y visualiza alcance, impresiones, engagement y estadísticas de tus Reels."
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
              </svg>
            }
          />
        </div>
      </div>
    );
  }

  // ── Loading skeleton ──
  const skeleton = (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-full bg-[var(--color-muted)] animate-pulse" />
        <div className="space-y-1.5">
          <div className="h-4 w-32 rounded bg-[var(--color-muted)] animate-pulse" />
          <div className="h-3 w-20 rounded bg-[var(--color-muted)] animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-28 rounded-2xl bg-[var(--color-muted)] animate-pulse" />)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-48 rounded-2xl bg-[var(--color-muted)] animate-pulse" />)}
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

  // ── Main dashboard ──
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">

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

      {/* Section nav — pills on mobile */}
      <div className="mb-4">
        <StatsMobileTabs active={section} onChange={handleSectionChange} />
      </div>

      <div className="flex gap-6 items-start">
        {/* Section nav — sidebar on desktop */}
        <aside className="hidden md:block w-56 flex-shrink-0 sticky top-20">
          <StatsSidebar active={section} onChange={handleSectionChange} />
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {selectedVideo ? (
            <VideoDetailView
              detail={videoDetail}
              videoRow={data.videos.find(v => v.id === selectedVideo)}
              loading={loadingDetail}
              onBack={handleBack}
            />
          ) : (
            <>
              {section === "overview" && <OverviewTab data={data} />}
              {section === "content" && <ContentTab data={data} onSelectVideo={handleSelectVideo} />}
              {section === "traffic" && <TrafficTab period={period} />}
              {section === "audience" && <AudienceTab period={period} />}
              {section === "engagement" && <EngagementTab data={data} />}
            </>
          )}

          {/* ── Próximas integraciones ── */}
          {!selectedVideo && (
            <div className="mt-10">
              <ComingSoonPlatforms />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
