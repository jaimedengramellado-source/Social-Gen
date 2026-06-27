"use client";

import { HOUR_HEIGHT, minutesOfDay, formatTime } from "./types";
import { useCalSettings } from "./CalendarContext";
import type { LayoutEvent } from "./types";

interface Props {
  event: LayoutEvent;
  dayIdx: number;
  isDragging?: boolean;
  onDragStart?: (eventId: string, offsetMins: number) => void;
  onDragEnd?: () => void;
  onClick: (e: React.MouseEvent, eventId: string) => void;
}

export function EventBlock({ event, dayIdx, isDragging, onDragStart, onDragEnd, onClick }: Props) {
  const { settings } = useCalSettings();

  const start = new Date(event.start_time);
  const end = event.end_time
    ? new Date(event.end_time)
    : new Date(start.getTime() + 3_600_000);

  const startMins = minutesOfDay(start);
  const durationMins = Math.max(minutesOfDay(end) - startMins, 15);
  const height = (durationMins / 60) * HOUR_HEIGHT;
  const top = (startMins / 60) * HOUR_HEIGHT;

  const dayWidthPct = 100 / 7;
  const colWidthPct = dayWidthPct / event.totalCols;
  const leftPct = dayIdx * dayWidthPct + event.colIdx * colWidthPct + 0.25;
  const widthPct = colWidthPct - 0.5;

  const color = event.color ?? "#1a73e8";

  return (
    <div
      data-event-block="true"
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        if (!onDragStart) return;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const offsetPx = e.clientY - rect.top;
        const offsetMins = Math.round((offsetPx / HOUR_HEIGHT) * 60);
        e.dataTransfer.effectAllowed = "move";
        // Required for Firefox
        e.dataTransfer.setData("text/plain", event.id);
        onDragStart(event.id, Math.max(0, offsetMins));
      }}
      onDragEnd={onDragEnd}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick(e as unknown as React.MouseEvent, event.id);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e, event.id);
      }}
      className="absolute rounded-md px-1.5 py-1 overflow-hidden cursor-grab select-none transition-[filter,opacity] hover:brightness-90"
      style={{
        top,
        height: Math.max(height, 20),
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        backgroundColor: color,
        zIndex: isDragging ? 1 : 2,
        minHeight: 20,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <p className="text-white text-[11px] font-semibold leading-tight truncate">
        {event.title}
      </p>
      {height >= 40 && (
        <p className="text-white/80 text-[10px] leading-tight mt-0.5">
          {formatTime(event.start_time, settings.timeFormat)} – {formatTime(end.toISOString(), settings.timeFormat)}
        </p>
      )}
    </div>
  );
}
