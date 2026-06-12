"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Plus, Trash2, Bell, CalendarDays, Clock, X, CheckCircle2, Circle } from "lucide-react";

type Script = { id: string; title: string };
type CalendarEvent = {
  id: string; title: string; description: string | null;
  scheduled_at: string; remind_before_minutes: number | null;
  reminder_sent: boolean; script_id: string | null;
};
type EventForm = {
  title: string; date: string; time: string;
  description: string; remind_before_minutes: string; script_id: string;
};

const MONTHS_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DAYS_ES = ["L","M","X","J","V","S","D"];
const REMIND_OPTIONS = [
  { value: "", label: "Sin aviso" }, { value: "30", label: "30 min antes" },
  { value: "60", label: "1 hora antes" }, { value: "120", label: "2 horas antes" },
  { value: "1440", label: "24 horas antes" }, { value: "2880", label: "48 horas antes" },
];
const PRIMARY = "var(--color-primary)";
const EMPTY: CalendarEvent[] = [];

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function buildCalendarDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const total = new Date(year, month + 1, 0).getDate();
  let dow = first.getDay(); if (dow === 0) dow = 7;
  const days: Date[] = [];
  for (let i = dow - 1; i > 0; i--) days.push(new Date(year, month, 1 - i));
  for (let d = 1; d <= total; d++) days.push(new Date(year, month, d));
  let n = 1;
  while (days.length % 7 !== 0) days.push(new Date(year, month + 1, n++));
  return days;
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function fmtDayLabel(dateKey: string, todayKey: string, tomorrowKey: string): string {
  if (dateKey === todayKey) return "Hoy";
  if (dateKey === tomorrowKey) return "Mañana";
  const d = new Date(dateKey + "T12:00");
  return d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
}
function defaultForm(date?: Date): EventForm {
  return { title: "", date: toDateKey(date ?? new Date()), time: "12:00", description: "", remind_before_minutes: "", script_id: "" };
}
function formFromEvent(ev: CalendarEvent): EventForm {
  const d = new Date(ev.scheduled_at);
  return {
    title: ev.title, date: toDateKey(d),
    time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
    description: ev.description ?? "", remind_before_minutes: ev.remind_before_minutes != null ? String(ev.remind_before_minutes) : "",
    script_id: ev.script_id ?? "",
  };
}

// ── DayCell ──────────────────────────────────────────────────────────────────
const DayCell = React.memo(function DayCell({
  day, isCurrentMonth, isToday, isPast, dayEvents, onDayClick, onEventClick,
}: {
  day: Date; isCurrentMonth: boolean; isToday: boolean; isPast: boolean;
  dayEvents: CalendarEvent[];
  onDayClick: (d: Date) => void;
  onEventClick: (ev: CalendarEvent, e: React.MouseEvent) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onDayClick(day)}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onDayClick(day); }}
      className="relative text-left min-h-[90px] p-1.5 rounded-lg border cursor-pointer hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-accent)]/20"
      style={{
        backgroundColor: isToday ? "rgba(124,58,237,0.04)" : "transparent",
        borderColor: isToday ? "rgba(124,58,237,0.3)" : "var(--color-border)",
        opacity: isCurrentMonth ? 1 : 0.35,
      }}
    >
      <span className="text-[11px] font-semibold flex items-center justify-end mb-0.5">
        {isToday ? (
          <span className="w-[20px] h-[20px] rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: PRIMARY }}>
            {day.getDate()}
          </span>
        ) : (
          <span className={isCurrentMonth ? "text-[var(--color-foreground)]" : "text-[var(--color-muted-foreground)]"}>
            {day.getDate()}
          </span>
        )}
      </span>
      <div className="space-y-0.5">
        {dayEvents.slice(0, 3).map(ev => (
          <button key={ev.id} onClick={e => onEventClick(ev, e)}
            className="w-full text-left px-1.5 py-[2px] rounded text-[9px] font-medium truncate block"
            style={{
              backgroundColor: isPast ? "rgba(0,0,0,0.05)" : "rgba(124,58,237,0.10)",
              color: isPast ? "var(--color-muted-foreground)" : PRIMARY,
            }}>
            {fmtTime(ev.scheduled_at)} {ev.title}
          </button>
        ))}
        {dayEvents.length > 3 && (
          <p className="text-[8px] text-[var(--color-muted-foreground)] px-1">+{dayEvents.length - 3} más</p>
        )}
      </div>
    </div>
  );
});

// ── TodoWidget (right sidebar) ───────────────────────────────────────────────
type Todo = { id: string; title: string; completed: boolean; priority: "alta" | "media" | "baja" };
const PCOLOR: Record<string, string> = { alta: "#ef4444", media: "#f59e0b", baja: "#22c55e" };

function TodoWidget() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    fetch("/api/todos?filter=pending")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setTodos(d.slice(0, 12)); });
  }, []);

  async function addTodo(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const res = await fetch("/api/todos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: newTitle.trim() }) });
    const todo = await res.json();
    if (todo.id) { setTodos(prev => [todo, ...prev]); setNewTitle(""); }
  }

  async function complete(id: string) {
    await fetch(`/api/todos/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completed: true }) });
    setTodos(prev => prev.filter(t => t.id !== id));
  }

  return (
    <div className="w-56 flex-shrink-0">
      <div className="bg-white rounded-2xl overflow-hidden border border-[var(--color-border)]"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(0,0,0,0.06)]">
          <h2 className="text-sm font-bold" style={{ fontFamily: "var(--font-serif)" }}>To Do</h2>
          <a href="/todos" className="text-[10px] text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)] transition-colors">
            Ver todo →
          </a>
        </div>
        {/* Quick add */}
        <form onSubmit={addTodo} className="flex items-center gap-2 px-3 py-2.5 border-b border-[rgba(0,0,0,0.05)]">
          <input
            value={newTitle} onChange={e => setNewTitle(e.target.value)}
            placeholder="Nueva tarea..."
            className="flex-1 text-xs outline-none bg-transparent placeholder:text-[var(--color-muted-foreground)]"
          />
          <button type="submit"
            className="w-5 h-5 rounded-md flex items-center justify-center text-white flex-shrink-0 transition-opacity hover:opacity-80"
            style={{ backgroundColor: PRIMARY }}>
            <Plus size={10} />
          </button>
        </form>
        {/* List */}
        {todos.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-8 px-4 text-center">
            <CheckCircle2 size={20} className="opacity-20" />
            <p className="text-[10px] text-[var(--color-muted-foreground)]">Sin tareas pendientes</p>
          </div>
        ) : (
          <ul className="divide-y divide-[rgba(0,0,0,0.04)] max-h-72 overflow-y-auto">
            {todos.map(todo => (
              <li key={todo.id} className="flex items-center gap-2.5 px-3 py-2.5 group">
                <button onClick={() => complete(todo.id)}
                  className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center hover:opacity-70 transition-opacity"
                  style={{ borderColor: PCOLOR[todo.priority] ?? "var(--color-border)" }}>
                  <Circle size={6} style={{ color: PCOLOR[todo.priority] ?? "var(--color-border)" }} />
                </button>
                <span className="text-[11px] truncate flex-1 leading-snug">{todo.title}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── UpcomingSidebar ───────────────────────────────────────────────────────────
function UpcomingSidebar({ upcoming, today, onEventClick, onNewEvent }: {
  upcoming: CalendarEvent[]; today: Date;
  onEventClick: (ev: CalendarEvent, e: React.MouseEvent) => void;
  onNewEvent: () => void;
}) {
  const todayKey = toDateKey(today);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = toDateKey(tomorrow);

  const groups = useMemo(() => {
    const byDay: Record<string, CalendarEvent[]> = {};
    for (const ev of upcoming) {
      const k = toDateKey(new Date(ev.scheduled_at));
      if (!byDay[k]) byDay[k] = [];
      byDay[k].push(ev);
    }
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, evs]) => ({ label: fmtDayLabel(key, todayKey, tomorrowKey), key, events: evs }));
  }, [upcoming, todayKey, tomorrowKey]);

  return (
    <div className="w-64 flex-shrink-0 flex flex-col gap-3">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-[var(--color-border)] shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-bold" style={{ fontFamily: "var(--font-serif)" }}>Próximos eventos</h2>
          <button onClick={onNewEvent}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-white transition-opacity hover:opacity-80"
            style={{ backgroundColor: PRIMARY }}>
            <Plus size={12} />
          </button>
        </div>
        <p className="text-[10px] text-[var(--color-muted-foreground)]">Próximos 14 días</p>
      </div>

      {/* Events */}
      <div className="bg-white rounded-2xl border border-[var(--color-border)] shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden flex-1">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 px-4 text-center">
            <CalendarDays size={24} className="opacity-20" />
            <p className="text-xs text-[var(--color-muted-foreground)]">Sin eventos próximos</p>
          </div>
        ) : (
          <div className="divide-y divide-[rgba(0,0,0,0.05)]">
            {groups.map(group => (
              <div key={group.key}>
                <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-muted-foreground)] px-4 pt-3 pb-1.5">
                  {group.label}
                </p>
                {group.events.map(ev => (
                  <button key={ev.id} onClick={e => onEventClick(ev, e)}
                    className="w-full text-left px-4 py-2 hover:bg-[var(--color-muted)] transition-colors flex items-start gap-2">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: PRIMARY }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold truncate">{ev.title}</p>
                      <p className="text-[10px] text-[var(--color-muted-foreground)] flex items-center gap-1 mt-0.5">
                        <Clock size={9} /> {fmtTime(ev.scheduled_at)}
                      </p>
                      {ev.description && (
                        <p className="text-[9px] text-[var(--color-muted-foreground)] truncate mt-0.5 opacity-70">{ev.description}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── EventModal ────────────────────────────────────────────────────────────────
function EventModal({ open, onClose, editing, defaultDate, scripts, userEmail, onSave, onDelete }: {
  open: boolean; onClose: () => void; editing: CalendarEvent | null;
  defaultDate: Date; scripts: Script[]; userEmail: string;
  onSave: (ev: CalendarEvent) => void; onDelete: (id: string) => void;
}) {
  const [form, setForm] = useState<EventForm>(() => defaultForm(defaultDate));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (open) { setForm(editing ? formFromEvent(editing) : defaultForm(defaultDate)); setErr(null); }
  }, [open, editing, defaultDate]);
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [open, onClose]);

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true); setErr(null);
    const scheduled_at = new Date(`${form.date}T${form.time}`).toISOString();
    const body = {
      title: form.title.trim(), description: form.description.trim() || null,
      scheduled_at, remind_before_minutes: form.remind_before_minutes ? Number(form.remind_before_minutes) : null,
      script_id: form.script_id || null,
    };
    try {
      const res = editing
        ? await fetch(`/api/calendario/events/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await fetch("/api/calendario/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok || json.error) { setErr(json.error ?? "Error al guardar."); return; }
      if (!json.id) { setErr("Respuesta inesperada."); return; }
      onSave(json as CalendarEvent);
    } catch { setErr("Error de conexión."); }
    finally { setSaving(false); }
  }

  async function del() {
    if (!editing) return;
    setDeleting(true);
    try { await fetch(`/api/calendario/events/${editing.id}`, { method: "DELETE" }); onDelete(editing.id); }
    finally { setDeleting(false); }
  }

  const f = (k: keyof EventForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  if (!mounted || !open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }} onMouseDown={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto border border-[var(--color-border)]"
        onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-serif)" }}>
            {editing ? "Editar evento" : "Nuevo evento"}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--color-muted)]"><X size={15} /></button>
        </div>

        <div className="space-y-3.5">
          <div>
            <label className="text-xs font-medium block mb-1.5">Título <span className="text-red-500">*</span></label>
            <input type="text" value={form.title} onChange={f("title")} autoFocus
              placeholder="Ej: Grabar gancho + intro"
              className="w-full text-sm border border-[var(--color-border)] rounded-xl px-3 py-2.5 outline-none focus:border-[var(--color-primary)] transition-colors" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1.5">Fecha</label>
              <input type="date" value={form.date} onChange={f("date")}
                className="w-full text-sm border border-[var(--color-border)] rounded-xl px-3 py-2.5 outline-none focus:border-[var(--color-primary)] transition-colors" />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5">Hora</label>
              <input type="time" value={form.time} onChange={f("time")}
                className="w-full text-sm border border-[var(--color-border)] rounded-xl px-3 py-2.5 outline-none focus:border-[var(--color-primary)] transition-colors" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5">Notas / Partes a grabar</label>
            <textarea value={form.description} onChange={f("description")} rows={3}
              placeholder="Ej: Primero el gancho, los 3 puntos clave, CTA al final"
              className="w-full text-sm border border-[var(--color-border)] rounded-xl px-3 py-2.5 outline-none focus:border-[var(--color-primary)] transition-colors resize-none" />
          </div>
          {scripts.length > 0 && (
            <div>
              <label className="text-xs font-medium block mb-1.5">Vincular guion (opcional)</label>
              <select value={form.script_id} onChange={f("script_id")}
                className="w-full text-sm border border-[var(--color-border)] rounded-xl px-3 py-2.5 outline-none focus:border-[var(--color-primary)] bg-white transition-colors">
                <option value="">— Ninguno —</option>
                {scripts.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs font-medium flex items-center gap-1.5 mb-1.5">
              <Bell size={10} /> Aviso por email <span className="text-[var(--color-muted-foreground)] font-normal">({userEmail})</span>
            </label>
            <select value={form.remind_before_minutes} onChange={f("remind_before_minutes")}
              className="w-full text-sm border border-[var(--color-border)] rounded-xl px-3 py-2.5 outline-none focus:border-[var(--color-primary)] bg-white transition-colors">
              {REMIND_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {err && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-border)]">
            {editing && (
              <button onClick={del} disabled={deleting}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors">
                <Trash2 size={11} /> {deleting ? "..." : "Eliminar"}
              </button>
            )}
            <div className="flex-1" />
            <button onClick={onClose}
              className="text-sm px-4 py-2 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-muted)] transition-colors">
              Cancelar
            </button>
            <button onClick={save} disabled={saving || !form.title.trim()}
              className="text-sm px-4 py-2 rounded-xl text-white font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ backgroundColor: PRIMARY }}>
              {saving ? "Guardando..." : editing ? "Guardar" : "Crear"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function CalendarioClient({ scripts, userEmail }: { scripts: Script[]; userEmail: string }) {
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [upcoming, setUpcoming] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [modalDate, setModalDate] = useState<Date>(today);

  const calDays = useMemo(() => buildCalendarDays(year, month), [year, month]);

  const eventMap = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      const k = toDateKey(new Date(ev.scheduled_at));
      if (!map[k]) map[k] = [];
      map[k].push(ev);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    }
    return map;
  }, [events]);

  const loadEvents = useCallback(async (days: Date[]) => {
    if (!days.length) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/calendario/events?start=${toDateKey(days[0])}&end=${toDateKey(days[days.length - 1])}`);
      const data = await res.json();
      if (Array.isArray(data)) setEvents(data);
    } finally { setLoading(false); }
  }, []);

  const loadUpcoming = useCallback(async () => {
    const start = toDateKey(today);
    const end = toDateKey(new Date(today.getTime() + 14 * 86_400_000));
    const res = await fetch(`/api/calendario/events?start=${start}&end=${end}`);
    const data = await res.json();
    if (Array.isArray(data)) setUpcoming(data.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()));
  }, [today]);

  useEffect(() => { loadEvents(calDays); }, [calDays, loadEvents]);
  useEffect(() => { loadUpcoming(); }, [loadUpcoming]);

  function navigate(dir: 1 | -1) {
    let m = month + dir, y = year;
    if (m > 11) { m = 0; y++; } if (m < 0) { m = 11; y--; }
    setMonth(m); setYear(y);
  }

  const openCreate = useCallback((date: Date) => {
    setEditing(null); setModalDate(date); setModalOpen(true);
  }, []);

  const openEdit = useCallback((ev: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation(); setEditing(ev); setModalDate(new Date(ev.scheduled_at)); setModalOpen(true);
  }, []);

  function handleSave(ev: CalendarEvent) {
    setEvents(prev => prev.some(e => e.id === ev.id) ? prev.map(e => e.id === ev.id ? ev : e) : [...prev, ev]);
    setModalOpen(false);
    loadUpcoming();
  }

  function handleDelete(id: string) {
    setEvents(prev => prev.filter(e => e.id !== id));
    setModalOpen(false);
    loadUpcoming();
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-8">
      <div className="flex gap-5 items-start">

        {/* ── Sidebar ── */}
        <div className="hidden lg:block">
          <UpcomingSidebar
            upcoming={upcoming} today={today}
            onEventClick={openEdit}
            onNewEvent={() => openCreate(today)}
          />
        </div>

        {/* ── Calendar card (paper look) ── */}
        <div className="flex-1 min-w-0 bg-white rounded-2xl overflow-hidden border border-[var(--color-border)]"
          style={{ boxShadow: "0 4px 32px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)" }}>

          {/* Calendar header strip */}
          <div className="px-6 py-4 border-b border-[rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-serif)" }}>
                  {MONTHS_ES[month]} {year}
                </h1>
                <div className="flex items-center gap-0.5">
                  <button onClick={() => navigate(-1)}
                    className="p-1.5 rounded-lg hover:bg-[var(--color-muted)] transition-colors">
                    <ChevronLeft size={14} />
                  </button>
                  <button onClick={() => navigate(1)}
                    className="p-1.5 rounded-lg hover:bg-[var(--color-muted)] transition-colors">
                    <ChevronRight size={14} />
                  </button>
                </div>
                <button
                  onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
                  className="text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] px-2.5 py-1 rounded-lg hover:bg-[var(--color-muted)] transition-colors border border-[rgba(0,0,0,0.08)]">
                  Hoy
                </button>
              </div>
              <button onClick={() => openCreate(today)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ backgroundColor: PRIMARY }}>
                <Plus size={13} /> Nuevo evento
              </button>
            </div>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-[rgba(0,0,0,0.06)]">
            {DAYS_ES.map(d => (
              <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wide text-[var(--color-muted-foreground)] py-2.5">
                {d}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className={`grid grid-cols-7 p-3 gap-1.5 ${loading ? "opacity-60" : ""}`}>
            {calDays.map((day, i) => {
              const k = toDateKey(day);
              return (
                <DayCell key={i} day={day}
                  isCurrentMonth={day.getMonth() === month}
                  isToday={k === todayKey}
                  isPast={day < today && k !== todayKey}
                  dayEvents={eventMap[k] ?? EMPTY}
                  onDayClick={openCreate}
                  onEventClick={openEdit}
                />
              );
            })}
          </div>
        </div>

        {/* ── Right sidebar: To Do widget ── */}
        <div className="hidden xl:block">
          <TodoWidget />
        </div>

      </div>

      <EventModal
        open={modalOpen} onClose={() => setModalOpen(false)}
        editing={editing} defaultDate={modalDate}
        scripts={scripts} userEmail={userEmail}
        onSave={handleSave} onDelete={handleDelete}
      />
    </div>
  );
}
