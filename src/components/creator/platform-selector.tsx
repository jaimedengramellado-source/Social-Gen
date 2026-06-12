"use client";

import type { Platform } from "@/types";

const PLATFORMS: { id: Platform; label: string; icon: string; desc: string }[] = [
  { id: "youtube_long", label: "YouTube", icon: "▶", desc: "8-20 minutos" },
  { id: "youtube_shorts", label: "YouTube Shorts", icon: "▶", desc: "< 60 segundos" },
  { id: "tiktok", label: "TikTok", icon: "♪", desc: "15-90 segundos" },
  { id: "reels", label: "Instagram Reels", icon: "⬡", desc: "< 90 segundos" },
];

interface PlatformSelectorProps {
  value: Platform | null;
  onChange: (p: Platform) => void;
}

export function PlatformSelector({ value, onChange }: PlatformSelectorProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {PLATFORMS.map((p) => (
        <button
          key={p.id}
          onClick={() => onChange(p.id)}
          className={`p-4 rounded-xl border text-left transition-all duration-150 hover:scale-[1.02] ${
            value === p.id
              ? "border-[var(--color-primary)] bg-[var(--color-primary-light)] shadow-sm"
              : "border-[var(--color-border)] bg-white hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary-light)]/30"
          }`}
        >
          <span className="text-2xl block mb-2">{p.icon}</span>
          <span className="font-semibold text-sm block mb-0.5">{p.label}</span>
          <span className="text-xs text-[var(--color-muted-foreground)]">{p.desc}</span>
        </button>
      ))}
    </div>
  );
}
