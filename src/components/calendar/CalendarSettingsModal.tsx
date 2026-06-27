"use client";

import { createPortal } from "react-dom";
import { useState, useEffect } from "react";
import { X, Settings2 } from "lucide-react";
import { useCalSettings } from "./CalendarContext";
import type { CalendarSettings } from "./CalendarContext";

const TZ_OPTIONS = [
  { value: "", label: "Automático (hora del dispositivo)" },
  { value: "GMT+0", label: "GMT+0 — Londres" },
  { value: "GMT+1", label: "GMT+1 — París / Madrid (invierno)" },
  { value: "GMT+2", label: "GMT+2 — Madrid (verano) / Roma" },
  { value: "GMT+3", label: "GMT+3 — Moscú / Nairobi" },
  { value: "GMT+4", label: "GMT+4 — Dubái" },
  { value: "GMT+5:30", label: "GMT+5:30 — Mumbai" },
  { value: "GMT+8", label: "GMT+8 — Pekín / Singapur" },
  { value: "GMT+9", label: "GMT+9 — Tokio / Seúl" },
  { value: "GMT-3", label: "GMT-3 — Buenos Aires / São Paulo" },
  { value: "GMT-5", label: "GMT-5 — Nueva York (invierno)" },
  { value: "GMT-6", label: "GMT-6 — Ciudad de México" },
  { value: "GMT-7", label: "GMT-7 — Denver" },
  { value: "GMT-8", label: "GMT-8 — Los Ángeles (invierno)" },
];

interface Props {
  onClose: () => void;
}

type Option<T extends string | number> = { v: T; l: string };

function SegmentedPicker<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map(({ v, l }) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => onChange(v)}
          className="flex-1 py-2 text-sm rounded-xl border transition-colors font-medium min-w-0"
          style={{
            borderColor:
              value === v ? "var(--color-primary)" : "var(--color-border)",
            backgroundColor:
              value === v ? "var(--color-primary-light)" : "transparent",
            color:
              value === v ? "var(--color-primary)" : "var(--color-foreground)",
          }}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function CalendarSettingsModal({ onClose }: Props) {
  const { settings, update } = useCalSettings();
  const [local, setLocal] = useState<CalendarSettings>({ ...settings });
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  function save() {
    update(local);
    onClose();
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      onMouseDown={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full border border-[var(--color-border)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <Settings2 size={15} className="text-[var(--color-primary)]" />
            <h2
              className="font-bold text-base"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Ajustes del calendario
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[var(--color-muted)] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Week start */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted-foreground)] mb-2">
              Inicio de semana
            </p>
            <SegmentedPicker<0 | 1>
              options={[
                { v: 1, l: "Lunes" },
                { v: 0, l: "Domingo" },
              ]}
              value={local.weekStartsOn}
              onChange={(v) => setLocal((p) => ({ ...p, weekStartsOn: v }))}
            />
          </div>

          {/* Time format */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted-foreground)] mb-2">
              Formato de hora
            </p>
            <SegmentedPicker<"24h" | "ampm">
              options={[
                { v: "24h", l: "24 horas  (13:00)" },
                { v: "ampm", l: "AM/PM  (1:00 PM)" },
              ]}
              value={local.timeFormat}
              onChange={(v) => setLocal((p) => ({ ...p, timeFormat: v }))}
            />
          </div>

          {/* Timezone label */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted-foreground)] mb-2">
              Zona horaria (etiqueta)
            </p>
            <select
              value={local.tzLabel}
              onChange={(e) =>
                setLocal((p) => ({ ...p, tzLabel: e.target.value }))
              }
              className="w-full text-sm border border-[var(--color-border)] rounded-xl px-3 py-2.5 outline-none focus:border-[var(--color-primary)] bg-white transition-colors"
            >
              {TZ_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-[var(--color-muted-foreground)] mt-1.5 leading-relaxed">
              Solo cambia la etiqueta en la columna lateral. Los eventos se
              muestran siempre en la hora local del dispositivo.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--color-border)]">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-muted)] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            className="text-sm px-4 py-2 rounded-xl text-white font-semibold hover:opacity-80 transition-opacity"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
