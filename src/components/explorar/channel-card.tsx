"use client";

import Link from "next/link";
import { Users, Eye, PlaySquare, Bookmark, BookmarkCheck, GitCompare } from "lucide-react";
import { formatCount } from "@/lib/youtube";
import type { YTChannel } from "@/lib/youtube";

const YT_RED = "#FF0000";

interface Props {
  channel: YTChannel;
  inWatchlist: boolean;
  onToggleWatchlist: () => void;
  inCompare?: boolean;
  onToggleCompare?: () => void;
  compareDisabled?: boolean;
}

export function ChannelCard({ channel, inWatchlist, onToggleWatchlist, inCompare, onToggleCompare, compareDisabled }: Props) {
  return (
    <div
      className="bg-white rounded-2xl border overflow-hidden hover:-translate-y-0.5 transition-all duration-150"
      style={{
        borderColor: inCompare ? YT_RED : "var(--color-border)",
        boxShadow: inCompare ? "0 4px 16px rgba(255,0,0,0.1)" : "var(--shadow-card)",
      }}
    >
      <Link href={`/explorar/canal/${channel.id}`} className="flex items-start gap-3 p-4 pb-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={channel.thumbnail}
          alt={channel.name}
          className="w-12 h-12 rounded-full object-cover flex-shrink-0"
          style={{ background: "var(--color-muted)" }}
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-[var(--color-foreground)] truncate">{channel.name}</p>
          {channel.customUrl && (
            <p className="text-xs text-[var(--color-muted-foreground)]">{channel.customUrl}</p>
          )}
          <p className="text-xs text-[var(--color-muted-foreground)] line-clamp-2 mt-0.5 leading-relaxed">
            {channel.description || "Sin descripción"}
          </p>
        </div>
      </Link>

      <div className="grid grid-cols-3 gap-2 p-4 pt-3">
        {[
          { icon: Users, label: "Subs", value: formatCount(channel.subscribers) },
          { icon: Eye, label: "Vistas", value: formatCount(channel.totalViews) },
          { icon: PlaySquare, label: "Vídeos", value: formatCount(channel.videoCount) },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex flex-col items-center rounded-xl py-2" style={{ backgroundColor: "var(--color-muted)" }}>
            <Icon size={13} className="text-[var(--color-muted-foreground)] mb-0.5" />
            <span className="text-xs font-semibold text-[var(--color-foreground)]">{value}</span>
            <span className="text-[10px] text-[var(--color-muted-foreground)]">{label}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-2 px-4 pb-4">
        <Link
          href={`/explorar/canal/${channel.id}`}
          className="flex-1 text-center text-xs font-medium py-2 rounded-xl transition-colors hover:opacity-80"
          style={{ backgroundColor: "var(--color-foreground)", color: "#fff" }}
        >
          Ver canal →
        </Link>
        {onToggleCompare && (
          <button
            onClick={onToggleCompare}
            disabled={compareDisabled}
            className="w-9 h-9 flex items-center justify-center rounded-xl border transition-colors"
            style={{
              backgroundColor: inCompare ? YT_RED : "transparent",
              borderColor: inCompare ? YT_RED : "var(--color-border)",
            }}
            title={inCompare ? "Quitar de comparativa" : compareDisabled ? "Máximo 2 canales" : "Añadir a comparativa"}
          >
            <GitCompare size={14} style={{ color: inCompare ? "#fff" : "var(--color-muted-foreground)" }} />
          </button>
        )}
        <button
          onClick={onToggleWatchlist}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-[var(--color-border)] transition-colors"
          style={{ ["--hover-border" as string]: YT_RED }}
          title={inWatchlist ? "En tu watchlist" : "Añadir a watchlist"}
          onMouseEnter={e => (e.currentTarget.style.borderColor = YT_RED)}
          onMouseLeave={e => (e.currentTarget.style.borderColor = "")}
        >
          {inWatchlist
            ? <BookmarkCheck size={15} style={{ color: YT_RED }} />
            : <Bookmark size={15} className="text-[var(--color-muted-foreground)]" />
          }
        </button>
      </div>
    </div>
  );
}
