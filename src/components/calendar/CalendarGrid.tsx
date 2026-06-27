"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import {
  HOUR_HEIGHT,
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

  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [popover, setPopover] = useState<{ event: CalendarEvent; rect: DOMRect } | null>(null);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const minsNow = minutesOfDay(new Date());
      const scrollTo = Math.max(0, (minsNow / 60) * HOUR_HEIGHT - HOUR_HEIGHT * 2);
      scrollRef.current.scrollTop = scrollTo;
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const tzLabel = useMemo(
    () => settings.tzLabel || getTzLabel(),
    [settings.tzLabel]
  );
  const todayColIdx = days.findIndex((d) => isSameDay(d, today));
  const isCurrentWeek = todayColIdx >= 0;
  const currentTimeTop = (minutesOfDay(currentTime) / 60) * HOUR_HEIGHT;

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
    const relY = e.clientY - rect.top + scrollRef.current.scrollTop;

    const dayIdx = Math.max(0, Math.min(6, Math.floor(relX / (rect.width / 7))));
    const rawStartMins = (relY / HOUR_HEIGHT) * 60 - dragging.offsetMins;
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
    const relY = e.clientY - rect.top + (scrollRef.current?.scrollTop ?? 0);

    const dayIdx = Math.max(0, Math.min(6, Math.floor(relX / (rect.width / 7))));
    const rawMins = (relY / HOUR_HEIGHT) * 60;
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

      {/* ── Scrollable grid body ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex" style={{ height: 24 * HOUR_HEIGHT }}>

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
                  top: h * HOUR_HEIGHT - 6,
                  width: "100%",
                  opacity: h === 0 ? 0 : 1,
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
            style={{ height: 24 * HOUR_HEIGHT }}
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
                  top: h * HOUR_HEIGHT,
                  borderTop: h === 0 ? "none" : "1px solid rgba(0,0,0,0.07)",
                }}
              />
            ))}

            {/* Half-hour dashes */}
            {HOURS.map((h) => (
              <div
                key={`hh${h}`}
                className="absolute left-0 right-0 pointer-events-none"
                style={{
                  top: h * HOUR_HEIGHT + HOUR_HEIGHT / 2,
                  borderTop: "1px dashed rgba(0,0,0,0.04)",
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
                  borderLeft: "1px solid rgba(0,0,0,0.07)",
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
                  backgroundColor: "rgba(0,0,0,0.015)",
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
                  top: (dropTarget.startMins / 60) * HOUR_HEIGHT,
                  height: Math.max((dragging.durationMins / 60) * HOUR_HEIGHT, 20),
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
