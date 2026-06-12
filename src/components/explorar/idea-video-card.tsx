"use client";

import Link from "next/link";
import { Eye, ThumbsUp, Clock } from "lucide-react";
import { formatCount } from "@/lib/youtube";
import type { YTVideo } from "@/lib/youtube";

const YT_RED = "#FF0000";
const YT_RED_LIGHT = "rgba(255,0,0,0.07)";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "hoy";
  if (days < 7) return `hace ${days}d`;
  if (days < 30) return `hace ${Math.floor(days / 7)}sem`;
  if (days < 365) return `hace ${Math.floor(days / 30)}m`;
  return `hace ${Math.floor(days / 365)}a`;
}

interface Props {
  video: YTVideo;
  rank: number;
  isTop: boolean;
}

export function IdeaVideoCard({ video, rank, isTop }: Props) {
  const isShort = video.durationSecs <= 180;

  return (
    <Link
      href={`/explorar/video/${video.id}`}
      className="block bg-white rounded-2xl border overflow-hidden hover:-translate-y-0.5 transition-all duration-150 group"
      style={{
        borderColor: isTop ? YT_RED : "var(--color-border)",
        boxShadow: isTop ? "0 4px 16px rgba(255,0,0,0.1)" : "var(--shadow-card)",
      }}
    >
      {/* Thumbnail */}
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

        {/* Rank / TOP badge */}
        {isTop ? (
          <span
            className="absolute top-2 left-2 text-[10px] font-black px-2 py-0.5 rounded-full text-white"
            style={{ backgroundColor: YT_RED }}
          >
            ⚡ TOP {rank}
          </span>
        ) : (
          <span
            className="absolute top-2 left-2 w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-black text-white"
            style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
          >
            {rank}
          </span>
        )}

        {/* Format badge */}
        <span
          className="absolute top-2 right-2 text-[10px] font-black px-2 py-0.5 rounded-full"
          style={isShort ? { backgroundColor: "#EFF6FF", color: "#2563EB" } : { backgroundColor: "#1a1a1acc", color: "#fff" }}
        >
          {isShort ? "SHORT" : "LARGO"}
        </span>

        {/* Duration */}
        <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-medium px-1.5 py-0.5 rounded">
          {video.duration}
        </span>
      </div>

      {/* Content */}
      <div className="p-3">
        <p className="text-sm font-medium line-clamp-2 leading-snug mb-1.5 group-hover:underline">
          {video.title}
        </p>
        {video.channelName && (
          <p className="text-xs text-[var(--color-muted-foreground)] truncate mb-2">{video.channelName}</p>
        )}
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-sm font-black" style={{ color: YT_RED }}>
            <Eye size={12} style={{ color: YT_RED }} />
            {formatCount(video.views)}
          </span>
          {video.likes > 0 && (
            <span className="flex items-center gap-1 text-xs text-[var(--color-muted-foreground)]">
              <ThumbsUp size={10} />
              {formatCount(video.likes)}
            </span>
          )}
          <span className="flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] ml-auto">
            <Clock size={10} />
            {timeAgo(video.publishedAt)}
          </span>
        </div>
        <div
          className="mt-2 text-center text-xs font-medium py-1.5 rounded-lg"
          style={{ backgroundColor: YT_RED_LIGHT, color: YT_RED }}
        >
          Ver métricas →
        </div>
      </div>
    </Link>
  );
}
