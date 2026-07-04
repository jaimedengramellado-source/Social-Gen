"use client";

import React, { useState, useMemo } from "react";
import { isSameDay, formatTime } from "./types";
import { useCalSettings } from "./CalendarContext";
import type { CalendarEvent } from "./types";
import { EventPopover } from "./EventPopover";

function buildCalendarDays(year: number, month: number, weekStartsOn: 0 | 1): Date[] {
  const first = new Date(year, month, 1);
  let dow = first.getDay(); // 0=Sun..6=Sat
  // Days to prepend before the 1st
  const leadDays = ((dow - weekStartsOn + 7) % 7);
  const total = new Date(year, month + 1, 0).getDate();

  const days: Date[] = [];
  for (let i = leadDays; i > 0; i--) days.push(new Date(year, month, 1 - i));
  for (let d = 1; d <= total; d++) days.push(new Date(year, month, d));
  let n = 1;
  while (days.length % 7 !== 0) days.push(new Date(year, month + 1, n++));
  return days;
}

export function getMonthCalendarRange(year: number, month: number, weekStartsOn: 0 | 1 = 1): [Date, Date] {
  const days = buildCalendarDays(year, month, weekStartsOn);
  return [days[0], days[days.length - 1]];
}

interface Props {
  year: number;
  month: number;
  events: CalendarEvent[];
  today: Date;
  onCellClick: (day: Date, hour: number, minute: number) => void;
  onEventEdit: (event: CalendarEvent) => void;
  onEventDelete: (id: string) => void;
  onEventMove: (id: string, newStart: Date, newEnd: Date) => void;
}

function dayAbbr(dow: number): string {
  return ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"][dow];
}

export function MonthlyGrid({
  year,
  month,
  events,
  today,
  onCellClick,
  onEventEdit,
  onEventDelete,
  onEventMove,
}: Props) {
  const { settings } = useCalSettings();
  const calDays = useMemo(
    () => buildCalendarDays(year, month, settings.weekStartsOn),
    [year, month, settings.weekStartsOn]
  );
  const [popover, setPopover] = useState<{ event: CalendarEvent; rect: DOMRect } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const eventMap = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      const d = new Date(ev.start_time);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    }
    for (const vals of Object.values(map)) {
      vals.sort(
        (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
    }
    return map;
  }, [events]);

  function dayKey(d: Date): string {
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  function handleEventClick(e: React.MouseEvent, ev: CalendarEvent) {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopover({ event: ev, rect });
  }

  function handleDrop(day: Date) {
    if (!draggingId) return;
    const ev = events.find((e) => e.id === draggingId);
    if (!ev) return;

    const origStart = new Date(ev.start_time);
    const newStart = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      origStart.getHours(),
      origStart.getMinutes()
    );
    const dur = ev.end_time
      ? new Date(ev.end_time).getTime() - origStart.getTime()
      : 3_600_000;
    const newEnd = new Date(newStart.getTime() + dur);

    onEventMove(draggingId, newStart, newEnd);
    setDraggingId(null);
    setDragOverKey(null);
  }

  const weeks = calDays.length / 7;

  // Header day order matches weekStartsOn
  const headerDows = Array.from({ length: 7 }, (_, i) => (settings.weekStartsOn + i) % 7);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Day name header */}
      <div className="grid grid-cols-7 border-b border-[var(--color-border)] flex-shrink-0 bg-white">
        {headerDows.map((dow) => (
          <div
            key={dow}
            className="text-center text-[10px] font-bold uppercase tracking-wide text-[var(--color-muted-foreground)] py-2.5"
          >
            {dayAbbr(dow)}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div
        className="flex-1 grid grid-cols-7 min-h-0"
        style={{ gridTemplateRows: `repeat(${weeks}, 1fr)` }}
      >
        {calDays.map((day, i) => {
          const isCurrentMonth = day.getMonth() === month;
          const isToday = isSameDay(day, today);
          const dow = day.getDay();
          const isWeekend = dow === 0 || dow === 6;
          const key = dayKey(day);
          const dayEvs = eventMap[key] ?? [];
          const isDragOver = dragOverKey === key;

          return (
            <div
              key={i}
              role="button"
              tabIndex={0}
              onClick={() => onCellClick(day, 9, 0)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onCellClick(day, 9, 0);
              }}
              onDragOver={(e) => { e.preventDefault(); setDragOverKey(key); }}
              onDragLeave={(e) => {
                if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
                  setDragOverKey(null);
                }
              }}
              onDrop={(e) => { e.preventDefault(); handleDrop(day); }}
              className="relative p-1.5 border-b border-r border-[rgba(0,0,0,0.07)] cursor-pointer transition-colors overflow-hidden"
              style={{
                opacity: isCurrentMonth ? 1 : 0.38,
                backgroundColor: isDragOver
                  ? "rgba(140,34,48,0.06)"
                  : isWeekend
                  ? "rgba(0,0,0,0.012)"
                  : undefined,
                outline: isDragOver ? "2px inset rgba(140,34,48,0.3)" : undefined,
              }}
            >
              <div className="flex justify-end mb-1">
                {isToday ? (
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white leading-none"
                    style={{ backgroundColor: "#1a73e8" }}
                  >
                    {day.getDate()}
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold leading-none">
                    {day.getDate()}
                  </span>
                )}
              </div>

              <div className="space-y-[2px]">
                {dayEvs.slice(0, 3).map((ev) => (
                  <button
                    key={ev.id}
                    draggable
                    onDragStart={(e) => {
                      e.stopPropagation();
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", ev.id);
                      setDraggingId(ev.id);
                      setPopover(null);
                    }}
                    onDragEnd={() => { setDraggingId(null); setDragOverKey(null); }}
                    onClick={(e) => handleEventClick(e, ev)}
                    className="w-full text-left px-1.5 py-[2px] rounded text-[9px] font-semibold truncate block leading-tight transition-opacity hover:opacity-75 cursor-grab"
                    style={{
                      backgroundColor: ev.color ? `${ev.color}22` : "rgba(26,115,232,0.12)",
                      color: ev.color ?? "#1a73e8",
                      opacity: draggingId === ev.id ? 0.4 : 1,
                    }}
                  >
                    {formatTime(ev.start_time, settings.timeFormat)} {ev.title}
                  </button>
                ))}
                {dayEvs.length > 3 && (
                  <p className="text-[8px] text-[var(--color-muted-foreground)] px-1 leading-tight">
                    +{dayEvs.length - 3} más
                  </p>
                )}
              </div>
            </div>
          );
        })}
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
