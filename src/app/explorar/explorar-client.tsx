"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, Bookmark, GitCompare, X, ChevronRight, Eye, Globe } from "lucide-react";
import { ChannelCard } from "@/components/explorar/channel-card";
import { TrendingVideoCard } from "@/components/explorar/trending-video-card";
import { ChannelCardSkeleton, VideoCardSkeleton } from "@/components/explorar/skeletons";
import { UpgradeModal } from "@/components/shared/upgrade-modal";
import { formatCount } from "@/lib/youtube";
import type { YTChannel, YTVideo } from "@/lib/youtube";
import type { Profile } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { IdeasSearch } from "@/components/explorar/ideas-search";

const YT_RED = "#FF0000";
const YT_RED_LIGHT = "rgba(255,0,0,0.07)";

const NICHES = ["Gaming", "Educación", "Finanzas", "Lifestyle", "Tech", "Fitness", "Comedia", "Viajes", "Negocios"];
const SIZES = [
  { label: "Nano", sublabel: "1K–10K", min: 1000, max: 10000 },
  { label: "Micro", sublabel: "10K–100K", min: 10000, max: 100000 },
  { label: "Mid", sublabel: "100K–1M", min: 100000, max: 1000000 },
  { label: "Macro", sublabel: ">1M", min: 1000000, max: Infinity },
];
const PERIODS = [
  { key: "24h", label: "24h" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
  { key: "3months", label: "3 Meses" },
  { key: "year", label: "Año" },
];
const COUNTRIES = [
  { code: "GLOBAL", label: "🌍 Global" },
  { code: "ES", label: "España" },
  { code: "MX", label: "México" },
  { code: "US", label: "USA" },
  { code: "AR", label: "Argentina" },
  { code: "CO", label: "Colombia" },
  { code: "CL", label: "Chile" },
  { code: "PE", label: "Perú" },
  { code: "BR", label: "Brasil" },
  { code: "GB", label: "UK" },
  { code: "DE", label: "Alemania" },
  { code: "FR", label: "Francia" },
  { code: "JP", label: "Japón" },
];

interface WatchlistEntry {
  channel_url: string;
  channel_name: string;
  subscribers: string;
  engagement_tag: string;
}

interface Props {
  profile: Profile;
  initialWatchlist: WatchlistEntry[];
}

export function ExplorarClient({ profile, initialWatchlist }: Props) {
  const [query, setQuery] = useState("");
  const [activeNiche, setActiveNiche] = useState<string | null>(null);
  const [activeSize, setActiveSize] = useState<string | null>(null);
  const [results, setResults] = useState<YTChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [tab, setTab] = useState<"buscar" | "watchlist" | "comparar" | "ideas">("buscar");
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>(initialWatchlist);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Trending state
  const [contentType, setContentType] = useState<"all" | "short" | "long">("all");
  const [period, setPeriod] = useState("week");
  const [country, setCountry] = useState("GLOBAL");
  const [excludeKids, setExcludeKids] = useState(true);
  const [excludeMusic, setExcludeMusic] = useState(true);
  const [trending, setTrending] = useState<YTVideo[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);

  const [trendingError, setTrendingError] = useState<string | null>(null);

  const loadTrending = useCallback(async (p: string, c: string, t: string, kids: boolean, music: boolean) => {
    setTrendingLoading(true);
    setTrendingError(null);
    try {
      const params = new URLSearchParams({ period: p, country: c, type: t, excludeKids: String(kids), excludeMusic: String(music) });
      const res = await fetch(`/api/youtube/trending?${params}`);
      const data = await res.json();
      if (data.error && !data.videos?.length) {
        setTrendingError(data.error);
        setTrending([]);
      } else {
        setTrending(data.videos ?? []);
      }
    } catch (e) {
      setTrendingError(e instanceof Error ? e.message : "Error de red");
      setTrending([]);
    } finally {
      setTrendingLoading(false);
    }
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
    loadTrending("week", country, contentType, excludeKids, excludeMusic);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = async (overrideQuery?: string, overrideNiche?: string | null) => {
    const q = overrideQuery ?? query;
    const nicho = overrideNiche !== undefined ? overrideNiche : activeNiche;
    if (!q.trim() && !nicho) return;
    setLoading(true);
    setSearched(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (nicho) params.set("nicho", nicho);
    if (activeSize) {
      const s = SIZES.find(s => s.label === activeSize);
      if (s) { params.set("minSubs", String(s.min)); params.set("maxSubs", String(s.max)); }
    }
    const res = await fetch(`/api/youtube/search?${params}`);
    const data = await res.json();
    setResults(data.channels ?? []);
    setLoading(false);
  };

  const toggleWatchlist = async (channel: YTChannel) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const inList = watchlist.some(w => w.channel_url === channel.id);
    if (inList) {
      await supabase.from("watchlist_channels").delete().eq("user_id", user.id).eq("channel_url", channel.id);
      setWatchlist(prev => prev.filter(w => w.channel_url !== channel.id));
    } else {
      const entry = { user_id: user.id, channel_name: channel.name, channel_url: channel.id, platform: "youtube", subscribers: formatCount(channel.subscribers), engagement_tag: channel.thumbnail };
      await supabase.from("watchlist_channels").insert(entry);
      setWatchlist(prev => [...prev, { channel_url: channel.id, channel_name: channel.name, subscribers: formatCount(channel.subscribers), engagement_tag: channel.thumbnail }]);
    }
  };

  const toggleCompare = (id: string) => {
    setCompareIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 2 ? [...prev, id] : prev
    );
  };

  const compareChannels = results.filter(c => compareIds.includes(c.id));


  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} creditsRemaining={profile.credits_remaining} plan={profile.plan} />

      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold mb-1 md:mb-2">Explorar</h1>
        <p className="text-sm md:text-base text-[var(--color-muted-foreground)]">Descubre vídeos trending y analiza cualquier canal de YouTube.</p>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto mb-6 md:mb-8" style={{ scrollbarWidth: "none" }}>
        <div className="flex gap-1 bg-[var(--color-muted)] p-1 rounded-xl w-fit min-w-0">
          {(["buscar", "watchlist", "comparar", "ideas"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-shrink-0 whitespace-nowrap px-4 md:px-5 py-2 rounded-lg text-sm font-medium capitalize transition-colors"
              style={{
                backgroundColor: tab === t ? "#fff" : "transparent",
                color: tab === t ? "var(--color-foreground)" : "var(--color-muted-foreground)",
                boxShadow: tab === t ? "var(--shadow-card)" : "none",
              }}
            >
              {t === "watchlist" ? `Watchlist (${watchlist.length})` : t === "comparar" ? `Comparar${compareIds.length ? ` (${compareIds.length})` : ""}` : t === "ideas" ? "💡 Ideas" : "Buscar"}
            </button>
          ))}
        </div>
      </div>

      {/* ── BUSCAR TAB ── */}
      {tab === "buscar" && (
        <>
          {/* Search bar */}
          <div className="flex gap-3 mb-5">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && search()}
                placeholder="Busca un canal de YouTube…"
                className="w-full pl-11 pr-4 py-3 text-base rounded-xl border border-[var(--color-border)] bg-white focus:outline-none transition-colors"
                onFocus={e => (e.target.style.borderColor = YT_RED)}
                onBlur={e => (e.target.style.borderColor = "")}
              />
            </div>
            <button
              onClick={() => search()}
              disabled={loading}
              className="px-6 py-3 text-base font-medium rounded-xl text-white transition-opacity hover:opacity-80 disabled:opacity-60"
              style={{ backgroundColor: YT_RED }}
            >
              Buscar
            </button>
          </div>

          {/* Niche + size filters (shown only when searching channels) */}
          {searched && (
            <>
              <div className="flex flex-wrap gap-2 mb-3">
                {NICHES.map(n => (
                  <button
                    key={n}
                    onClick={() => {
                      const next = activeNiche === n ? null : n;
                      setActiveNiche(next);
                      if (query || next) search(query, next);
                    }}
                    className="px-3 py-1 text-xs font-medium rounded-full border transition-colors"
                    style={{
                      backgroundColor: activeNiche === n ? YT_RED : "var(--color-muted)",
                      borderColor: activeNiche === n ? YT_RED : "transparent",
                      color: activeNiche === n ? "#fff" : "var(--color-foreground)",
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 mb-6">
                {SIZES.map(s => (
                  <button
                    key={s.label}
                    onClick={() => setActiveSize(prev => prev === s.label ? null : s.label)}
                    className="px-3 py-1 text-xs font-medium rounded-full border transition-colors"
                    style={{
                      backgroundColor: activeSize === s.label ? "var(--color-foreground)" : "var(--color-muted)",
                      borderColor: activeSize === s.label ? "var(--color-foreground)" : "transparent",
                      color: activeSize === s.label ? "#fff" : "var(--color-foreground)",
                    }}
                  >
                    {s.label} <span className="opacity-60 ml-1">{s.sublabel}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Channel results */}
          {(searched || loading) && (
            loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[0,1,2,3].map(i => <ChannelCardSkeleton key={i} />)}
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-16 rounded-2xl border border-dashed border-[var(--color-border)]">
                <p className="text-sm text-[var(--color-muted-foreground)]">No encontramos canales. Prueba con otro término →</p>
              </div>
            ) : (
              <>
                {compareIds.length > 0 && (
                  <div className="flex items-center gap-2 mb-3 p-3 rounded-xl" style={{ backgroundColor: YT_RED_LIGHT }}>
                    <GitCompare size={14} style={{ color: YT_RED }} />
                    <p className="text-xs font-medium" style={{ color: YT_RED }}>
                      {compareIds.length === 1 ? "Selecciona otro canal para comparar" : "2 canales seleccionados"}
                    </p>
                    {compareIds.length === 2 && (
                      <button onClick={() => setTab("comparar")} className="ml-auto flex items-center gap-1 text-xs font-semibold" style={{ color: YT_RED }}>
                        Ver comparativa <ChevronRight size={12} />
                      </button>
                    )}
                    <button onClick={() => setCompareIds([])} className="p-0.5 rounded" style={{ color: YT_RED }}>
                      <X size={13} />
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {results.map(ch => (
                    <ChannelCard
                      key={ch.id}
                      channel={ch}
                      inWatchlist={watchlist.some(w => w.channel_url === ch.id)}
                      onToggleWatchlist={() => toggleWatchlist(ch)}
                      inCompare={compareIds.includes(ch.id)}
                      onToggleCompare={() => toggleCompare(ch.id)}
                      compareDisabled={compareIds.length >= 2 && !compareIds.includes(ch.id)}
                    />
                  ))}
                </div>
              </>
            )
          )}

          {/* Trending section */}
          {!searched && (
            <div className="flex flex-col md:flex-row gap-6 md:gap-8">
              {/* Filters — horizontal scroll on mobile, vertical sidebar on desktop */}
              <aside className="md:w-56 md:flex-shrink-0 space-y-4 md:space-y-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-2 md:mb-3">Tipo</p>
                  <div className="flex flex-row md:flex-col gap-1.5 overflow-x-auto pb-1 md:pb-0" style={{ scrollbarWidth: "none" }}>
                    {(["all", "long", "short"] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => { setContentType(t); loadTrending(period, country, t, excludeKids, excludeMusic); }}
                        className="flex-shrink-0 md:w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                        style={{
                          backgroundColor: contentType === t ? YT_RED : "var(--color-muted)",
                          color: contentType === t ? "#fff" : "var(--color-foreground)",
                        }}
                      >
                        {t === "all" ? "Todo" : t === "long" ? "🎬 Largo" : "📱 Shorts"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-px bg-[var(--color-border)]" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-2 md:mb-3">Período</p>
                  <div className="flex flex-row md:flex-col gap-1.5 overflow-x-auto pb-1 md:pb-0" style={{ scrollbarWidth: "none" }}>
                    {PERIODS.map(p => (
                      <button
                        key={p.key}
                        onClick={() => { setPeriod(p.key); loadTrending(p.key, country, contentType, excludeKids, excludeMusic); }}
                        className="flex-shrink-0 md:w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                        style={{
                          backgroundColor: period === p.key ? YT_RED : "var(--color-muted)",
                          color: period === p.key ? "#fff" : "var(--color-foreground)",
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-px bg-[var(--color-border)]" />
                <div>
                  <div className="flex items-center gap-1.5 mb-2 md:mb-3">
                    <Globe size={13} className="text-[var(--color-muted-foreground)]" />
                    <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted-foreground)]">País</p>
                  </div>
                  <select
                    value={country}
                    onChange={e => { setCountry(e.target.value); loadTrending(period, e.target.value, contentType, excludeKids, excludeMusic); }}
                    className="w-full md:w-full px-3 py-2 rounded-lg text-sm border border-[var(--color-border)] bg-white focus:outline-none cursor-pointer"
                    style={{ color: "var(--color-foreground)", maxWidth: "200px" }}
                  >
                    {COUNTRIES.map(c => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="h-px bg-[var(--color-border)]" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-2 md:mb-3">Excluir</p>
                  <div className="flex flex-row md:flex-col gap-4 md:gap-3">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={excludeKids}
                        onChange={e => { setExcludeKids(e.target.checked); loadTrending(period, country, contentType, e.target.checked, excludeMusic); }}
                        style={{ accentColor: YT_RED }}
                      />
                      <span className="text-sm text-[var(--color-foreground)] whitespace-nowrap">Infantil</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={excludeMusic}
                        onChange={e => { setExcludeMusic(e.target.checked); loadTrending(period, country, contentType, excludeKids, e.target.checked); }}
                        style={{ accentColor: YT_RED }}
                      />
                      <span className="text-sm text-[var(--color-foreground)] whitespace-nowrap">Videoclips</span>
                    </label>
                  </div>
                </div>
              </aside>

              {/* Main content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-4 md:mb-5">
                  <Eye size={16} style={{ color: YT_RED }} />
                  <h2 className="text-base font-semibold">Vídeos más vistos</h2>
                  <span className="text-xs md:text-sm text-[var(--color-muted-foreground)] ml-auto">
                    {COUNTRIES.find(c => c.code === country)?.label} · {PERIODS.find(p => p.key === period)?.label}
                  </span>
                </div>

                {trendingLoading ? (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
                    {[0,1,2,3,4,5].map(i => <VideoCardSkeleton key={i} />)}
                  </div>
                ) : trendingError ? (
                  <div className="text-center py-16 rounded-2xl border border-dashed border-red-200">
                    <p className="text-sm font-medium text-red-600 mb-1">Error al cargar vídeos</p>
                    <p className="text-xs text-[var(--color-muted-foreground)] font-mono">{trendingError}</p>
                  </div>
                ) : trending.length === 0 ? (
                  <div className="text-center py-16 rounded-2xl border border-dashed border-[var(--color-border)]">
                    <p className="text-sm text-[var(--color-muted-foreground)]">Sin resultados para este filtro</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
                    {trending.map((v, i) => (
                      <TrendingVideoCard key={v.id} video={v} rank={i + 1} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── WATCHLIST TAB ── */}
      {tab === "watchlist" && (
        <>
          {watchlist.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-dashed border-[var(--color-border)]">
              <Bookmark size={32} className="mx-auto mb-3 text-[var(--color-muted-foreground)]" />
              <p className="text-sm font-medium mb-1">Tu watchlist está vacía</p>
              <p className="text-xs text-[var(--color-muted-foreground)] mb-4">Guarda canales desde la búsqueda para seguirlos aquí</p>
              <button onClick={() => setTab("buscar")} className="text-xs font-medium px-4 py-2 rounded-xl text-white" style={{ backgroundColor: YT_RED }}>
                Buscar canales
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {watchlist.map(entry => (
                <div key={entry.channel_url} className="bg-white rounded-2xl border border-[var(--color-border)] p-4 flex items-center gap-3" style={{ boxShadow: "var(--shadow-card)" }}>
                  {entry.engagement_tag && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={entry.engagement_tag} alt={entry.channel_name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" style={{ background: "var(--color-muted)" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{entry.channel_name}</p>
                    <p className="text-xs text-[var(--color-muted-foreground)]">{entry.subscribers} suscriptores</p>
                  </div>
                  <a
                    href={`/explorar/canal/${entry.channel_url}`}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl transition-colors hover:opacity-80"
                    style={{ backgroundColor: YT_RED_LIGHT, color: YT_RED }}
                  >
                    Ver canal <ChevronRight size={12} />
                  </a>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── COMPARAR TAB ── */}
      {tab === "comparar" && (
        <>
          {compareChannels.length < 2 ? (
            <div className="text-center py-16 rounded-2xl border border-dashed border-[var(--color-border)]">
              <GitCompare size={32} className="mx-auto mb-3 text-[var(--color-muted-foreground)]" />
              <p className="text-sm font-medium mb-1">Selecciona 2 canales para comparar</p>
              <p className="text-xs text-[var(--color-muted-foreground)] mb-4">Busca canales y marca el ícono de comparar en 2 de ellos</p>
              <button onClick={() => setTab("buscar")} className="text-xs font-medium px-4 py-2 rounded-xl text-white" style={{ backgroundColor: YT_RED }}>
                Buscar canales
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button onClick={() => setCompareIds([])} className="text-xs text-[var(--color-muted-foreground)] flex items-center gap-1 hover:text-[var(--color-foreground)]">
                  <X size={12} /> Limpiar selección
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {compareChannels.map(ch => (
                  <div key={ch.id} className="bg-white rounded-2xl border p-4 space-y-3" style={{ borderColor: YT_RED, boxShadow: "0 4px 16px rgba(255,0,0,0.08)" }}>
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ch.thumbnail} alt={ch.name} className="w-12 h-12 rounded-full object-cover" style={{ background: "var(--color-muted)" }} onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{ch.name}</p>
                        {ch.customUrl && <p className="text-xs text-[var(--color-muted-foreground)] truncate">{ch.customUrl}</p>}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {[
                        { label: "Suscriptores", value: formatCount(ch.subscribers) },
                        { label: "Vistas totales", value: formatCount(ch.totalViews) },
                        { label: "Vídeos", value: formatCount(ch.videoCount) },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex justify-between items-center text-xs py-1.5 border-b border-[var(--color-border)] last:border-0">
                          <span className="text-[var(--color-muted-foreground)]">{label}</span>
                          <span className="font-semibold">{value}</span>
                        </div>
                      ))}
                    </div>
                    <a
                      href={`/explorar/canal/${ch.id}`}
                      className="block text-center text-xs font-medium py-2 rounded-xl transition-colors"
                      style={{ backgroundColor: YT_RED_LIGHT, color: YT_RED }}
                    >
                      Ver análisis completo →
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── IDEAS TAB ── */}
      {tab === "ideas" && <IdeasSearch profile={profile} />}
    </div>
  );
}
