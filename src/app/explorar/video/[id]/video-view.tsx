"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, ThumbsUp, MessageCircle, ExternalLink, Play, Calendar, Tag, TrendingUp, Users, BarChart2, Zap, FileText, ChevronDown, ChevronUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid, ReferenceLine,
} from "recharts";
import { formatCount, estimateViewEvolution } from "@/lib/youtube";
import type { YTVideo, YTChannel } from "@/lib/youtube";

const YT_RED = "#FF0000";
const YT_RED_LIGHT = "rgba(255,0,0,0.07)";

interface Props {
  video: YTVideo;
  channel: YTChannel | null;
  channelAvgViews: number;
  channelRecentVideos: YTVideo[];
  transcript?: { text: string; startMs: number }[];
}

function daysSince(dateStr: string) {
  return Math.max(1, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000));
}
function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

const CATEGORY_NAMES: Record<string, string> = {
  "1": "Películas y animación", "2": "Vehículos", "10": "Música", "15": "Mascotas",
  "17": "Deportes", "18": "Cortos", "19": "Viajes", "20": "Gaming",
  "21": "Videoblog", "22": "Personas y blogs", "23": "Comedia", "24": "Entretenimiento",
  "25": "Noticias y política", "26": "Tutoriales", "27": "Educación", "28": "Ciencia y tecnología",
  "29": "ONG y activismo",
};

function fmtMs(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VideoView({ video, channel, channelAvgViews, channelRecentVideos, transcript = [] }: Props) {
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const isShort = video.durationSecs <= 180;
  const ytUrl = `https://www.youtube.com/watch?v=${video.id}`;
  const days = daysSince(video.publishedAt);
  const viewsPerDay = Math.round(video.views / days);
  const viewsPerHour = days < 2 ? Math.round(video.views / (days * 24)) : null;
  const likeRatio = video.views > 0 ? (video.likes / video.views) * 100 : 0;
  const commentRatio = video.views > 0 ? (video.comments / video.views) * 100 : 0;
  const engagementRate = video.views > 0 ? ((video.likes + video.comments) / video.views) * 100 : 0;
  const estimatedWatchTimeMins = Math.round((video.views * video.durationSecs * 0.45) / 60);
  const outlierMultiplier = channelAvgViews > 0 ? video.views / channelAvgViews : null;
  const isOutlier = outlierMultiplier !== null && outlierMultiplier >= 2;
  const createHref = `/crear?tema=${encodeURIComponent(video.title)}${video.channelName ? `&canal=${encodeURIComponent(video.channelName)}` : ""}`;

  const evolutionData = estimateViewEvolution(video.views, video.publishedAt);

  // Channel comparison bar chart
  const comparisonData = channelRecentVideos.slice(0, 10).map(v => ({
    label: v.title.substring(0, 18) + "…",
    views: v.views,
    isThis: v.id === video.id,
  }));

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Link href="/explorar" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] mb-6">
        <ArrowLeft size={14} /> Explorar
      </Link>

      {/* ── TOP ROW ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-4">

        {/* Embed col */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="relative aspect-video bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${video.id}`}
                title={video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <span
                  className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={isShort
                    ? { backgroundColor: "#EFF6FF", color: "#2563EB" }
                    : { backgroundColor: YT_RED, color: "#fff" }
                  }
                >
                  {isShort ? "SHORT" : "LARGO"} · {video.duration}
                </span>
                <a href={ytUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl text-white hover:opacity-80"
                  style={{ backgroundColor: YT_RED }}
                >
                  <Play size={11} fill="white" /> Ver en YouTube
                </a>
              </div>
              <h1 className="text-base font-semibold leading-snug mb-3">{video.title}</h1>

              {channel && (
                <Link href={`/explorar/canal/${channel.id}`} className="flex items-center gap-2 group w-fit mb-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={channel.thumbnail} alt={channel.name} className="w-8 h-8 rounded-full object-cover" style={{ background: "var(--color-muted)" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  <div>
                    <p className="text-xs font-semibold group-hover:underline">{channel.name}</p>
                    <p className="text-[10px] text-[var(--color-muted-foreground)]">{formatCount(channel.subscribers)} suscriptores</p>
                  </div>
                  <ExternalLink size={10} className="text-[var(--color-muted-foreground)]" />
                </Link>
              )}

              <div className="flex flex-wrap gap-3 text-[10px] text-[var(--color-muted-foreground)]">
                <span className="flex items-center gap-1"><Calendar size={11} />{fmtDate(video.publishedAt)} · hace {days} días</span>
                {video.categoryId && CATEGORY_NAMES[video.categoryId] && (
                  <span className="flex items-center gap-1"><Tag size={11} />{CATEGORY_NAMES[video.categoryId]}</span>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {video.description && (
            <div className="bg-white rounded-2xl border border-[var(--color-border)] p-4" style={{ boxShadow: "var(--shadow-card)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-2">Descripción</p>
              <p className="text-xs leading-relaxed whitespace-pre-line line-clamp-6 text-[var(--color-foreground)]">{video.description}</p>
            </div>
          )}

          {/* Tags */}
          {video.tags && video.tags.length > 0 && (
            <div className="bg-white rounded-2xl border border-[var(--color-border)] p-4" style={{ boxShadow: "var(--shadow-card)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-2">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {video.tags.slice(0, 20).map(tag => (
                  <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--color-muted)", color: "var(--color-muted-foreground)" }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Stats col */}
        <div className="lg:col-span-2 space-y-3">

          {/* Hero views */}
          <div className="bg-white rounded-2xl border p-5" style={{ borderColor: YT_RED, boxShadow: "0 4px 24px rgba(255,0,0,0.12)" }}>
            <div className="flex items-center gap-1.5 mb-1">
              <Eye size={13} style={{ color: YT_RED }} />
              <span className="text-xs text-[var(--color-muted-foreground)]">Visualizaciones totales</span>
            </div>
            <p className="text-5xl font-black tracking-tight" style={{ color: YT_RED }}>{formatCount(video.views)}</p>
            <p className="text-xs text-[var(--color-muted-foreground)] mt-1">{video.views.toLocaleString("es-ES")} vistas</p>
            <div className="h-px bg-[var(--color-border)] my-3" />
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: ThumbsUp, label: "Me gusta", val: formatCount(video.likes) },
                { icon: MessageCircle, label: "Comentarios", val: formatCount(video.comments) },
              ].map(({ icon: Icon, label, val }) => (
                <div key={label} className="rounded-xl p-3" style={{ backgroundColor: "var(--color-muted)" }}>
                  <Icon size={12} className="text-[var(--color-muted-foreground)] mb-1" />
                  <p className="text-xl font-bold">{val}</p>
                  <p className="text-[10px] text-[var(--color-muted-foreground)]">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Key metrics */}
          <div className="bg-white rounded-2xl border border-[var(--color-border)] p-4" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 size={13} className="text-[var(--color-muted-foreground)]" />
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted-foreground)]">Métricas clave</p>
            </div>
            <div className="space-y-2.5">
              {[
                { label: "📅 Días publicado", val: `${days}d` },
                { label: "📈 Vistas / día", val: formatCount(viewsPerDay) },
                ...(viewsPerHour ? [{ label: "⚡ Vistas / hora", val: formatCount(viewsPerHour) }] : []),
                { label: "👍 Ratio de likes", val: `${likeRatio.toFixed(2)}%` },
                { label: "💬 Ratio comentarios", val: `${commentRatio.toFixed(3)}%` },
                { label: "🔥 Engagement rate", val: `${engagementRate.toFixed(2)}%` },
                { label: "⏱ Watch time est.", val: `${formatCount(estimatedWatchTimeMins)} min` },
              ].map(({ label, val }) => (
                <div key={label} className="flex justify-between items-center text-xs py-1 border-b border-[var(--color-border)] last:border-0">
                  <span className="text-[var(--color-muted-foreground)]">{label}</span>
                  <span className="font-semibold">{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Outlier vs channel */}
          {outlierMultiplier !== null && channelAvgViews > 0 && (
            <div
              className="bg-white rounded-2xl border p-4"
              style={{
                borderColor: isOutlier ? YT_RED : "var(--color-border)",
                boxShadow: isOutlier ? "0 4px 16px rgba(255,0,0,0.08)" : "var(--shadow-card)",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                {isOutlier ? <Zap size={13} className="text-amber-500" /> : <TrendingUp size={13} className="text-[var(--color-muted-foreground)]" />}
                <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted-foreground)]">
                  {isOutlier ? "⚡ Outlier del canal" : "vs Media del canal"}
                </p>
              </div>
              <div className="flex items-end gap-2 mb-2">
                <p className="text-2xl font-black" style={{ color: isOutlier ? YT_RED : "var(--color-foreground)" }}>
                  {outlierMultiplier.toFixed(1)}x
                </p>
                <p className="text-xs text-[var(--color-muted-foreground)] mb-0.5">la media del canal</p>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--color-muted)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min((outlierMultiplier / 5) * 100, 100)}%`,
                    backgroundColor: isOutlier ? YT_RED : "#10B981",
                  }}
                />
              </div>
              <p className="text-[10px] text-[var(--color-muted-foreground)] mt-1">
                Media del canal: {formatCount(channelAvgViews)} vistas
              </p>
            </div>
          )}

          {/* Like ratio bar */}
          <div className="bg-white rounded-2xl border border-[var(--color-border)] p-4" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Users size={13} className="text-[var(--color-muted-foreground)]" />
              <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted-foreground)]">Aprobación</p>
              <span className="ml-auto text-xs font-black" style={{ color: likeRatio >= 5 ? YT_RED : likeRatio >= 2 ? "#10B981" : "#F59E0B" }}>
                {likeRatio.toFixed(1)}%
              </span>
            </div>
            <div className="space-y-2">
              {[
                { label: "👍 Likes", pct: Math.min(likeRatio * 20, 100), color: YT_RED, value: likeRatio.toFixed(2) + "%" },
                { label: "💬 Comentarios", pct: Math.min(commentRatio * 1000, 100), color: "#F59E0B", value: commentRatio.toFixed(3) + "%" },
                { label: "🔥 Engagement", pct: Math.min(engagementRate * 15, 100), color: "#8B5CF6", value: engagementRate.toFixed(2) + "%" },
              ].map(({ label, pct, color, value }) => (
                <div key={label}>
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-[var(--color-muted-foreground)]">{label}</span>
                    <span className="font-semibold">{value}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ backgroundColor: "var(--color-muted)" }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-[var(--color-muted-foreground)] mt-2">
              {likeRatio >= 5 ? "🔥 Ratio muy alto — contenido muy aprobado" : likeRatio >= 2 ? "✅ Ratio normal" : "⚠️ Ratio bajo — poca interacción"}
            </p>
          </div>

          {/* CTA */}
          <Link
            href={createHref}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: YT_RED }}
          >
            ✦ Crear guion basado en este vídeo
          </Link>
        </div>
      </div>

      {/* ── CHARTS ROW ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

        {/* Evolution chart */}
        <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} style={{ color: YT_RED }} />
            <h2 className="text-sm font-semibold">Evolución estimada de vistas</h2>
          </div>
          <p className="text-[10px] text-[var(--color-muted-foreground)] mb-4">Estimación basada en patrones típicos de YouTube</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={evolutionData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#6B6B6B" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => formatCount(v)} tick={{ fontSize: 9, fill: "#6B6B6B" }} axisLine={false} tickLine={false} width={38} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  return (
                    <div className="bg-white border border-[var(--color-border)] rounded-lg p-2 shadow text-xs">
                      <p className="font-semibold">{payload[0].payload.label}</p>
                      <p style={{ color: YT_RED }}>{formatCount(payload[0].value as number)} vistas est.</p>
                    </div>
                  );
                }}
              />
              <Line type="monotone" dataKey="views" stroke={YT_RED} strokeWidth={2.5} dot={{ fill: YT_RED, r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Channel comparison */}
        {comparisonData.length > 0 && (
          <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center gap-2 mb-1">
              <BarChart2 size={14} className="text-[var(--color-muted-foreground)]" />
              <h2 className="text-sm font-semibold">Comparativa con el canal</h2>
            </div>
            <p className="text-[10px] text-[var(--color-muted-foreground)] mb-4">Este vídeo en rojo · Top vídeos del canal</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={comparisonData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 8, fill: "#6B6B6B" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => formatCount(v)} tick={{ fontSize: 9, fill: "#6B6B6B" }} axisLine={false} tickLine={false} width={38} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-white border border-[var(--color-border)] rounded-lg p-2 shadow text-xs max-w-40">
                        <p className="font-semibold truncate">{d.label}</p>
                        <p>{formatCount(d.views)} vistas</p>
                        {d.isThis && <p style={{ color: YT_RED }} className="font-bold">← Este vídeo</p>}
                      </div>
                    );
                  }}
                />
                <ReferenceLine y={channelAvgViews} stroke="#10B981" strokeDasharray="4 2" strokeWidth={1}
                  label={{ value: "Media", position: "insideTopRight", fontSize: 8, fill: "#10B981" }}
                />
                <Bar dataKey="views" radius={[3, 3, 0, 0]}>
                  {comparisonData.map((entry, i) => (
                    <Cell key={i} fill={entry.isThis ? YT_RED : "#E5E5E5"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── ENGAGEMENT DETAIL ROW ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: "Watch time est.",
            value: estimatedWatchTimeMins >= 1000 ? formatCount(estimatedWatchTimeMins) : `${estimatedWatchTimeMins.toLocaleString("es-ES")}`,
            unit: "minutos",
            icon: "⏱",
            note: "45% retención media",
          },
          {
            label: "Vistas / día",
            value: formatCount(viewsPerDay),
            unit: "vistas/día",
            icon: "📈",
            note: `En ${days} días`,
          },
          {
            label: "Like ratio",
            value: `${likeRatio.toFixed(2)}%`,
            unit: "de espectadores",
            icon: "👍",
            note: likeRatio >= 5 ? "🔥 Muy alto" : likeRatio >= 2 ? "✅ Normal" : "⚠️ Bajo",
          },
          {
            label: "Engagement",
            value: `${engagementRate.toFixed(2)}%`,
            unit: "likes+comentarios/vista",
            icon: "🔥",
            note: engagementRate >= 3 ? "🔥 Viral" : engagementRate >= 1 ? "✅ Bueno" : "⚠️ Bajo",
          },
        ].map(({ label, value, unit, icon, note }) => (
          <div key={label} className="bg-white rounded-2xl border border-[var(--color-border)] p-4" style={{ boxShadow: "var(--shadow-card)" }}>
            <p className="text-lg mb-0.5">{icon}</p>
            <p className="text-xl font-black" style={{ color: YT_RED }}>{value}</p>
            <p className="text-[10px] text-[var(--color-muted-foreground)]">{unit}</p>
            <p className="text-xs font-medium mt-1">{label}</p>
            <p className="text-[10px] text-[var(--color-muted-foreground)] mt-0.5">{note}</p>
          </div>
        ))}
      </div>

      {/* ── TRANSCRIPT ── */}
      {transcript.length > 0 && (
        <div className="mt-4 bg-white rounded-2xl border border-[var(--color-border)]" style={{ boxShadow: "var(--shadow-card)" }}>
          {/* Header — clickable to expand/collapse */}
          <button
            onClick={() => setTranscriptOpen(o => !o)}
            className="w-full flex items-center gap-2 p-4 text-left hover:bg-[var(--color-muted)] rounded-2xl transition-colors"
          >
            <FileText size={14} style={{ color: YT_RED }} />
            <span className="text-sm font-semibold flex-1">Transcripción automática</span>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: YT_RED_LIGHT, color: YT_RED }}
            >
              {transcript.length} segmentos
            </span>
            {transcriptOpen
              ? <ChevronUp size={14} className="text-[var(--color-muted-foreground)]" />
              : <ChevronDown size={14} className="text-[var(--color-muted-foreground)]" />
            }
          </button>

          {/* Body */}
          {transcriptOpen && (
            <div className="px-4 pb-4">
              <div className="h-px bg-[var(--color-border)] mb-3" />
              <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                {transcript.map((seg, i) => (
                  <div key={i} className="flex gap-2 text-xs leading-relaxed">
                    <span
                      className="shrink-0 font-mono font-semibold tabular-nums"
                      style={{ color: YT_RED, minWidth: "2.8rem" }}
                    >
                      {fmtMs(seg.startMs)}
                    </span>
                    <span className="text-[var(--color-foreground)]">{seg.text}</span>
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
