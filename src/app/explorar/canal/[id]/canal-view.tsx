"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Users, Eye, PlaySquare, Bookmark, BookmarkCheck, Sparkles, Zap, TrendingUp, Calendar, BarChart2 } from "lucide-react";
import { formatCount } from "@/lib/youtube";
import { ViewsChart } from "@/components/explorar/views-chart";
import { VideoCard } from "@/components/explorar/video-card";
import { UpgradeModal } from "@/components/shared/upgrade-modal";
import type { YTChannel, YTVideo } from "@/lib/youtube";
import type { Profile } from "@/types";
import { createClient } from "@/lib/supabase/client";

const YT_RED = "#FF0000";
const YT_RED_LIGHT = "rgba(255,0,0,0.07)";

interface Props {
  channel: YTChannel;
  videos: YTVideo[];
  freqLabel: string;
  profile: Profile;
  initialInWatchlist: boolean;
}

export function CanalView({ channel, videos, freqLabel, profile, initialInWatchlist }: Props) {
  const [inWatchlist, setInWatchlist] = useState(initialInWatchlist);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [aiResult, setAiResult] = useState<Record<string, unknown> | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showOutliersOnly, setShowOutliersOnly] = useState(false);
  const [contentType, setContentType] = useState<"all" | "short" | "long">("all");

  // Filter videos by content type
  const filteredVideos = useMemo(() => {
    if (contentType === "short") return videos.filter(v => v.durationSecs <= 60);
    if (contentType === "long") return videos.filter(v => v.durationSecs > 60);
    return videos;
  }, [videos, contentType]);

  // Recalculate metrics from filtered set
  const avgViews = filteredVideos.length
    ? Math.round(filteredVideos.reduce((s, v) => s + v.views, 0) / filteredVideos.length)
    : 0;

  const mostViralVideo = filteredVideos.length
    ? filteredVideos.reduce((a, b) => a.views > b.views ? a : b)
    : null;

  const outlierIds = filteredVideos.filter(v => v.views > avgViews * 2).map(v => v.id);

  const multiplier = mostViralVideo
    ? (mostViralVideo.views / Math.max(avgViews, 1)).toFixed(1)
    : null;

  const displayVideos = showOutliersOnly
    ? filteredVideos.filter(v => outlierIds.includes(v.id))
    : filteredVideos;

  const toggleWatchlist = async () => {
    setWatchlistLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setWatchlistLoading(false); return; }

    if (inWatchlist) {
      await supabase.from("watchlist_channels").delete()
        .eq("user_id", user.id).eq("channel_url", channel.id);
      setInWatchlist(false);
    } else {
      await supabase.from("watchlist_channels").insert({
        user_id: user.id,
        channel_name: channel.name,
        channel_url: channel.id,
        platform: "youtube",
        subscribers: formatCount(channel.subscribers),
        engagement_tag: channel.thumbnail,
      });
      setInWatchlist(true);
    }
    setWatchlistLoading(false);
  };

  const analyzeWithAI = async () => {
    setAiLoading(true);
    setAiResult(null);
    const res = await fetch("/api/ai/analyze-channel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channelName: channel.name,
        channelDescription: channel.description,
        subscribers: channel.subscribers,
        totalViews: channel.totalViews,
        videoCount: channel.videoCount,
        recentVideos: videos.slice(0, 5).map(v => ({ title: v.title, views: v.views })),
      }),
    });
    if (res.status === 402) { setShowUpgrade(true); setAiLoading(false); return; }
    const data = await res.json();
    setAiResult(data);
    setAiLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} creditsRemaining={profile.credits_remaining} plan={profile.plan} />

      {/* Back */}
      <Link href="/explorar" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] mb-6">
        <ArrowLeft size={14} /> Explorar
      </Link>

      {/* Channel Header */}
      <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5 mb-4" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={channel.thumbnail} alt={channel.name} className="w-16 h-16 rounded-full object-cover flex-shrink-0" style={{ background: "var(--color-muted)" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-xl font-semibold text-[var(--color-foreground)]">{channel.name}</h1>
                {channel.customUrl && <p className="text-sm text-[var(--color-muted-foreground)]">{channel.customUrl}</p>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={toggleWatchlist}
                  disabled={watchlistLoading}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-foreground)] transition-colors"
                >
                  {inWatchlist
                    ? <><BookmarkCheck size={13} style={{ color: YT_RED }} /> En watchlist</>
                    : <><Bookmark size={13} /> Añadir a watchlist</>
                  }
                </button>
                <button
                  onClick={analyzeWithAI}
                  disabled={aiLoading}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl text-white transition-opacity hover:opacity-80 disabled:opacity-60"
                  style={{ backgroundColor: YT_RED }}
                >
                  <Sparkles size={13} />
                  {aiLoading ? "Analizando…" : "Analizar con IA · 2 créditos"}
                </button>
              </div>
            </div>
            <p className="text-sm text-[var(--color-muted-foreground)] mt-2 line-clamp-2">{channel.description}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          {[
            { icon: Users, label: "Suscriptores", value: formatCount(channel.subscribers) },
            { icon: Eye,   label: "Vistas totales", value: formatCount(channel.totalViews) },
            { icon: PlaySquare, label: "Vídeos", value: formatCount(channel.videoCount) },
            { icon: Calendar, label: "Frecuencia", value: freqLabel },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-xl p-3" style={{ backgroundColor: "var(--color-muted)" }}>
              <div className="flex items-center gap-1.5 mb-1">
                <Icon size={13} className="text-[var(--color-muted-foreground)]" />
                <span className="text-[10px] text-[var(--color-muted-foreground)]">{label}</span>
              </div>
              <span className="text-sm font-semibold text-[var(--color-foreground)]">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Content type toggle */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs text-[var(--color-muted-foreground)]">Tipo de contenido:</span>
        <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: "var(--color-muted)" }}>
          {(["all", "long", "short"] as const).map(t => (
            <button
              key={t}
              onClick={() => { setContentType(t); setShowOutliersOnly(false); }}
              className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
              style={{
                backgroundColor: contentType === t ? "#fff" : "transparent",
                color: contentType === t ? "var(--color-foreground)" : "var(--color-muted-foreground)",
                boxShadow: contentType === t ? "var(--shadow-card)" : "none",
              }}
            >
              {t === "all" ? "Todo" : t === "long" ? "Largo" : "Shorts"}
            </button>
          ))}
        </div>
        {filteredVideos.length !== videos.length && (
          <span className="text-xs text-[var(--color-muted-foreground)]">{filteredVideos.length} vídeos</span>
        )}
      </div>

      {/* Outlier metrics */}
      {mostViralVideo && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-2xl border border-[var(--color-border)] p-4" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={14} style={{ color: YT_RED }} />
              <span className="text-xs font-semibold text-[var(--color-muted-foreground)]">Promedio vistas</span>
            </div>
            <p className="text-lg font-semibold">{formatCount(avgViews)}</p>
          </div>
          <div className="bg-white rounded-2xl border p-4" style={{ borderColor: YT_RED, boxShadow: "0 4px 16px rgba(255,0,0,0.08)" }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm">🔥</span>
              <span className="text-xs font-semibold text-[var(--color-muted-foreground)]">Vídeo más viral</span>
            </div>
            <p className="text-lg font-semibold">{formatCount(mostViralVideo.views)}</p>
            {multiplier && <p className="text-xs font-medium" style={{ color: YT_RED }}>{multiplier}x el promedio</p>}
          </div>
          <div className="bg-white rounded-2xl border border-[var(--color-border)] p-4" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center gap-2 mb-1">
              <Zap size={14} className="text-amber-500" />
              <span className="text-xs font-semibold text-[var(--color-muted-foreground)]">Outliers detectados</span>
            </div>
            <p className="text-lg font-semibold">{outlierIds.length} vídeos</p>
            <p className="text-xs text-[var(--color-muted-foreground)]">+2x el promedio</p>
          </div>
        </div>
      )}

      {/* Chart */}
      {filteredVideos.length > 0 && (
        <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5 mb-4" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={15} className="text-[var(--color-muted-foreground)]" />
            <h2 className="text-sm font-semibold">Vistas de los últimos {filteredVideos.length} vídeos</h2>
            <span className="text-xs text-[var(--color-muted-foreground)] ml-auto">Outliers en rojo</span>
          </div>
          <ViewsChart videos={filteredVideos} avgViews={avgViews} outlierIds={outlierIds} />
        </div>
      )}

      {/* AI Analysis */}
      {aiResult && (
        <div className="bg-white rounded-2xl border p-5 mb-4" style={{ borderColor: YT_RED, boxShadow: "0 4px 16px rgba(255,0,0,0.08)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={15} style={{ color: YT_RED }} />
            <h2 className="text-sm font-semibold">Análisis IA</h2>
          </div>
          <div className="space-y-4">
            {typeof aiResult.summary === "string" && aiResult.summary && (
              <p className="text-sm text-[var(--color-foreground)] leading-relaxed">{aiResult.summary}</p>
            )}
            {Array.isArray(aiResult.viral_patterns) && aiResult.viral_patterns.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-widest mb-2">Patrones virales</p>
                <ul className="space-y-1.5">
                  {(aiResult.viral_patterns as string[]).map((p, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span style={{ color: YT_RED }}>✦</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {Array.isArray(aiResult.actionable_strategies) && aiResult.actionable_strategies.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-widest mb-2">Estrategias accionables</p>
                <ul className="space-y-1.5">
                  {(aiResult.actionable_strategies as string[]).map((s, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-green-500">→</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {typeof aiResult.kill_shot === "string" && aiResult.kill_shot && (
              <div className="rounded-xl p-3" style={{ backgroundColor: YT_RED_LIGHT }}>
                <p className="text-xs font-semibold mb-1" style={{ color: YT_RED }}>Punto de diferenciación clave</p>
                <p className="text-sm text-[var(--color-foreground)]">{aiResult.kill_shot}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Videos */}
      <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Últimos vídeos</h2>
          {outlierIds.length > 0 && (
            <button
              onClick={() => setShowOutliersOnly(v => !v)}
              className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
              style={{
                backgroundColor: showOutliersOnly ? YT_RED : "var(--color-muted)",
                color: showOutliersOnly ? "#fff" : "var(--color-foreground)",
              }}
            >
              {showOutliersOnly ? "Ver todos" : `⚡ Solo outliers (${outlierIds.length})`}
            </button>
          )}
        </div>
        {displayVideos.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)] text-center py-8">
            {filteredVideos.length === 0 ? "No hay vídeos de este tipo en este canal." : "Sin vídeos que mostrar."}
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {displayVideos.map(video => (
              <VideoCard
                key={video.id}
                video={video}
                isOutlier={outlierIds.includes(video.id)}
                isMostViral={video.id === mostViralVideo?.id}
                channelName={channel.name}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
