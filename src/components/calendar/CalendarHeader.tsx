"use client";

import { ChevronLeft, ChevronRight, Plus, Settings2 } from "lucide-react";

export type CalendarView = "week" | "month";

interface Props {
  title: string;
  view: CalendarView;
  onViewChange: (v: CalendarView) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onNewEvent: () => void;
  onSettingsOpen: () => void;
}

export function CalendarHeader({
  title,
  view,
  onViewChange,
  onPrev,
  onNext,
  onToday,
  onNewEvent,
  onSettingsOpen,
}: Props) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)] flex-shrink-0 bg-white gap-3">
      {/* Left: title + navigation */}
      <div className="flex items-center gap-3 min-w-0">
        <h1
          className="text-xl font-bold leading-none truncate"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {title}
        </h1>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={onPrev}
            className="p-1.5 rounded-lg hover:bg-[var(--color-muted)] transition-colors"
            aria-label="Período anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={onNext}
            className="p-1.5 rounded-lg hover:bg-[var(--color-muted)] transition-colors"
            aria-label="Período siguiente"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <button
          onClick={onToday}
          className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-muted)] transition-colors font-medium flex-shrink-0"
        >
          Hoy
        </button>
      </div>

      {/* Right: view toggle + settings + new event */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Segmented control */}
        <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden text-xs font-medium">
          <button
            onClick={() => onViewChange("week")}
            className="px-3 py-1.5 transition-colors"
            style={{
              backgroundColor:
                view === "week" ? "var(--color-primary)" : "transparent",
              color:
                view === "week" ? "white" : "var(--color-muted-foreground)",
            }}
          >
            Semana
          </button>
          <button
            onClick={() => onViewChange("month")}
            className="px-3 py-1.5 transition-colors"
            style={{
              backgroundColor:
                view === "month" ? "var(--color-primary)" : "transparent",
              color:
                view === "month" ? "white" : "var(--color-muted-foreground)",
              borderLeft: "1px solid var(--color-border)",
            }}
          >
            Mes
          </button>
        </div>

        <button
          onClick={onSettingsOpen}
          className="p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-muted)] transition-colors"
          aria-label="Ajustes del calendario"
        >
          <Settings2 size={15} className="text-[var(--color-muted-foreground)]" />
        </button>

        <button
          onClick={onNewEvent}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          <Plus size={14} /> Nuevo evento
        </button>
      </div>
    </div>
  );
}
