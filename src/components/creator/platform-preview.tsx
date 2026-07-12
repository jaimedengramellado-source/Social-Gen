"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import {
  X, Heart, MessageCircle, Bookmark, Share2, Music2, Send,
  MoreHorizontal, ThumbsUp, ThumbsDown, Play, Plus,
} from "lucide-react";

type PreviewPlatform = "tiktok" | "reels" | "shorts";

const PLATFORMS: { id: PreviewPlatform; label: string }[] = [
  { id: "tiktok", label: "TikTok" },
  { id: "reels", label: "Reels" },
  { id: "shorts", label: "Shorts" },
];

const CAPTION_LIMITS: Record<PreviewPlatform, number> = {
  tiktok: 2200,
  reels: 2200,
  shorts: 100, // título de Shorts
};

// El texto llega en markdown desde el chat: para el caption se muestra plano
function stripMd(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface Props {
  content: string;
  channelName?: string | null;
  onClose: () => void;
}

export function PlatformPreviewModal({ content, channelName, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [platform, setPlatform] = useState<PreviewPlatform>("tiktok");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  const plain = useMemo(() => stripMd(content), [content]);
  const firstLine = plain.split("\n").find((l) => l.trim())?.trim() ?? "";
  const user = (channelName?.trim() || "tucanal").replace(/^@/, "");

  const limit = CAPTION_LIMITS[platform];
  const measured = platform === "shorts" ? firstLine : plain;
  const overLimit = measured.length > limit;

  if (!mounted) return null;

  const clampStyle: React.CSSProperties = expanded
    ? { maxHeight: 180, overflowY: "auto" }
    : {
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      };

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
      onMouseDown={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 border border-[var(--color-border)] max-h-[94vh] overflow-y-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-serif)" }}>
            Vista previa
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[var(--color-muted)] transition-colors"
            aria-label="Cerrar"
          >
            <X size={15} />
          </button>
        </div>

        {/* Selector de plataforma */}
        <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden text-xs font-medium mb-4">
          {PLATFORMS.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setPlatform(p.id)}
              className="flex-1 px-3 py-1.5 transition-colors"
              style={{
                backgroundColor: platform === p.id ? "var(--color-primary)" : "transparent",
                color: platform === p.id ? "white" : "var(--color-muted-foreground)",
                borderLeft: i > 0 ? "1px solid var(--color-border)" : undefined,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Marco de móvil — las plataformas son oscuras en ambos temas */}
        <div
          className="relative mx-auto rounded-[28px] overflow-hidden select-none"
          style={{
            width: 270,
            aspectRatio: "9 / 16",
            background: "linear-gradient(160deg, #3a3a45 0%, #17171d 55%, #101014 100%)",
            border: "6px solid #0D0D0D",
            boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
          }}
        >
          {/* Indicador de vídeo */}
          <div className="absolute inset-0 flex items-center justify-center opacity-25">
            <Play size={44} fill="white" className="text-white" />
          </div>

          {platform === "tiktok" && (
            <>
              <p className="absolute top-3 inset-x-0 text-center text-[11px] font-semibold text-white/80">
                Siguiendo <span className="text-white border-b-2 border-white pb-0.5 ml-2">Para ti</span>
              </p>
              <div className="absolute right-2.5 bottom-20 flex flex-col items-center gap-4 text-white">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-white/25 border border-white/50 flex items-center justify-center text-sm font-bold uppercase">
                    {user[0]}
                  </div>
                  <span
                    className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "#FE2C55" }}
                  >
                    <Plus size={10} className="text-white" />
                  </span>
                </div>
                <div className="flex flex-col items-center gap-0.5"><Heart size={26} fill="white" /><span className="text-[10px] font-semibold">84,2K</span></div>
                <div className="flex flex-col items-center gap-0.5"><MessageCircle size={26} fill="white" /><span className="text-[10px] font-semibold">1.203</span></div>
                <div className="flex flex-col items-center gap-0.5"><Bookmark size={26} fill="white" /><span className="text-[10px] font-semibold">5.418</span></div>
                <div className="flex flex-col items-center gap-0.5"><Share2 size={26} fill="white" /><span className="text-[10px] font-semibold">932</span></div>
              </div>
              <div className="absolute left-3 right-14 bottom-4 text-white">
                <p className="text-[13px] font-bold mb-1">@{user}</p>
                <div className="text-[12px] leading-snug" style={clampStyle}>
                  <p className="whitespace-pre-line">{plain}</p>
                </div>
                {plain.length > 90 && (
                  <button
                    onClick={() => setExpanded((v) => !v)}
                    className="text-[11px] font-semibold text-white/70 mt-0.5"
                  >
                    {expanded ? "menos" : "más"}
                  </button>
                )}
                <p className="flex items-center gap-1.5 text-[11px] mt-1.5 text-white/90">
                  <Music2 size={11} /> sonido original – {user}
                </p>
              </div>
            </>
          )}

          {platform === "reels" && (
            <>
              <p className="absolute top-3 left-3 text-[15px] font-bold text-white">Reels</p>
              <div className="absolute right-2.5 bottom-16 flex flex-col items-center gap-4 text-white">
                <div className="flex flex-col items-center gap-0.5"><Heart size={24} /><span className="text-[10px] font-semibold">45,1K</span></div>
                <div className="flex flex-col items-center gap-0.5"><MessageCircle size={24} /><span className="text-[10px] font-semibold">876</span></div>
                <div className="flex flex-col items-center gap-0.5"><Send size={24} /><span className="text-[10px] font-semibold">2.310</span></div>
                <MoreHorizontal size={20} />
              </div>
              <div className="absolute left-3 right-14 bottom-4 text-white">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-7 h-7 rounded-full bg-white/25 border border-white/50 flex items-center justify-center text-[11px] font-bold uppercase">
                    {user[0]}
                  </div>
                  <p className="text-[12px] font-semibold">{user}</p>
                  <span className="text-[10px] font-medium border border-white/60 rounded-md px-1.5 py-0.5">
                    Seguir
                  </span>
                </div>
                <div className="text-[12px] leading-snug" style={clampStyle}>
                  <p className="whitespace-pre-line">{plain}</p>
                </div>
                {plain.length > 90 && (
                  <button
                    onClick={() => setExpanded((v) => !v)}
                    className="text-[11px] font-semibold text-white/70 mt-0.5"
                  >
                    {expanded ? "menos" : "... más"}
                  </button>
                )}
                <p className="flex items-center gap-1.5 text-[11px] mt-1.5 text-white/90">
                  <Music2 size={11} /> {user} · Audio original
                </p>
              </div>
            </>
          )}

          {platform === "shorts" && (
            <>
              <div className="absolute right-2.5 bottom-16 flex flex-col items-center gap-4 text-white">
                <div className="flex flex-col items-center gap-0.5"><ThumbsUp size={24} /><span className="text-[10px] font-semibold">32K</span></div>
                <div className="flex flex-col items-center gap-0.5"><ThumbsDown size={24} /><span className="text-[10px] font-semibold">No me gusta</span></div>
                <div className="flex flex-col items-center gap-0.5"><MessageCircle size={24} /><span className="text-[10px] font-semibold">412</span></div>
                <div className="flex flex-col items-center gap-0.5"><Share2 size={24} /><span className="text-[10px] font-semibold">Compartir</span></div>
              </div>
              <div className="absolute left-3 right-14 bottom-4 text-white">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-7 h-7 rounded-full bg-white/25 border border-white/50 flex items-center justify-center text-[11px] font-bold uppercase">
                    {user[0]}
                  </div>
                  <p className="text-[12px] font-semibold">@{user}</p>
                  <span
                    className="text-[10px] font-semibold rounded-full px-2 py-0.5"
                    style={{ backgroundColor: "white", color: "#0D0D0D" }}
                  >
                    Suscribirme
                  </span>
                </div>
                <p className="text-[12px] leading-snug line-clamp-2">{firstLine}</p>
                <p className="flex items-center gap-1.5 text-[11px] mt-1.5 text-white/90">
                  <Music2 size={11} /> Sonido original
                </p>
              </div>
            </>
          )}
        </div>

        {/* Contador de caracteres */}
        <div className="flex items-center justify-between mt-3 px-1">
          <p className="text-[11px]" style={{ color: "var(--color-muted-foreground)" }}>
            {platform === "shorts" ? "Título (primera línea)" : "Caption"}
          </p>
          <p
            className="text-[11px] font-medium tabular-nums"
            style={{ color: overLimit ? "var(--color-destructive)" : "var(--color-muted-foreground)" }}
          >
            {measured.length.toLocaleString("es-ES")} / {limit.toLocaleString("es-ES")}
            {overLimit && " — demasiado largo"}
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
