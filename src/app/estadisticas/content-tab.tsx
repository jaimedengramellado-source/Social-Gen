"use client";

import { useMemo, useState } from "react";
import { AnalyticsData, VideoMetric, YT_RED, fmtNum, fmtPct, fmtDate, fmtDuration } from "./shared";

type SortKey = "date" | "views" | "retention" | "ctr" | "comments" | "likes" | "watchTime";
type FilterKey = "all" | "videos" | "shorts";

const SORTERS: Record<SortKey, (a: VideoMetric, b: VideoMetric) => number> = {
  date: (a, b) => new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime(),
  views: (a, b) => b.views - a.views,
  retention: (a, b) => b.avgViewPercentage - a.avgViewPercentage,
  ctr: (a, b) => b.ctr - a.ctr,
  comments: (a, b) => b.comments - a.comments,
  likes: (a, b) => b.likes - a.likes,
  watchTime: (a, b) => b.watchTimeMinutes - a.watchTimeMinutes,
};

const SORT_LABELS: Record<SortKey, string> = {
  date: "Más recientes", views: "Más populares", retention: "Mayor retención", ctr: "Mayor CTR",
  comments: "Más comentados", likes: "Más likes", watchTime: "Más tiempo visto",
};

export function ContentTab({ data, onSelectVideo }: { data: AnalyticsData; onSelectVideo: (id: string) => void }) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [filter, setFilter] = useState<FilterKey>("all");

  const videos = useMemo(() => {
    let list = data.videos;
    if (filter === "videos") list = list.filter(v => !v.isShort);
    if (filter === "shorts") list = list.filter(v => v.isShort);
    return [...list].sort(SORTERS[sortKey]);
  }, [data.videos, sortKey, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-[var(--color-muted)] rounded-lg p-1">
          {([["all", "Todos"], ["videos", "Vídeos"], ["shorts", "Shorts"]] as [FilterKey, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)}
              className="px-3 py-1 rounded-md text-xs font-medium transition-colors"
              style={{ backgroundColor: filter === key ? "white" : "transparent", color: filter === key ? "var(--color-foreground)" : "var(--color-muted-foreground)" }}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-muted-foreground)]">Ordenar por</span>
          <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}
            className="text-xs font-medium rounded-lg border border-[var(--color-border)] px-2 py-1.5 bg-white">
            {(Object.keys(SORT_LABELS) as SortKey[]).map(k => <option key={k} value={k}>{SORT_LABELS[k]}</option>)}
          </select>
        </div>
      </div>

      {videos.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)] text-center py-12">Aún no hay vídeos que mostrar.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {videos.map(video => (
            <button key={video.id} onClick={() => onSelectVideo(video.id)}
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
              </div>
              <div className="p-3">
                <p className="text-xs font-semibold leading-snug line-clamp-2 mb-2">{video.title}</p>
                <p className="text-[10px] text-[var(--color-muted-foreground)] mb-2">{fmtDate(video.publishedAt)}</p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-[var(--color-muted-foreground)]">
                  <span className="font-semibold text-[var(--color-foreground)]">{fmtNum(video.views)}</span> vistas
                  {video.avgViewPercentage > 0 && <><span>·</span><span>{video.avgViewPercentage.toFixed(0)}% ret.</span></>}
                  {video.impressions > 0 && <><span>·</span><span>{fmtPct(video.ctr * 100)} CTR</span></>}
                  {video.likes > 0 && <><span>·</span><span>{fmtNum(video.likes)} likes</span></>}
                  {video.comments > 0 && <><span>·</span><span>{fmtNum(video.comments)} coment.</span></>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
