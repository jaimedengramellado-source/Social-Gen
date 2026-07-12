"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getWeekStart, getWeekDays, toDateStr, EVENT_TAGS } from "./types";
import type { CalendarEvent, Script } from "./types";
import { CalendarProvider, useCalSettings } from "./CalendarContext";
import { CalendarHeader } from "./CalendarHeader";
import type { CalendarView } from "./CalendarHeader";
import { CalendarGrid } from "./CalendarGrid";
import { MonthlyGrid, getMonthCalendarRange } from "./MonthlyGrid";
import { EventModal } from "./EventModal";
import { CalendarSettingsModal } from "./CalendarSettingsModal";
import { BestTimesPanel } from "./BestTimesPanel";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface Props {
  scripts: Script[];
  userEmail: string;
}

// Inner component that consumes the context
function CalendarInner({ scripts, userEmail }: Props) {
  const { settings } = useCalSettings();
  const today = useMemo(() => new Date(), []);

  const [anchor, setAnchor] = useState<Date>(() => new Date(today));
  const [view, setView] = useState<CalendarView>("week");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [bestTimesOpen, setBestTimesOpen] = useState(false);
  const [modalDefaultTag, setModalDefaultTag] = useState<string>("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [modalDate, setModalDate] = useState<Date>(today);
  const [modalHour, setModalHour] = useState(9);
  const [modalMinute, setModalMinute] = useState(0);

  const weekStart = useMemo(
    () => getWeekStart(anchor, settings.weekStartsOn),
    [anchor, settings.weekStartsOn]
  );
  const days = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();

  const title = useMemo(() => {
    if (view === "month") return `${MONTH_NAMES[month]} ${year}`;
    const weekEnd = days[6];
    const sM = weekStart.getMonth();
    const eM = weekEnd.getMonth();
    const sY = weekStart.getFullYear();
    const eY = weekEnd.getFullYear();
    if (sY !== eY) return `${MONTH_NAMES[sM]} ${sY} – ${MONTH_NAMES[eM]} ${eY}`;
    if (sM !== eM) return `${MONTH_NAMES[sM]} – ${MONTH_NAMES[eM]} ${sY}`;
    return `${MONTH_NAMES[sM]} ${sY}`;
  }, [view, weekStart, days, month, year]);

  const usedTags = useMemo(
    () => EVENT_TAGS.filter((t) => events.some((e) => e.tag === t.id)),
    [events]
  );
  const visibleEvents = useMemo(
    () => (tagFilter ? events.filter((e) => e.tag === tagFilter) : events),
    [events, tagFilter]
  );

  const loadEvents = useCallback(async (start: Date, end: Date) => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/calendario/events?start=${toDateStr(start)}&end=${toDateStr(end)}`
      );
      const data = await res.json();
      if (Array.isArray(data)) setEvents(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === "week") {
      loadEvents(weekStart, days[6]);
    } else {
      const [start, end] = getMonthCalendarRange(year, month, settings.weekStartsOn);
      loadEvents(start, end);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, view, settings.weekStartsOn]);

  function navigate(dir: 1 | -1) {
    setAnchor((prev) => {
      if (view === "week") {
        const d = new Date(prev);
        d.setDate(d.getDate() + dir * 7);
        return d;
      }
      return new Date(prev.getFullYear(), prev.getMonth() + dir, 1);
    });
  }

  function goToday() {
    setAnchor(new Date(today));
  }

  function changeView(v: CalendarView) {
    setView(v);
  }

  function openCreate(day: Date, hour: number, minute: number, defaultTag = "") {
    setEditing(null);
    setModalDate(day);
    setModalHour(hour);
    setModalMinute(minute);
    setModalDefaultTag(defaultTag);
    setModalOpen(true);
  }

  function pickBestTimeSlot(weekday: number, hour: number) {
    setBestTimesOpen(false);
    // Próxima fecha (hoy incluido) que caiga en ese día de la semana
    const d = new Date(today);
    d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7));
    setAnchor(new Date(d));
    openCreate(d, hour, 0, "publicar");
  }

  function openEdit(event: CalendarEvent) {
    const start = new Date(event.start_time);
    setEditing(event);
    setModalDate(start);
    setModalHour(start.getHours());
    setModalMinute(start.getMinutes());
    setModalOpen(true);
  }

  function handleSave(ev: CalendarEvent) {
    setEvents((prev) =>
      prev.some((e) => e.id === ev.id)
        ? prev.map((e) => (e.id === ev.id ? ev : e))
        : [...prev, ev]
    );
    setModalOpen(false);
  }

  function handleDelete(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setModalOpen(false);
  }

  async function handleEventDelete(id: string) {
    await fetch(`/api/calendario/events/${id}`, { method: "DELETE" });
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  async function handleEventMove(id: string, newStart: Date, newEnd: Date) {
    // Optimistic update
    setEvents((prev) =>
      prev.map((ev) =>
        ev.id !== id
          ? ev
          : {
              ...ev,
              start_time: newStart.toISOString(),
              end_time: newEnd.toISOString(),
              scheduled_at: newStart.toISOString(),
            }
      )
    );

    const ev = events.find((e) => e.id === id);
    if (!ev) return;

    await fetch(`/api/calendario/events/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: ev.title,
        description: ev.description,
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
        color: ev.color,
        tag: ev.tag,
        script_id: ev.script_id,
        remind_times: ev.remind_times ?? [],
        remind_before_minutes: ev.remind_before_minutes,
        scheduled_at: newStart.toISOString(),
      }),
    });
  }

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden border border-[var(--color-border)] flex flex-col"
      style={{
        boxShadow: "0 4px 32px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
        height: "calc(100vh - 7rem)",
      }}
    >
      <CalendarHeader
        title={title}
        view={view}
        onViewChange={changeView}
        onPrev={() => navigate(-1)}
        onNext={() => navigate(1)}
        onToday={goToday}
        onNewEvent={() => openCreate(today, 9, 0)}
        onSettingsOpen={() => setSettingsOpen(true)}
        onBestTimesOpen={() => setBestTimesOpen(true)}
      />

      {usedTags.length > 0 && (
        <div className="flex items-center gap-1.5 px-3 md:px-5 py-2 border-b border-[var(--color-border)] flex-shrink-0 bg-white overflow-x-auto">
          <button
            onClick={() => setTagFilter(null)}
            className="px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors flex-shrink-0"
            style={{
              borderColor: tagFilter === null ? "var(--color-primary)" : "var(--color-border)",
              backgroundColor: tagFilter === null ? "var(--color-primary)" : "transparent",
              color: tagFilter === null ? "white" : "var(--color-muted-foreground)",
            }}
          >
            Todos
          </button>
          {usedTags.map((t) => {
            const active = tagFilter === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTagFilter(active ? null : t.id)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors flex-shrink-0"
                style={{
                  borderColor: active ? "var(--color-primary)" : "var(--color-border)",
                  backgroundColor: active ? "var(--color-primary-light)" : "transparent",
                  color: active ? "var(--color-primary)" : "var(--color-muted-foreground)",
                }}
              >
                <span aria-hidden>{t.emoji}</span> {t.label}
              </button>
            );
          })}
        </div>
      )}

      {/* flex flex-col es imprescindible: sin ello el grid no acota su alto y el
          scroll interno de la vista semanal nunca se activa */}
      <div
        className="flex-1 min-h-0 flex flex-col transition-opacity duration-150"
        style={{ opacity: loading ? 0.6 : 1 }}
      >
        {view === "week" ? (
          <CalendarGrid
            days={days}
            events={visibleEvents}
            today={today}
            onCellClick={openCreate}
            onEventEdit={openEdit}
            onEventDelete={handleEventDelete}
            onEventMove={handleEventMove}
          />
        ) : (
          <MonthlyGrid
            year={year}
            month={month}
            events={visibleEvents}
            today={today}
            onCellClick={openCreate}
            onEventEdit={openEdit}
            onEventDelete={handleEventDelete}
            onEventMove={handleEventMove}
          />
        )}
      </div>

      <EventModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        defaultDate={modalDate}
        defaultHour={modalHour}
        defaultMinute={modalMinute}
        defaultTag={modalDefaultTag}
        scripts={scripts}
        userEmail={userEmail}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      {settingsOpen && (
        <CalendarSettingsModal onClose={() => setSettingsOpen(false)} />
      )}

      {bestTimesOpen && (
        <BestTimesPanel
          onClose={() => setBestTimesOpen(false)}
          onPickSlot={pickBestTimeSlot}
        />
      )}
    </div>
  );
}

export function WeeklyCalendar({ scripts, userEmail }: Props) {
  return (
    <CalendarProvider>
      <CalendarInner scripts={scripts} userEmail={userEmail} />
    </CalendarProvider>
  );
}
