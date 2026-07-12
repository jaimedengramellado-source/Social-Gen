"use client";

import { ArrowLeft, Eye, TrendingUp, Users, ThumbsUp, MessageSquare, Share2, MousePointerClick } from "lucide-react";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import {
  VideoDetail, VideoMetric, Card, MetricCard, ReachBadge, BreakdownBars, PRIMARY,
  SOURCE_LABELS, PLAYBACK_LOCATION_LABELS, DEVICE_LABELS,
  fmtNum, fmtPct, fmtDate, fmtDateShort,
} from "./shared";

export function VideoDetailView({
  detail, videoRow, loading, onBack,
}: {
  detail: VideoDetail | null;
  videoRow: VideoMetric | undefined;
  loading: boolean;
  onBack: () => void;
}) {
  return (
    <div>
      <button onClick={onBack}
        className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] mb-6 transition-colors">
        <ArrowLeft size={14} /> Volver a todos los vídeos
      </button>

      {loading && (
        <div className="space-y-4">
          <div className="h-40 rounded-2xl bg-[var(--color-muted)] animate-pulse" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 rounded-2xl bg-[var(--color-muted)] animate-pulse" />)}
          </div>
        </div>
      )}

      {!loading && detail && (
        <div className="space-y-6">
          <Card className="flex gap-5">
            {detail.video.thumbnail && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={detail.video.thumbnail} alt={detail.video.title}
                className="w-40 h-[90px] object-cover rounded-xl flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2 mb-2">
                {videoRow?.isShort && (
                  <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded text-white mt-0.5" style={{ backgroundColor: "#FF0000" }}>SHORT</span>
                )}
                <h2 className="font-semibold text-sm leading-snug">{detail.video.title}</h2>
              </div>
              <p className="text-xs text-[var(--color-muted-foreground)]">
                Publicado el {fmtDate(detail.video.publishedAt)} · Período: {detail.period.startDate} → {detail.period.endDate}
              </p>
            </div>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard icon={Eye} label="Vistas" value={fmtNum(detail.metrics.views)} />
            <MetricCard
              icon={MousePointerClick}
              label="CTR miniatura"
              value={detail.metrics.hasReachData ? fmtPct(detail.metrics.ctr * 100) : "—"}
              sub={<ReachBadge hasReachData={detail.metrics.hasReachData} />}
            />
            <MetricCard icon={TrendingUp} label="Retención media" value={detail.metrics.avgViewPercentage > 0 ? fmtPct(detail.metrics.avgViewPercentage) : "—"} />
            <MetricCard icon={Users} label="Suscriptores" value={`+${fmtNum(detail.metrics.subscribersGained)}`} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <MetricCard icon={ThumbsUp} label="Me gusta" value={fmtNum(detail.metrics.likes)} color="#16a34a" />
            <MetricCard icon={MessageSquare} label="Comentarios" value={fmtNum(detail.metrics.comments)} color="#2563eb" />
            <MetricCard icon={Share2} label="Compartidos" value={fmtNum(detail.metrics.shares)} />
          </div>

          {detail.daily.length > 0 && (
            <Card>
              <p className="text-xs font-semibold mb-3">Vistas por día</p>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={detail.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="videoViewsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={PRIMARY} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={fmtDateShort} tick={{ fontSize: 10, fill: "#6B6B6B" }} axisLine={false} tickLine={false} minTickGap={30} />
                  <YAxis tickFormatter={fmtNum} tick={{ fontSize: 10, fill: "#6B6B6B" }} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white border border-[var(--color-border)] rounded-xl p-3 shadow-lg">
                        <p className="text-[10px] text-[var(--color-muted-foreground)] mb-1">{fmtDateShort(d.date)}</p>
                        <p className="text-sm font-semibold">{fmtNum(d.views)} vistas</p>
                      </div>
                    );
                  }} />
                  <Area type="monotone" dataKey="views" stroke={PRIMARY} strokeWidth={2} fill="url(#videoViewsGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          )}

          {detail.retention.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold">Retención de audiencia</p>
                <span className="text-[10px] text-[var(--color-muted-foreground)]">% de espectadores que siguen viendo</span>
              </div>
              <p className="text-[10px] text-[var(--color-muted-foreground)] mb-3">
                Incluye repeticiones y saltos, por eso puede superar el 100% al inicio.
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={detail.retention} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="elapsed"
                    tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                    tick={{ fontSize: 10, fill: "#6B6B6B" }}
                    axisLine={false} tickLine={false} minTickGap={30}
                    type="number" domain={[0, 1]}
                  />
                  <YAxis
                    tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                    tick={{ fontSize: 10, fill: "#6B6B6B" }}
                    axisLine={false} tickLine={false} width={40}
                  />
                  <ReferenceLine y={0} stroke="var(--color-border)" />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const d = payload[0].payload as { elapsed: number; audienceWatchRatio: number };
                    return (
                      <div className="bg-white border border-[var(--color-border)] rounded-xl p-3 shadow-lg">
                        <p className="text-[10px] text-[var(--color-muted-foreground)] mb-1">{Math.round(d.elapsed * 100)}% del vídeo</p>
                        <p className="text-sm font-semibold">{Math.round(d.audienceWatchRatio * 100)}% de audiencia</p>
                      </div>
                    );
                  }} />
                  <Line type="monotone" dataKey="audienceWatchRatio" stroke={PRIMARY} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <p className="text-xs font-semibold mb-4">Fuentes de tráfico</p>
              <BreakdownBars items={detail.trafficSources.map(s => ({ label: s.source, views: s.views, pct: s.pct }))} labelFor={s => SOURCE_LABELS[s] ?? s} />
            </Card>
            <Card>
              <p className="text-xs font-semibold mb-4">Ubicación de reproducción</p>
              <BreakdownBars items={detail.playbackLocations.map(p => ({ label: p.location, views: p.views, pct: p.pct }))} labelFor={p => PLAYBACK_LOCATION_LABELS[p] ?? p} />
            </Card>
            <Card>
              <p className="text-xs font-semibold mb-4">Dispositivos</p>
              <BreakdownBars items={detail.devices.map(d => ({ label: d.device, views: d.views, pct: d.pct }))} labelFor={d => DEVICE_LABELS[d] ?? d} />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
