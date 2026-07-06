"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import { Search, Lightbulb, Sparkles, Eye, Filter } from "lucide-react";
import { formatCount } from "@/lib/youtube";
import type { YTVideo } from "@/lib/youtube";
import type { Profile } from "@/types";
import { IdeaVideoCard } from "./idea-video-card";
import { VideoCardSkeleton } from "./skeletons";
import { UpgradeModal } from "@/components/shared/upgrade-modal";

const YT_RED = "#FF0000";
const YT_RED_LIGHT = "rgba(255,0,0,0.07)";

type FormatFilter = "all" | "short" | "long";
type SortFilter = "views" | "recent" | "comments";
type DateFilter = "any" | "year" | "6months" | "month";

interface IdeaAnalysis {
  common_patterns?: string;
  top_keywords?: string[];
  best_angle?: string;
  recommended_format?: string;
  format_reasoning?: string;
  suggested_title?: string;
  suggested_title_alternatives?: string[];
  content_gaps?: string;
}

interface Props {
  profile: Profile;
}

const EXAMPLES = [
  "viví sin móvil una semana",
  "perdí 10kg en 30 días",
  "dormí solo 4 horas durante un mes",
  "gasté todo mi sueldo en una semana",
];

export function IdeasSearch({ profile }: Props) {
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [rawVideos, setRawVideos] = useState<YTVideo[]>([]);
  const [searched, setSearched] = useState(false);
  const [format, setFormat] = useState<FormatFilter>("all");
  const [sort, setSort] = useState<SortFilter>("views");
  const [dateFilter, setDateFilter] = useState<DateFilter>("any");
  const [aiResult, setAiResult] = useState<IdeaAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);


  const filteredVideos = useMemo(() => {
    let videos = [...rawVideos];
    if (dateFilter !== "any") {
      const days = { year: 365, "6months": 182, month: 30 }[dateFilter];
      const cutoff = Date.now() - days * 86400000;
      videos = videos.filter(v => new Date(v.publishedAt).getTime() >= cutoff);
    }
    if (format === "short") videos = videos.filter(v => v.durationSecs <= 180);
    if (format === "long") videos = videos.filter(v => v.durationSecs > 180);
    if (sort === "recent") videos.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    if (sort === "comments") videos.sort((a, b) => b.comments - a.comments);
    return videos;
  }, [rawVideos, format, sort, dateFilter]);

  const maxViews = rawVideos[0]?.views ?? 0;
  const avgViews = rawVideos.length
    ? Math.round(rawVideos.reduce((s, v) => s + v.views, 0) / rawVideos.length)
    : 0;
  const oldestDate = rawVideos.length
    ? new Date(Math.min(...rawVideos.map(v => new Date(v.publishedAt).getTime())))
    : null;

  const doSearch = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    setActiveQuery(q);
    setAiResult(null);
    setFormat("all");
    setSort("views");
    setDateFilter("any");
    try {
      const res = await fetch(`/api/youtube/search-ideas?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setRawVideos(data.videos ?? []);
    } catch {
      setRawVideos([]);
    } finally {
      setLoading(false);
    }
  };

  const analyzeWithAI = async () => {
    if (!rawVideos.length) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/analyze-idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: activeQuery,
          videos: rawVideos.slice(0, 10).map(v => ({
            title: v.title, views: v.views, publishedAt: v.publishedAt,
          })),
        }),
      });
      if (res.status === 402) { setShowUpgrade(true); setAiLoading(false); return; }
      const data = await res.json();
      if (data.analysis) setAiResult(data.analysis);
    } catch { /* ignore */ }
    finally { setAiLoading(false); }
  };

  const FilterBtn = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap"
      style={{ backgroundColor: active ? YT_RED : "#fff", color: active ? "#fff" : "var(--color-foreground)" }}
    >
      {children}
    </button>
  );

  return (
    <div>
      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} creditsRemaining={profile.credits_remaining} plan={profile.plan} />

      {!searched ? (
        /* ── Hero search state ── */
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6" style={{ backgroundColor: YT_RED_LIGHT }}>
            <Lightbulb size={28} style={{ color: YT_RED }} />
          </div>
          <h2 className="text-2xl font-semibold mb-2">Buscador de ideas</h2>
          <p className="text-base text-[var(--color-muted-foreground)] mb-8 max-w-md">
            Escribe tu idea de vídeo y descubre qué ya existe, qué ha funcionado y cómo diferenciarte.
          </p>
          <div className="w-full max-w-xl flex gap-3">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && doSearch(query)}
                placeholder="Ej: me hice viral en 7 días, probé la dieta de MrBeast…"
                className="w-full pl-12 pr-4 py-4 text-base rounded-xl border border-[var(--color-border)] bg-white focus:outline-none transition-colors"
                onFocus={e => (e.target.style.borderColor = YT_RED)}
                onBlur={e => (e.target.style.borderColor = "")}
              />
            </div>
            <button
              onClick={() => doSearch(query)}
              disabled={!query.trim()}
              className="px-6 py-4 text-base font-semibold rounded-xl text-white transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ backgroundColor: YT_RED }}
            >
              Analizar →
            </button>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-5">
            {EXAMPLES.map(ex => (
              <button
                key={ex}
                onClick={() => { setQuery(ex); inputRef.current?.focus(); }}
                className="text-xs px-3 py-1.5 rounded-full border border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:border-[var(--color-foreground)] hover:text-[var(--color-foreground)] transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ── Results state ── */
        <div>
          {/* Compact search */}
          <div className="flex gap-3 mb-6">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && doSearch(query)}
                placeholder="¿Qué vídeo quieres hacer?"
                className="w-full pl-11 pr-4 py-3 text-base rounded-xl border border-[var(--color-border)] bg-white focus:outline-none transition-colors"
                onFocus={e => (e.target.style.borderColor = YT_RED)}
                onBlur={e => (e.target.style.borderColor = "")}
              />
            </div>
            <button
              onClick={() => doSearch(query)}
              disabled={loading || !query.trim()}
              className="px-5 py-3 text-sm font-semibold rounded-xl text-white transition-opacity hover:opacity-80 disabled:opacity-60"
              style={{ backgroundColor: YT_RED }}
            >
              Analizar →
            </button>
          </div>

          {loading ? (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                {[0, 1, 2, 3].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => <VideoCardSkeleton key={i} />)}
              </div>
            </div>
          ) : rawVideos.length === 0 ? (
            <div className="text-center py-20 rounded-2xl border border-dashed border-[var(--color-border)]">
              <p className="text-3xl mb-3">🎬</p>
              <p className="font-semibold text-lg mb-1">No encontramos vídeos sobre esta idea</p>
              <p className="text-sm text-[var(--color-muted-foreground)] mb-6">¡Sé el primero en hacerlo!</p>
              <Link
                href={`/crear?tema=${encodeURIComponent(activeQuery)}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-80"
                style={{ backgroundColor: YT_RED }}
              >
                Crear guion sobre esta idea →
              </Link>
            </div>
          ) : (
            <>
              {/* Summary metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {[
                  { label: "Vídeos encontrados", value: rawVideos.length.toString(), icon: "🎬" },
                  { label: "Top vídeo", value: formatCount(maxViews) + " vistas", icon: "👑" },
                  { label: "Media de vistas", value: formatCount(avgViews), icon: "📊" },
                  { label: "Primer vídeo", value: oldestDate ? oldestDate.toLocaleDateString("es-ES", { month: "short", year: "numeric" }) : "—", icon: "📅" },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="bg-white rounded-2xl border border-[var(--color-border)] p-4" style={{ boxShadow: "var(--shadow-card)" }}>
                    <p className="text-xl mb-1">{icon}</p>
                    <p className="text-lg font-bold" style={{ color: YT_RED }}>{value}</p>
                    <p className="text-xs text-[var(--color-muted-foreground)]">{label}</p>
                  </div>
                ))}
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2 mb-5 p-3 rounded-xl overflow-x-auto" style={{ backgroundColor: "var(--color-muted)" }}>
                <Filter size={13} className="text-[var(--color-muted-foreground)] flex-shrink-0" />
                <span className="text-xs text-[var(--color-muted-foreground)] font-medium">Formato:</span>
                <FilterBtn active={format === "all"} onClick={() => setFormat("all")}>Todos</FilterBtn>
                <FilterBtn active={format === "short"} onClick={() => setFormat("short")}>Solo Shorts</FilterBtn>
                <FilterBtn active={format === "long"} onClick={() => setFormat("long")}>Solo Largos</FilterBtn>
                <div className="w-px h-4 bg-[var(--color-border)] flex-shrink-0" />
                <span className="text-xs text-[var(--color-muted-foreground)] font-medium">Ordenar:</span>
                <FilterBtn active={sort === "views"} onClick={() => setSort("views")}>Más vistos</FilterBtn>
                <FilterBtn active={sort === "recent"} onClick={() => setSort("recent")}>Más recientes</FilterBtn>
                <FilterBtn active={sort === "comments"} onClick={() => setSort("comments")}>Más comentarios</FilterBtn>
                <div className="w-px h-4 bg-[var(--color-border)] flex-shrink-0" />
                <span className="text-xs text-[var(--color-muted-foreground)] font-medium">Fecha:</span>
                <FilterBtn active={dateFilter === "any"} onClick={() => setDateFilter("any")}>Cualquier fecha</FilterBtn>
                <FilterBtn active={dateFilter === "year"} onClick={() => setDateFilter("year")}>Último año</FilterBtn>
                <FilterBtn active={dateFilter === "6months"} onClick={() => setDateFilter("6months")}>6 meses</FilterBtn>
                <FilterBtn active={dateFilter === "month"} onClick={() => setDateFilter("month")}>Último mes</FilterBtn>
              </div>

              {/* AI Analysis */}
              {!aiResult ? (
                <div className="flex items-center gap-4 mb-5 p-4 rounded-2xl border border-[var(--color-border)] bg-white" style={{ boxShadow: "var(--shadow-card)" }}>
                  <Sparkles size={20} style={{ color: YT_RED }} className="flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">Analiza esta idea con IA</p>
                    <p className="text-xs text-[var(--color-muted-foreground)]">Descubre el ángulo ganador, palabras clave y el mejor título posible.</p>
                  </div>
                  <button
                    onClick={analyzeWithAI}
                    disabled={aiLoading}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-80 disabled:opacity-60 flex-shrink-0"
                    style={{ backgroundColor: YT_RED }}
                  >
                    <Sparkles size={13} />
                    {aiLoading ? "Analizando…" : "Analizar · 2 créditos"}
                  </button>
                </div>
              ) : (
                <div className="mb-5 p-5 rounded-2xl border bg-white space-y-4" style={{ borderColor: YT_RED, boxShadow: "0 4px 20px rgba(255,0,0,0.08)" }}>
                  <div className="flex items-center gap-2">
                    <Sparkles size={15} style={{ color: YT_RED }} />
                    <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: YT_RED }}>Análisis de la idea</h3>
                  </div>
                  {aiResult.common_patterns && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-1.5">Lo que tienen en común los más vistos</p>
                      <p className="text-sm leading-relaxed">{aiResult.common_patterns}</p>
                    </div>
                  )}
                  {(aiResult.top_keywords?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-2">Palabras clave en títulos ganadores</p>
                      <div className="flex flex-wrap gap-2">
                        {aiResult.top_keywords!.map((kw, i) => (
                          <span key={i} className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: YT_RED_LIGHT, color: YT_RED }}>{kw}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {aiResult.best_angle && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-1.5">Mejor ángulo para diferenciarte</p>
                      <p className="text-sm leading-relaxed">{aiResult.best_angle}</p>
                    </div>
                  )}
                  {aiResult.content_gaps && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-1.5">Tu oportunidad</p>
                      <p className="text-sm leading-relaxed">{aiResult.content_gaps}</p>
                    </div>
                  )}
                  {aiResult.suggested_title && (
                    <div className="p-3 rounded-xl" style={{ backgroundColor: YT_RED_LIGHT }}>
                      <p className="text-xs font-bold mb-1.5" style={{ color: YT_RED }}>Título sugerido</p>
                      <p className="text-sm font-semibold">{aiResult.suggested_title}</p>
                      {aiResult.suggested_title_alternatives?.map((t, i) => (
                        <p key={i} className="text-xs text-[var(--color-muted-foreground)] mt-1">· {t}</p>
                      ))}
                    </div>
                  )}
                  <Link
                    href={`/crear?tema=${encodeURIComponent(aiResult.suggested_title ?? activeQuery)}`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-80"
                    style={{ backgroundColor: YT_RED }}
                  >
                    ✦ Crear guion con este análisis →
                  </Link>
                </div>
              )}

              {/* Video grid */}
              {filteredVideos.length === 0 ? (
                <div className="text-center py-12 rounded-2xl border border-dashed border-[var(--color-border)]">
                  <p className="text-sm text-[var(--color-muted-foreground)]">No hay vídeos con estos filtros. Prueba a cambiarlos.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-[var(--color-muted-foreground)] mb-3">{filteredVideos.length} vídeos sobre <strong>"{activeQuery}"</strong></p>
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredVideos.map((video, i) => (
                      <IdeaVideoCard key={video.id} video={video} rank={i + 1} isTop={i < 3} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
