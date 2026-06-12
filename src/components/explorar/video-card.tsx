"use client";

import Link from "next/link";
import { Eye, Clock, Zap } from "lucide-react";
import { formatCount } from "@/lib/youtube";
import type { YTVideo } from "@/lib/youtube";

const YT_RED = "#FF0000";
const YT_RED_LIGHT = "rgba(255,0,0,0.07)";

interface Props {
  video: YTVideo;
  isOutlier: boolean;
  isMostViral: boolean;
  channelName: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "hoy";
  if (days < 7) return `hace ${days}d`;
  if (days < 30) return `hace ${Math.floor(days / 7)}sem`;
  if (days < 365) return `hace ${Math.floor(days / 30)}m`;
  return `hace ${Math.floor(days / 365)}a`;
}

export function VideoCard({ video, isOutlier, isMostViral, channelName }: Props) {
  const createHref = `/crear?tema=${encodeURIComponent(video.title)}&canal=${encodeURIComponent(channelName)}`;

  return (
    <div
      className="bg-white rounded-2xl border overflow-hidden transition-all duration-150 hover:-translate-y-0.5"
      style={{
        borderColor: isMostViral ? YT_RED : "var(--color-border)",
        boxShadow: isMostViral ? "0 4px 20px rgba(255,0,0,0.12)" : "var(--shadow-card)",
      }}
    >
      <div className="relative aspect-video bg-[var(--color-muted)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={video.thumbnail}
          alt={video.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            const el = e.currentTarget;
            const id = video.id;
            if (el.src.includes("maxresdefault")) {
              el.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
            } else if (el.src.includes("hqdefault")) {
              el.src = `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
            } else { el.onerror = null; el.style.display = "none"; }
          }}
        />
        <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
          {video.duration}
        </span>
        {isMostViral && (
          <span className="absolute top-2 left-2 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ backgroundColor: YT_RED }}>
            🔥 Más viral
          </span>
        )}
        {isOutlier && !isMostViral && (
          <span className="absolute top-2 left-2 bg-amber-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Zap size={10} /> Outlier
          </span>
        )}
      </div>

      <div className="p-3">
        <p className="text-xs font-medium text-[var(--color-foreground)] line-clamp-2 leading-snug mb-2">
          {video.title}
        </p>
        <div className="flex items-center gap-3 text-[10px] text-[var(--color-muted-foreground)]">
          <span className="flex items-center gap-1"><Eye size={11} />{formatCount(video.views)}</span>
          <span className="flex items-center gap-1"><Clock size={11} />{timeAgo(video.publishedAt)}</span>
        </div>
        {(isOutlier || isMostViral) && (
          <Link
            href={createHref}
            className="mt-2 block text-center text-[10px] font-medium py-1.5 rounded-lg transition-colors"
            style={{ backgroundColor: YT_RED_LIGHT, color: YT_RED }}
          >
            Crear guion basado en este vídeo →
          </Link>
        )}
      </div>
    </div>
  );
}
