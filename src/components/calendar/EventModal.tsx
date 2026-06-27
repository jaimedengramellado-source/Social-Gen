"use client";

import { createPortal } from "react-dom";
import { useState, useEffect } from "react";
import { X, Trash2, Bell, Plus } from "lucide-react";
import { EVENT_COLORS, toDateStr } from "./types";
import type { CalendarEvent, Script } from "./types";

const REMIND_OPTIONS = [
  { value: 10, label: "10 min antes" },
  { value: 30, label: "30 min antes" },
  { value: 60, label: "1 hora antes" },
  { value: 120, label: "2 horas antes" },
  { value: 1440, label: "1 día antes" },
  { value: 2880, label: "2 días antes" },
];

type EventForm = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  color: string;
  description: string;
  script_id: string;
  reminders: number[];
};

function defaultForm(date: Date, hour: number, minute: number): EventForm {
  const h = hour.toString().padStart(2, "0");
  const m = minute.toString().padStart(2, "0");
  const endH = hour < 23 ? (hour + 1).toString().padStart(2, "0") : "23";
  const endM = hour < 23 ? m : "59";
  return {
    title: "",
    date: toDateStr(date),
    startTime: `${h}:${m}`,
    endTime: `${endH}:${endM}`,
    color: EVENT_COLORS[0],
    description: "",
    script_id: "",
    reminders: [],
  };
}

function formFromEvent(ev: CalendarEvent): EventForm {
  const start = new Date(ev.start_time);
  const end = ev.end_time
    ? new Date(ev.end_time)
    : new Date(start.getTime() + 3_600_000);
  const pad = (n: number) => n.toString().padStart(2, "0");

  // Prefer new-style array; fall back to legacy single value
  let reminders: number[] = [];
  if (Array.isArray(ev.remind_times) && ev.remind_times.length > 0) {
    reminders = ev.remind_times;
  } else if (ev.remind_before_minutes != null) {
    reminders = [ev.remind_before_minutes];
  }

  return {
    title: ev.title,
    date: toDateStr(start),
    startTime: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    endTime: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
    color: ev.color ?? EVENT_COLORS[0],
    description: ev.description ?? "",
    script_id: ev.script_id ?? "",
    reminders,
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  editing: CalendarEvent | null;
  defaultDate: Date;
  defaultHour: number;
  defaultMinute: number;
  scripts: Script[];
  userEmail: string;
  onSave: (ev: CalendarEvent) => void;
  onDelete: (id: string) => void;
}

export function EventModal({
  open,
  onClose,
  editing,
  defaultDate,
  defaultHour,
  defaultMinute,
  scripts,
  userEmail,
  onSave,
  onDelete,
}: Props) {
  const [form, setForm] = useState<EventForm>(() =>
    defaultForm(defaultDate, defaultHour, defaultMinute)
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setForm(
      editing
        ? formFromEvent(editing)
        : defaultForm(defaultDate, defaultHour, defaultMinute)
    );
  }, [open, editing, defaultDate, defaultHour, defaultMinute]);

  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [open, onClose]);

  const set =
    (k: keyof EventForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  function addReminder() {
    // Default to first option not already selected, or 60 if all taken
    const used = new Set(form.reminders);
    const next = REMIND_OPTIONS.find((o) => !used.has(o.value))?.value ?? 60;
    setForm((p) => ({ ...p, reminders: [...p.reminders, next] }));
  }

  function updateReminder(idx: number, val: number) {
    setForm((p) => ({
      ...p,
      reminders: p.reminders.map((v, i) => (i === idx ? val : v)),
    }));
  }

  function removeReminder(idx: number) {
    setForm((p) => ({ ...p, reminders: p.reminders.filter((_, i) => i !== idx) }));
  }

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    setErr(null);
    const start_time = new Date(`${form.date}T${form.startTime}`).toISOString();
    const end_time = new Date(`${form.date}T${form.endTime}`).toISOString();
    const body = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      start_time,
      end_time,
      color: form.color,
      script_id: form.script_id || null,
      remind_times: form.reminders,
      remind_before_minutes: form.reminders[0] ?? null,
    };
    try {
      const url = editing
        ? `/api/calendario/events/${editing.id}`
        : "/api/calendario/events";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setErr(json.error ?? "Error al guardar.");
        return;
      }
      onSave(json as CalendarEvent);
    } catch {
      setErr("Error de conexión.");
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!editing) return;
    setDeleting(true);
    try {
      await fetch(`/api/calendario/events/${editing.id}`, { method: "DELETE" });
      onDelete(editing.id);
    } finally {
      setDeleting(false);
    }
  }

  if (!mounted || !open) return null;

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
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-lg font-bold"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {editing ? "Editar evento" : "Nuevo evento"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[var(--color-muted)] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="space-y-3.5">
          {/* Title */}
          <div>
            <label className="text-xs font-medium block mb-1.5">
              Título <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={set("title")}
              autoFocus
              placeholder="Ej: Grabar gancho + intro"
              className="w-full text-sm border border-[var(--color-border)] rounded-xl px-3 py-2.5 outline-none focus:border-[var(--color-primary)] transition-colors"
            />
          </div>

          {/* Date + times */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-medium block mb-1.5">Fecha</label>
              <input
                type="date"
                value={form.date}
                onChange={set("date")}
                className="w-full text-sm border border-[var(--color-border)] rounded-xl px-2 py-2.5 outline-none focus:border-[var(--color-primary)] transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5">Inicio</label>
              <input
                type="time"
                value={form.startTime}
                onChange={set("startTime")}
                className="w-full text-sm border border-[var(--color-border)] rounded-xl px-2 py-2.5 outline-none focus:border-[var(--color-primary)] transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5">Fin</label>
              <input
                type="time"
                value={form.endTime}
                onChange={set("endTime")}
                className="w-full text-sm border border-[var(--color-border)] rounded-xl px-2 py-2.5 outline-none focus:border-[var(--color-primary)] transition-colors"
              />
            </div>
          </div>

          {/* Color swatches */}
          <div>
            <label className="text-xs font-medium block mb-1.5">Color</label>
            <div className="flex gap-2 flex-wrap">
              {EVENT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, color: c }))}
                  className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    outline: form.color === c ? `3px solid ${c}` : "none",
                    outlineOffset: 2,
                  }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium block mb-1.5">
              Notas / Partes a grabar
            </label>
            <textarea
              value={form.description}
              onChange={set("description")}
              rows={2}
              placeholder="Ej: Primero el gancho, los 3 puntos clave, CTA al final"
              className="w-full text-sm border border-[var(--color-border)] rounded-xl px-3 py-2.5 outline-none focus:border-[var(--color-primary)] transition-colors resize-none"
            />
          </div>

          {/* Script link */}
          {scripts.length > 0 && (
            <div>
              <label className="text-xs font-medium block mb-1.5">
                Vincular guion (opcional)
              </label>
              <select
                value={form.script_id}
                onChange={set("script_id")}
                className="w-full text-sm border border-[var(--color-border)] rounded-xl px-3 py-2.5 outline-none focus:border-[var(--color-primary)] bg-white transition-colors"
              >
                <option value="">— Ninguno —</option>
                {scripts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Multiple reminders */}
          <div>
            <label className="text-xs font-medium flex items-center gap-1.5 mb-2">
              <Bell size={10} /> Avisos por email
              <span className="text-[var(--color-muted-foreground)] font-normal">
                ({userEmail})
              </span>
            </label>

            <div className="space-y-2">
              {form.reminders.map((mins, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={mins}
                    onChange={(e) => updateReminder(idx, Number(e.target.value))}
                    className="flex-1 text-sm border border-[var(--color-border)] rounded-xl px-3 py-2 outline-none bg-white focus:border-[var(--color-primary)] transition-colors"
                  >
                    {REMIND_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeReminder(idx)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors flex-shrink-0"
                    aria-label="Eliminar aviso"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}

              {form.reminders.length === 0 && (
                <p className="text-[11px] text-[var(--color-muted-foreground)]">
                  Sin avisos configurados
                </p>
              )}

              {form.reminders.length < 5 && (
                <button
                  type="button"
                  onClick={addReminder}
                  className="flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-70"
                  style={{ color: "var(--color-primary)" }}
                >
                  <Plus size={11} /> Añadir aviso
                </button>
              )}
            </div>
          </div>

          {err && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {err}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-border)]">
            {editing && (
              <button
                onClick={del}
                disabled={deleting}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors"
              >
                <Trash2 size={11} /> {deleting ? "..." : "Eliminar"}
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={onClose}
              className="text-sm px-4 py-2 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-muted)] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={saving || !form.title.trim()}
              className="text-sm px-4 py-2 rounded-xl text-white font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              {saving ? "Guardando..." : editing ? "Guardar" : "Crear"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
