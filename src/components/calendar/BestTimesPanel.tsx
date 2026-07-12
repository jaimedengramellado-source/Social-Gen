"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { X, Clock, Sparkles, Plus, Loader2, TrendingUp } from "lucide-react";

type Slot = {
  weekday: number;
  hour: number;
  quality: "top" | "buena";
  avgViews?: number;
  videos?: number;
};

type BestTimesData = {
  source: "youtube" | "heuristic";
  platform: string;
  slots: Slot[];
};

const WEEKDAY_NAMES = [
  "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado",
];

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  reels: "Instagram Reels",
  youtube_shorts: "YouTube Shorts",
  youtube_long: "YouTube",
};

function fmtViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(".", ",")} mil`;
  return String(n);
}

interface Props {
  onClose: () => void;
  onPickSlot: (weekday: number, hour: number) => void;
}

export function BestTimesPanel({ onClose, onPickSlot }: Props) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<BestTimesData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  useEffect(() => {
    fetch("/api/calendario/best-times")
      .then((r) => r.json())
      .then((json) => {
        if (json && Array.isArray(json.slots)) setData(json);
        else setError(true);
      })
      .catch(() => setError(true));
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      onMouseDown={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-[var(--color-border)] max-h-[90vh] overflow-y-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-serif)" }}>
            <Clock size={16} style={{ color: "var(--color-primary)" }} />
            Mejores horas para publicar
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[var(--color-muted)] transition-colors"
            aria-label="Cerrar"
          >
            <X size={15} />
          </button>
        </div>

        {!data && !error && (
          <div className="flex items-center gap-2 py-8 justify-center text-sm" style={{ color: "var(--color-muted-foreground)" }}>
            <Loader2 size={14} className="animate-spin" /> Analizando tus datos...
          </div>
        )}

        {error && (
          <p className="py-6 text-sm text-center" style={{ color: "var(--color-muted-foreground)" }}>
            No se han podido cargar las recomendaciones. Inténtalo de nuevo.
          </p>
        )}

        {data && (
          <>
            <p className="text-xs mb-4" style={{ color: "var(--color-muted-foreground)" }}>
              {data.source === "youtube" ? (
                <>Basado en el rendimiento real de los vídeos de tu canal de YouTube en el último año (hora de España).</>
              ) : (
                <>
                  Franjas recomendadas para {PLATFORM_LABELS[data.platform] ?? "tu plataforma"} con audiencia en España.
                  Conecta tu canal de YouTube en Estadísticas para personalizarlas con tus datos reales.
                </>
              )}
            </p>

            <div className="space-y-2">
              {data.slots.map((slot, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-xl border px-3.5 py-2.5"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">
                      {WEEKDAY_NAMES[slot.weekday]} · {String(slot.hour).padStart(2, "0")}:00 – {String((slot.hour + 2) % 24).padStart(2, "0")}:00
                    </p>
                    <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: "var(--color-muted-foreground)" }}>
                      {slot.quality === "top" ? (
                        <span className="flex items-center gap-1 font-medium" style={{ color: "var(--color-primary)" }}>
                          <Sparkles size={10} /> Franja destacada
                        </span>
                      ) : (
                        "Buena franja"
                      )}
                      {slot.avgViews !== undefined && (
                        <span className="flex items-center gap-1">
                          · <TrendingUp size={10} /> {fmtViews(slot.avgViews)} visitas de media
                          {slot.videos ? ` (${slot.videos} vídeos)` : ""}
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => onPickSlot(slot.weekday, slot.hour)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white flex-shrink-0 transition-opacity hover:opacity-80"
                    style={{ backgroundColor: "var(--color-primary)" }}
                  >
                    <Plus size={11} /> Planificar
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
