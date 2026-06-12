"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { formatCount } from "@/lib/youtube";
import type { YTVideo } from "@/lib/youtube";

const YT_RED = "#FF0000";
const YT_RED_LIGHT = "rgba(255,0,0,0.07)";

export function TrendingVideoCard({ video, rank }: { video: YTVideo; rank: number }) {
  const isShort = video.durationSecs <= 180;

  return (
    <Link
      href={`/explorar/video/${video.id}`}
      className="block bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden hover:-translate-y-0.5 transition-all duration-150 group"
      style={{ boxShadow: "var(--shadow-card)" }}
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

        {/* Rank badge */}
        <span
          className="absolute top-2 left-2 w-7 h-7 flex items-center justify-center rounded-full text-xs font-black text-white"
          style={{ backgroundColor: YT_RED }}
        >
          {rank}
        </span>

        {/* Content type badge */}
        <span
          className="absolute top-2 right-2 text-[10px] font-black px-2 py-0.5 rounded-full"
          style={isShort
            ? { backgroundColor: "#EFF6FF", color: "#2563EB" }
            : { backgroundColor: "#1a1a1acc", color: "#fff" }
          }
        >
          {isShort ? "SHORT" : "LARGO"}
        </span>

        {/* Duration */}
        <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-medium px-1.5 py-0.5 rounded">
          {video.duration}
        </span>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        <p className="text-sm font-medium text-[var(--color-foreground)] line-clamp-2 leading-snug mb-2 group-hover:underline">
          {video.title}
        </p>

        {/* Channel — prominent */}
        {video.channelName && (
          <p className="text-sm font-semibold text-[var(--color-foreground)] truncate mb-2.5">
            {video.channelName}
          </p>
        )}

        {/* Views — hero number */}
        <div className="flex items-center gap-1.5">
          <Eye size={14} style={{ color: YT_RED }} />
          <span className="text-xl font-black" style={{ color: YT_RED }}>
            {formatCount(video.views)}
          </span>
          <span className="text-xs text-[var(--color-muted-foreground)]">vistas</span>
        </div>

        {/* Create script CTA */}
        <div
          className="mt-3 text-center text-xs font-medium py-2 rounded-lg"
          style={{ backgroundColor: YT_RED_LIGHT, color: YT_RED }}
        >
          Ver métricas →
        </div>
      </div>
    </Link>
  );
}
