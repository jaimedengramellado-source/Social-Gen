"use client";

import React, { useRef, useEffect, useLayoutEffect, useState, useMemo } from "react";
import { UnfoldVertical, FoldVertical } from "lucide-react";
import {
  minutesOfDay,
  isSameDay,
  getTzLabel,
  computeEventLayout,
  formatHourLabel,
} from "./types";
import type { CalendarEvent } from "./types";
import { useCalSettings } from "./CalendarContext";
import { EventBlock } from "./EventBlock";
import { EventPopover } from "./EventPopover";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

// Altura de hora (px): continua, controlada por el tirador del raíl izquierdo.
// El mínimo real se calcula para que las 24h quepan en el viewport.
const DEFAULT_HOUR_HEIGHT = 60;
const MAX_HOUR_HEIGHT = 132;
const FALLBACK_MIN_HOUR_HEIGHT = 18;
const ZOOM_STORAGE_KEY = "cal-hour-height";
const RAIL_WIDTH = 36;
const THUMB_HEIGHT = 44;

type DragState = {
  event: CalendarEvent;
  durationMins: number;
  offsetMins: number;
};

type DropTarget = {
  dayIdx: number;
  startMins: number;
};

interface Props {
  days: Date[];
  events: CalendarEvent[];
  today: Date;
  onCellClick: (day: Date, hour: number, minute: number) => void;
  onEventEdit: (event: CalendarEvent) => void;
  onEventDelete: (id: string) => void;
  onEventMove: (id: string, newStart: Date, newEnd: Date) => void;
}

function dayAbbr(day: Date): string {
  return ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"][day.getDay()];
}

// Tirador continuo: arrastrar hacia arriba estira las horas (más detalle),
// hacia abajo las contrae hasta que el día completo cabe en pantalla.
function ZoomSlider({
  value,
  min,
  max,
  onChange,
  onDragStart,
  onDragEnd,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (h: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const t = max === min ? 1 : (value - min) / (max - min);

  function valueFromPointer(clientY: number): number {
    const track = trackRef.current;
    if (!track) return value;
    const r = track.getBoundingClientRect();
    const usable = r.height - THUMB_HEIGHT;
    if (usable <= 0) return value;
    const y = Math.max(0, Math.min(usable, clientY - r.top - THUMB_HEIGHT / 2));
    return min + (1 - y / usable) * (max - min);
  }

  return (
    <div
      className="flex-shrink-0 flex flex-col items-center border-r border-[var(--color-border)] select-none py-2 gap-1.5"
      style={{ width: RAIL_WIDTH, backgroundColor: "var(--color-muted)" }}
    >
      <UnfoldVertical
        size={12}
        className="flex-shrink-0 text-[var(--color-muted-foreground)] opacity-60 pointer-events-none"
      />

      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Altura de las horas del calendario"
        aria-orientation="vertical"
        aria-valuemin={Math.round(min)}
        aria-valuemax={max}
        aria-valuenow={Math.round(value)}
        className="relative flex-1 rounded-full cursor-ns-resize outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        style={{ width: 8, backgroundColor: "var(--color-border)", touchAction: "none" }}
        onPointerDown={(e) => {
          e.preventDefault();
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // Eventos sintéticos (tests) no tienen pointer activo que capturar
          }
          onDragStart();
          onChange(valueFromPointer(e.clientY));
        }}
        onPointerMove={(e) => {
          if (e.buttons & 1) onChange(valueFromPointer(e.clientY));
        }}
        onPointerUp={() => onDragEnd()}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowRight") {
            e.preventDefault();
            onDragStart();
            onChange(Math.min(max, value + 6));
            onDragEnd();
          } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
            e.preventDefault();
            onDragStart();
            onChange(Math.max(min, value - 6));
            onDragEnd();
          }
        }}
      >
        {/* Relleno bajo el tirador: cuánto zoom hay aplicado */}
        <div
          className="absolute left-0 right-0 bottom-0 rounded-full pointer-events-none"
          style={{
            top: `calc(${(1 - t) * 100}% - ${(1 - t) * THUMB_HEIGHT}px)`,
            backgroundColor: "var(--color-primary-light)",
          }}
        />
        {/* Tirador */}
        <div
          className="absolute rounded-full pointer-events-none flex flex-col items-center justify-center gap-[3px] shadow-sm"
          style={{
            width: 16,
            height: THUMB_HEIGHT,
            left: -4,
            top: `calc(${(1 - t) * 100}% - ${(1 - t) * THUMB_HEIGHT}px)`,
            backgroundColor: "var(--color-primary)",
          }}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block rounded-full"
              style={{ width: 7, height: 1.5, backgroundColor: "rgba(255,255,255,0.65)" }}
            />
          ))}
        </div>
      </div>

      <FoldVertical
        size={12}
        className="flex-shrink-0 text-[var(--color-muted-foreground)] opacity-60 pointer-events-none"
      />
    </div>
  );
}

export function CalendarGrid({
  days,
  events,
  today,
  onCellClick,
  onEventEdit,
  onEventDelete,
  onEventMove,
}: Props) {
  const { settings } = useCalSettings();
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const [hourHeight, setHourHeight] = useState(DEFAULT_HOUR_HEIGHT);
  const [minHourHeight, setMinHourHeight] = useState(FALLBACK_MIN_HOUR_HEIGHT);
  // Hora anclada al centro del viewport mientras se arrastra el tirador,
  // para que el zoom se sienta como estirar el grid y no como saltar por él.
  const zoomAnchorMinsRef = useRef<number | null>(null);

  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [popover, setPopover] = useState<{ event: CalendarEvent; rect: DOMRect } | null>(null);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    const min = el ? el.clientHeight / 24 : FALLBACK_MIN_HOUR_HEIGHT;
    setMinHourHeight(min);

    const raw = localStorage.getItem(ZOOM_STORAGE_KEY);
    const saved = raw === null ? NaN : Number(raw);
    const initial = Number.isFinite(saved)
      ? Math.max(min, Math.min(MAX_HOUR_HEIGHT, saved))
      : Math.max(min, DEFAULT_HOUR_HEIGHT);
    setHourHeight(initial);

    // Vista inicial a las 8:00: las horas de madrugada no interesan por defecto.
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = 8 * initial;
    });

    // Si el viewport cambia (resize, dock del navegador), el mínimo cambia con él.
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const nextMin = el.clientHeight / 24;
      setMinHourHeight(nextMin);
      setHourHeight((h) => Math.max(nextMin, h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Reposiciona el scroll tras cada cambio de altura para mantener fija la hora
  // anclada; en layout effect para que no haya ni un frame de salto visible.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const anchor = zoomAnchorMinsRef.current;
    if (el && anchor !== null) {
      el.scrollTop = (anchor / 60) * hourHeight - el.clientHeight / 2;
    }
  }, [hourHeight]);

  function handleZoomStart() {
    const el = scrollRef.current;
    if (el) {
      zoomAnchorMinsRef.current = ((el.scrollTop + el.clientHeight / 2) / hourHeight) * 60;
    }
  }

  function handleZoomChange(next: number) {
    setHourHeight(Math.max(minHourHeight, Math.min(MAX_HOUR_HEIGHT, next)));
  }

  // El pointerup que cierra el drag puede ir un render por detrás del estado;
  // el ref siempre tiene el último valor aplicado.
  const hourHeightRef = useRef(hourHeight);
  hourHeightRef.current = hourHeight;

  function handleZoomEnd() {
    zoomAnchorMinsRef.current = null;
    localStorage.setItem(ZOOM_STORAGE_KEY, String(Math.round(hourHeightRef.current)));
  }

  const tzLabel = useMemo(
    () => settings.tzLabel || getTzLabel(),
    [settings.tzLabel]
  );
  const todayColIdx = days.findIndex((d) => isSameDay(d, today));
  const isCurrentWeek = todayColIdx >= 0;
  const currentTimeTop = (minutesOfDay(currentTime) / 60) * hourHeight;

  // Weekend column indices (based on actual day-of-week, respects weekStartsOn)
  const weekendIndices = useMemo(
    () => days.reduce<number[]>((acc, d, i) => {
      const dow = d.getDay();
      if (dow === 0 || dow === 6) acc.push(i);
      return acc;
    }, []),
    [days]
  );

  const eventsByDay = useMemo(
    () =>
      days.map((day) => {
        const dayEvs = events.filter((ev) =>
          isSameDay(new Date(ev.start_time), day)
        );
        return computeEventLayout(dayEvs);
      }),
    [days, events]
  );

  // ── DnD helpers ──────────────────────────────────────────────────────────

  function handleDragStart(eventId: string, offsetMins: number) {
    const ev = events.find((e) => e.id === eventId);
    if (!ev) return;
    const startMs = new Date(ev.start_time).getTime();
    const endMs = ev.end_time
      ? new Date(ev.end_time).getTime()
      : startMs + 3_600_000;
    const durationMins = Math.round((endMs - startMs) / 60_000);
    setDragging({ event: ev, durationMins, offsetMins });
    setPopover(null);
  }

  function computeDropTarget(e: React.DragEvent<HTMLDivElement>): DropTarget | null {
    if (!dragging || !gridRef.current || !scrollRef.current) return null;
    const rect = gridRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;

    const dayIdx = Math.max(0, Math.min(6, Math.floor(relX / (rect.width / 7))));
    const rawStartMins = (relY / hourHeight) * 60 - dragging.offsetMins;
    const snapped = Math.round(rawStartMins / 15) * 15;
    const startMins = Math.max(0, Math.min(1440 - dragging.durationMins, snapped));

    return { dayIdx, startMins };
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!dragging) return;
    const target = computeDropTarget(e);
    if (target) setDropTarget(target);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!dragging || !dropTarget) {
      setDragging(null);
      setDropTarget(null);
      return;
    }
    const day = days[dropTarget.dayIdx];
    const newStart = new Date(day);
    newStart.setHours(0, 0, 0, 0);
    newStart.setMinutes(dropTarget.startMins);
    const newEnd = new Date(newStart.getTime() + dragging.durationMins * 60_000);
    onEventMove(dragging.event.id, newStart, newEnd);
    setDragging(null);
    setDropTarget(null);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    // Only clear if leaving the grid entirely (not just entering a child)
    if (!gridRef.current?.contains(e.relatedTarget as Node)) {
      setDropTarget(null);
    }
  }

  // ── Click handler ─────────────────────────────────────────────────────────

  function handleGridClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target.closest("[data-event-block]")) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;

    const dayIdx = Math.max(0, Math.min(6, Math.floor(relX / (rect.width / 7))));
    const rawMins = (relY / hourHeight) * 60;
    const snappedMins = Math.round(rawMins / 30) * 30;
    const hour = Math.min(23, Math.floor(snappedMins / 60));
    const minute = snappedMins % 60 >= 30 ? 30 : 0;

    setPopover(null);
    onCellClick(days[dayIdx], hour, minute);
  }

  function handleEventBlockClick(e: React.MouseEvent, eventId: string) {
    const ev = events.find((x) => x.id === eventId);
    if (!ev) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopover({ event: ev, rect });
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* ── Sticky day header ── */}
      <div
        className="flex flex-shrink-0 bg-white border-b border-[var(--color-border)]"
        style={{ zIndex: 20 }}
      >
        {/* Espaciador alineado con el raíl de zoom */}
        <div
          className="flex-shrink-0 border-r border-[var(--color-border)]"
          style={{ width: RAIL_WIDTH, backgroundColor: "var(--color-muted)" }}
        />
        <div
          className="flex-shrink-0 border-r border-[var(--color-border)] flex items-end justify-center pb-2"
          style={{ width: 56 }}
        >
          <span className="text-[9px] text-[var(--color-muted-foreground)] leading-none">
            {tzLabel}
          </span>
        </div>

        {days.map((day, i) => {
          const isToday = isSameDay(day, today);
          return (
            <div key={i} className="flex-1 flex flex-col items-center py-2 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-muted-foreground)] mb-1">
                {dayAbbr(day)}
              </span>
              {isToday ? (
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white leading-none"
                  style={{ backgroundColor: "#1a73e8" }}
                >
                  {day.getDate()}
                </span>
              ) : (
                <span className="w-8 h-8 flex items-center justify-center text-sm font-semibold leading-none">
                  {day.getDate()}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Body: zoom rail + scrollable grid ── */}
      <div className="flex flex-1 min-h-0">
        <ZoomSlider
          value={hourHeight}
          min={minHourHeight}
          max={MAX_HOUR_HEIGHT}
          onChange={handleZoomChange}
          onDragStart={handleZoomStart}
          onDragEnd={handleZoomEnd}
        />

        <div ref={scrollRef} className="cal-scroll flex-1 overflow-y-auto overflow-x-hidden">
          <div className="flex" style={{ height: 24 * hourHeight }}>

            {/* Time gutter */}
            <div
              className="flex-shrink-0 relative border-r border-[var(--color-border)]"
              style={{ width: 56 }}
            >
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="absolute right-0 pr-2 text-[10px] text-[var(--color-muted-foreground)] leading-none text-right select-none"
                  style={{
                    top: h * hourHeight - 6,
                    width: "100%",
                    // Contraído las etiquetas no caben cada hora: se muestran cada 2h
                    opacity: h === 0 || (hourHeight < 28 && h % 2 !== 0) ? 0 : 1,
                  }}
                >
                  {formatHourLabel(h, settings.timeFormat)}
                </div>
              ))}
            </div>

            {/* Grid area */}
            <div
              ref={gridRef}
              className="flex-1 relative cursor-pointer"
              style={{ height: 24 * hourHeight }}
              onClick={handleGridClick}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragLeave={handleDragLeave}
            >
              {/* Hour lines */}
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="absolute left-0 right-0 pointer-events-none"
                  style={{
                    top: h * hourHeight,
                    borderTop: h === 0 ? "none" : "1px solid var(--cal-line-main)",
                  }}
                />
              ))}

              {/* Half-hour dashes (ruido visual con las horas contraídas) */}
              {hourHeight >= 48 &&
                HOURS.map((h) => (
                  <div
                    key={`hh${h}`}
                    className="absolute left-0 right-0 pointer-events-none"
                    style={{
                      top: h * hourHeight + hourHeight / 2,
                      borderTop: "1px dashed var(--cal-line-dashed)",
                    }}
                  />
                ))}

              {/* Column dividers */}
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 pointer-events-none"
                  style={{
                    left: `${(i / 7) * 100}%`,
                    borderLeft: "1px solid var(--cal-line-main)",
                  }}
                />
              ))}

              {/* Weekend tint */}
              {weekendIndices.map((col) => (
                <div
                  key={col}
                  className="absolute top-0 bottom-0 pointer-events-none"
                  style={{
                    left: `${(col / 7) * 100}%`,
                    width: `${100 / 7}%`,
                    backgroundColor: "var(--cal-weekend-tint)",
                  }}
                />
              ))}

              {/* Events */}
              {eventsByDay.map((dayEvents, dayIdx) =>
                dayEvents.map((ev) => (
                  <EventBlock
                    key={ev.id}
                    event={ev}
                    dayIdx={dayIdx}
                    hourHeight={hourHeight}
                    isDragging={dragging?.event.id === ev.id}
                    onDragStart={handleDragStart}
                    onDragEnd={() => { setDragging(null); setDropTarget(null); }}
                    onClick={handleEventBlockClick}
                  />
                ))
              )}

              {/* Drop ghost */}
              {dragging && dropTarget && (
                <div
                  className="absolute rounded-md pointer-events-none"
                  style={{
                    top: (dropTarget.startMins / 60) * hourHeight,
                    height: Math.max((dragging.durationMins / 60) * hourHeight, 20),
                    left: `${(dropTarget.dayIdx / 7) * 100}%`,
                    width: `${100 / 7}%`,
                    backgroundColor: dragging.event.color ?? "#1a73e8",
                    opacity: 0.35,
                    border: "2px dashed rgba(255,255,255,0.75)",
                    zIndex: 10,
                  }}
                />
              )}

              {/* Current time indicator */}
              {isCurrentWeek && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    top: currentTimeTop - 6,
                    left: `${(todayColIdx / 7) * 100}%`,
                    width: `${100 / 7}%`,
                    zIndex: 5,
                  }}
                >
                  <div className="flex items-center">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: "#1a73e8", marginLeft: -6 }}
                    />
                    <div className="flex-1 h-0.5" style={{ backgroundColor: "#1a73e8" }} />
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {popover && (
        <EventPopover
          event={popover.event}
          anchorRect={popover.rect}
          onClose={() => setPopover(null)}
          onEdit={() => { onEventEdit(popover.event); setPopover(null); }}
          onDelete={(id) => { onEventDelete(id); setPopover(null); }}
        />
      )}
    </div>
  );
}
