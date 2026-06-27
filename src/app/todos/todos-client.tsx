"use client";

import { useState, useMemo, useRef } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, CalendarDays, Tag, LayoutGrid, List } from "lucide-react";

type Urgency = "baja" | "media" | "alta" | "muy_urgente";
type Importance = "muy_importante" | "importante" | "normal" | "poco_importante";
type Todo = {
  id: string; title: string; completed: boolean;
  urgency: Urgency; importance: Importance;
  due_date: string | null; category: string | null; created_at: string;
};

const URGENCY_VALS: Urgency[] = ["baja", "media", "alta", "muy_urgente"];
const IMPORTANCE_VALS: Importance[] = ["muy_importante", "importante", "normal", "poco_importante"];

const URGENCY_LABEL: Record<Urgency, string> = { baja: "Baja", media: "Media", alta: "Alta", muy_urgente: "Muy urgente" };
const IMPORTANCE_LABEL: Record<Importance, string> = { muy_importante: "Muy importante", importante: "Importante", normal: "Normal", poco_importante: "Poco importante" };

const URGENCY_COLOR: Record<Urgency, string> = { baja: "#22c55e", media: "#3b82f6", alta: "#f97316", muy_urgente: "#ef4444" };


function isOverdue(due: string | null) {
  return !!due && new Date(due + "T23:59:59") < new Date();
}
function fmtDate(due: string | null) {
  if (!due) return null;
  return new Date(due + "T12:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

const PRIMARY = "var(--color-primary)";

// ── TodoItem ──────────────────────────────────────────────────────────────────
function TodoItem({ todo, onToggle, onDelete, onUpdate }: {
  todo: Todo;
  onToggle: (id: string, v: boolean) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, p: Partial<Todo>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.title);
  const [phase, setPhase] = useState<"idle" | "striking" | "collapsing">("idle");
  const ref = useRef<HTMLInputElement>(null);

  function startEdit() { if (todo.completed) return; setEditing(true); setDraft(todo.title); setTimeout(() => ref.current?.select(), 0); }
  function cancelEdit() { setEditing(false); }
  function commitEdit() {
    if (!draft.trim() || draft.trim() === todo.title) { cancelEdit(); return; }
    onUpdate(todo.id, { title: draft.trim() }); setEditing(false);
  }
  function handleToggle() {
    if (todo.completed) { onToggle(todo.id, false); return; }
    setPhase("striking");
    setTimeout(() => setPhase("collapsing"), 320);
    setTimeout(() => onToggle(todo.id, true), 640);
  }

  return (
    <div
      style={{
        maxHeight: phase === "collapsing" ? 0 : 120,
        opacity: phase === "collapsing" ? 0 : todo.completed ? 0.5 : 1,
        overflow: "hidden",
        transition: phase === "collapsing" ? "max-height 0.35s ease, opacity 0.28s ease" : "none",
      }}
      className={`group flex items-start gap-3 px-4 py-3 rounded-xl ${phase === "idle" && !todo.completed ? "hover:bg-[var(--color-muted)]/50" : ""}`}>
      {/* Checkbox */}
      <button onClick={handleToggle}
        className="mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors"
        style={{
          borderColor: URGENCY_COLOR[todo.urgency],
          backgroundColor: todo.completed ? URGENCY_COLOR[todo.urgency] : "transparent",
        }}>
        {todo.completed && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input ref={ref} value={draft} onChange={e => setDraft(e.target.value)}
            onBlur={commitEdit} onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
            className="w-full text-sm outline-none bg-transparent border-b border-[var(--color-primary)] pb-0.5" />
        ) : (
          <div className="relative inline-block w-full">
            <p onClick={startEdit}
              className={`text-sm cursor-text leading-snug ${todo.completed ? "line-through text-[var(--color-muted-foreground)]" : ""}`}>
              {todo.title}
            </p>
            <span style={{
              position: "absolute",
              top: "50%",
              left: 0,
              height: "1.5px",
              backgroundColor: URGENCY_COLOR[todo.urgency],
              width: (phase === "striking" || phase === "collapsing") ? "100%" : "0%",
              transition: "width 0.28s ease",
              borderRadius: "1px",
              pointerEvents: "none",
            }} />
          </div>
        )}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {todo.due_date && (
            <span className={`text-[10px] flex items-center gap-0.5 ${isOverdue(todo.due_date) && !todo.completed ? "text-red-500 font-medium" : "text-[var(--color-muted-foreground)]"}`}>
              <CalendarDays size={9} /> {fmtDate(todo.due_date)}{isOverdue(todo.due_date) && !todo.completed ? " · Vencida" : ""}
            </span>
          )}
          {todo.category && (
            <span className="text-[10px] flex items-center gap-0.5 text-[var(--color-muted-foreground)]">
              <Tag size={9} /> {todo.category}
            </span>
          )}
        </div>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
          style={{ backgroundColor: URGENCY_COLOR[todo.urgency] }}>
          {URGENCY_LABEL[todo.urgency]}
        </span>
        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full border border-[var(--color-border)] text-[var(--color-muted-foreground)]">
          {IMPORTANCE_LABEL[todo.importance].split(" ")[0]}
        </span>
        <button onClick={() => onDelete(todo.id)}
          className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--color-muted-foreground)] hover:text-red-500 transition-all">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ── AddTodoForm ───────────────────────────────────────────────────────────────
function AddTodoForm({ onAdd }: { onAdd: (t: Partial<Todo>) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("media");
  const [importance, setImportance] = useState<Importance>("normal");
  const [due_date, setDueDate] = useState("");
  const [category, setCategory] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd({ title: title.trim(), urgency, importance, due_date: due_date || null, category: category.trim() || null });
    setTitle(""); setUrgency("media"); setImportance("normal"); setDueDate(""); setCategory(""); setOpen(false);
  }

  return (
    <div className="bg-white rounded-2xl border border-[var(--color-border)] shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden mb-5">
      {!open ? (
        <button onClick={() => setOpen(true)}
          className="w-full flex items-center gap-2 px-4 py-3.5 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors">
          <Plus size={15} style={{ color: PRIMARY }} /> Añadir tarea...
        </button>
      ) : (
        <form onSubmit={submit} className="p-4 space-y-3">
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
            placeholder="¿Qué necesitas hacer?"
            className="w-full text-sm font-medium outline-none placeholder:text-[var(--color-muted-foreground)] border-b border-[var(--color-border)] pb-2" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-[var(--color-muted-foreground)] block mb-1">Urgencia</label>
              <select value={urgency} onChange={e => setUrgency(e.target.value as Urgency)}
                className="w-full text-xs border border-[var(--color-border)] rounded-lg px-2 py-1.5 outline-none focus:border-[var(--color-primary)] bg-white">
                <option value="baja">🟢 Baja</option>
                <option value="media">🔵 Media</option>
                <option value="alta">🟠 Alta</option>
                <option value="muy_urgente">🔴 Muy urgente</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[var(--color-muted-foreground)] block mb-1">Importancia</label>
              <select value={importance} onChange={e => setImportance(e.target.value as Importance)}
                className="w-full text-xs border border-[var(--color-border)] rounded-lg px-2 py-1.5 outline-none focus:border-[var(--color-primary)] bg-white">
                <option value="muy_importante">⭐ Muy importante</option>
                <option value="importante">✦ Importante</option>
                <option value="normal">· Normal</option>
                <option value="poco_importante">↓ Poco importante</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={due_date} onChange={e => setDueDate(e.target.value)}
              className="text-xs border border-[var(--color-border)] rounded-lg px-2 py-1.5 outline-none focus:border-[var(--color-primary)]" />
            <input value={category} onChange={e => setCategory(e.target.value)}
              placeholder="Categoría"
              className="flex-1 text-xs border border-[var(--color-border)] rounded-lg px-2 py-1.5 outline-none focus:border-[var(--color-primary)]" />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setOpen(false)}
              className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-muted)] transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={!title.trim()}
              className="text-xs px-4 py-1.5 rounded-lg text-white font-semibold disabled:opacity-40 transition-opacity hover:opacity-80"
              style={{ backgroundColor: PRIMARY }}>
              Añadir
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── MatrixView ────────────────────────────────────────────────────────────────
const DOT_OFFSETS = [
  { dx: 0, dy: 0 }, { dx: 14, dy: 0 }, { dx: -14, dy: 0 },
  { dx: 0, dy: -13 }, { dx: 0, dy: 13 }, { dx: 10, dy: -10 },
  { dx: -10, dy: -10 }, { dx: 10, dy: 10 }, { dx: -10, dy: 10 },
];

const IMP_SHORT: Record<Importance, string> = {
  muy_importante: "Muy imp.", importante: "Importante",
  normal: "Normal", poco_importante: "Poco imp.",
};
const URG_SHORT: Record<Urgency, string> = {
  baja: "Baja", media: "Media", alta: "Alta", muy_urgente: "Muy urg.",
};

const PLOT_H = 320;

function MatrixView({ todos, onToggle }: { todos: Todo[]; onToggle: (id: string, v: boolean) => void }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const pending = todos.filter(t => !t.completed);

  // X: baja=left → muy_urgente=right (12%–88%)
  const xPct = (u: Urgency) => (URGENCY_VALS.indexOf(u) / 3) * 76 + 12;
  // Y (CSS top%): muy_importante=top(12%) → poco_importante=bottom(88%)
  // So visually: more important = higher up = correct single-quadrant direction
  const yPct = (i: Importance) => (IMPORTANCE_VALS.indexOf(i) / 3) * 76 + 12;

  const grouped = new Map<string, Todo[]>();
  for (const t of pending) {
    const k = `${t.urgency}-${t.importance}`;
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(t);
  }

  return (
    <div className="space-y-2">
      {/* Y axis title */}
      <div className="text-[10px] font-semibold text-[var(--color-muted-foreground)] tracking-wider uppercase" style={{ paddingLeft: 72 }}>
        ↑ Importancia
      </div>

      <div className="flex gap-0">
        {/* Y tick labels */}
        <div style={{ width: 72, flexShrink: 0, position: "relative", height: PLOT_H }}>
          {IMPORTANCE_VALS.map(imp => (
            <div key={imp} style={{
              position: "absolute",
              top: `${yPct(imp)}%`,
              right: 10,
              transform: "translateY(-50%)",
              fontSize: 9,
              color: "var(--color-muted-foreground)",
              textAlign: "right",
              whiteSpace: "nowrap",
            }}>
              {IMP_SHORT[imp]}
            </div>
          ))}
        </div>

        {/* Plot column */}
        <div className="flex-1 flex flex-col">
          {/* Plot area */}
          <div className="relative" style={{
            height: PLOT_H,
            borderLeft: "2px solid var(--color-border)",
            borderBottom: "2px solid var(--color-border)",
            backgroundColor: "#f8f7f4",
            overflow: "visible",
          }}>
            {/* Horizontal gridlines at each importance level */}
            {IMPORTANCE_VALS.map(imp => (
              <div key={imp} style={{
                position: "absolute",
                top: `${yPct(imp)}%`,
                left: 0, right: 0, height: 1,
                backgroundColor: "var(--color-border)",
                opacity: 0.45,
              }} />
            ))}
            {/* Vertical gridlines at each urgency level */}
            {URGENCY_VALS.map(u => (
              <div key={u} style={{
                position: "absolute",
                left: `${xPct(u)}%`,
                top: 0, bottom: 0, width: 1,
                backgroundColor: "var(--color-border)",
                opacity: 0.45,
              }} />
            ))}

            {/* Dots */}
            {[...grouped.values()].flatMap(tasks =>
              tasks.map((t, idx) => {
                const off = DOT_OFFSETS[idx] ?? { dx: ((idx % 3) - 1) * 14, dy: (Math.floor(idx / 3) - 1) * 13 };
                const x = xPct(t.urgency);
                const y = yPct(t.importance);
                const isHov = hovered === t.id;
                const below = y < 28;
                const farRight = x > 70;

                return (
                  <div key={t.id}
                    onMouseEnter={() => setHovered(t.id)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => onToggle(t.id, true)}
                    style={{
                      position: "absolute",
                      left: `${x}%`,
                      top: `${y}%`,
                      transform: `translate(calc(-50% + ${off.dx}px), calc(-50% + ${off.dy}px))`,
                      zIndex: isHov ? 50 : 10,
                      cursor: "pointer",
                    }}>
                    <div style={{
                      width: isHov ? 16 : 11,
                      height: isHov ? 16 : 11,
                      borderRadius: "50%",
                      backgroundColor: URGENCY_COLOR[t.urgency],
                      border: "2.5px solid white",
                      boxShadow: isHov
                        ? `0 0 0 3px ${URGENCY_COLOR[t.urgency]}35, 0 2px 10px rgba(0,0,0,0.2)`
                        : "0 1px 3px rgba(0,0,0,0.15)",
                      transition: "width 0.12s ease, height 0.12s ease, box-shadow 0.12s ease",
                    }} />

                    {isHov && (
                      <div style={{
                        position: "absolute",
                        ...(below ? { top: "calc(100% + 10px)" } : { bottom: "calc(100% + 10px)" }),
                        ...(farRight ? { right: 0 } : { left: "50%", transform: "translateX(-50%)" }),
                        backgroundColor: "white",
                        border: "1px solid var(--color-border)",
                        borderRadius: 12,
                        padding: "10px 14px",
                        minWidth: 170,
                        maxWidth: 240,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)",
                        pointerEvents: "none",
                        whiteSpace: "nowrap",
                      }}>
                        <p className="text-xs font-semibold leading-tight" style={{ color: "var(--color-foreground)", whiteSpace: "normal" }}>
                          {t.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: URGENCY_COLOR[t.urgency] }}>
                            {URGENCY_LABEL[t.urgency]}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full border border-[var(--color-border)] text-[var(--color-muted-foreground)]">
                            {IMPORTANCE_LABEL[t.importance]}
                          </span>
                        </div>
                        {t.due_date && (
                          <p className={`text-[9px] mt-1.5 flex items-center gap-1 ${isOverdue(t.due_date) ? "text-red-500 font-medium" : "text-[var(--color-muted-foreground)]"}`}>
                            <CalendarDays size={9} />
                            {fmtDate(t.due_date)}{isOverdue(t.due_date) ? " · Vencida" : ""}
                          </p>
                        )}
                        {t.category && (
                          <p className="text-[9px] text-[var(--color-muted-foreground)] mt-1 flex items-center gap-1">
                            <Tag size={9} /> {t.category}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {pending.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-sm text-[var(--color-muted-foreground)]">Sin tareas pendientes</p>
              </div>
            )}
          </div>

          {/* X tick labels */}
          <div className="relative" style={{ height: 20, marginTop: 6 }}>
            {URGENCY_VALS.map(u => (
              <div key={u} style={{
                position: "absolute",
                left: `${xPct(u)}%`,
                transform: "translateX(-50%)",
                fontSize: 9,
                color: "var(--color-muted-foreground)",
                whiteSpace: "nowrap",
              }}>
                {URG_SHORT[u]}
              </div>
            ))}
          </div>

          {/* X axis title */}
          <div className="text-center text-[10px] font-semibold tracking-wider uppercase text-[var(--color-muted-foreground)]" style={{ marginTop: 4 }}>
            Urgencia →
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 justify-center flex-wrap mt-1">
        {URGENCY_VALS.map(u => (
          <div key={u} className="flex items-center gap-1.5">
            <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: URGENCY_COLOR[u], flexShrink: 0 }} />
            <span className="text-[10px] text-[var(--color-muted-foreground)]">{URGENCY_LABEL[u]}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-center text-[var(--color-muted-foreground)]">
        Pasa el cursor sobre un punto para ver los detalles · Haz clic para completar
      </p>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function TodosClient({ initialTodos }: { initialTodos: Todo[] }) {
  const [todos, setTodos] = useState<Todo[]>(initialTodos);
  const [view, setView] = useState<"list" | "matrix">("list");
  const [filter, setFilter] = useState<"pending" | "all" | "completed">("pending");
  const [urgencyFilter, setUrgencyFilter] = useState<Urgency | "all">("all");
  const [showCompleted, setShowCompleted] = useState(false);

  const pending = useMemo(() =>
    todos.filter(t => !t.completed && (urgencyFilter === "all" || t.urgency === urgencyFilter))
      .sort((a, b) => URGENCY_VALS.indexOf(b.urgency) - URGENCY_VALS.indexOf(a.urgency) ||
        IMPORTANCE_VALS.indexOf(a.importance) - IMPORTANCE_VALS.indexOf(b.importance)),
    [todos, urgencyFilter]);

  const completed = useMemo(() =>
    todos.filter(t => t.completed && (urgencyFilter === "all" || t.urgency === urgencyFilter))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [todos, urgencyFilter]);

  const overdueCount = pending.filter(t => isOverdue(t.due_date)).length;

  async function handleAdd(data: Partial<Todo>) {
    const res = await fetch("/api/todos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const todo = await res.json();
    if (todo.id) {
      setTodos(prev => [todo, ...prev]);
    } else {
      alert("Error al añadir tarea: " + (todo.error ?? "respuesta inesperada"));
    }
  }

  async function handleToggle(id: string, v: boolean) {
    const res = await fetch(`/api/todos/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completed: v }) });
    const updated = await res.json();
    if (updated.id) setTodos(prev => prev.map(t => t.id === id ? updated : t));
  }

  async function handleDelete(id: string) {
    await fetch(`/api/todos/${id}`, { method: "DELETE" });
    setTodos(prev => prev.filter(t => t.id !== id));
  }

  async function handleUpdate(id: string, patch: Partial<Todo>) {
    const res = await fetch(`/api/todos/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const updated = await res.json();
    if (updated.id) setTodos(prev => prev.map(t => t.id === id ? updated : t));
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: "var(--font-serif)" }}>Mis Tareas</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {pending.length} pendiente{pending.length !== 1 ? "s" : ""}
            {overdueCount > 0 && <span className="text-red-500 font-medium"> · {overdueCount} vencida{overdueCount !== 1 ? "s" : ""}</span>}
          </p>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-[var(--color-muted)] rounded-xl p-1">
          <button onClick={() => setView("list")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{
              backgroundColor: view === "list" ? "white" : "transparent",
              color: view === "list" ? "var(--color-foreground)" : "var(--color-muted-foreground)",
              boxShadow: view === "list" ? "0 1px 3px rgba(0,0,0,0.10)" : "none",
            }}>
            <List size={13} /> Lista
          </button>
          <button onClick={() => setView("matrix")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{
              backgroundColor: view === "matrix" ? "white" : "transparent",
              color: view === "matrix" ? PRIMARY : "var(--color-muted-foreground)",
              boxShadow: view === "matrix" ? "0 1px 3px rgba(0,0,0,0.10)" : "none",
            }}>
            <LayoutGrid size={13} /> Matriz
          </button>
        </div>
      </div>

      {/* Add form (only in list view) */}
      {view === "list" && <AddTodoForm onAdd={handleAdd} />}

      {view === "matrix" ? (
        <MatrixView todos={todos} onToggle={handleToggle} />
      ) : (
        <>
          {/* Filters */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="flex items-center gap-0.5 bg-[var(--color-muted)] rounded-lg p-0.5">
              {(["pending", "all", "completed"] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
                  style={{
                    backgroundColor: filter === f ? "white" : "transparent",
                    color: filter === f ? "var(--color-foreground)" : "var(--color-muted-foreground)",
                    boxShadow: filter === f ? "0 1px 3px rgba(0,0,0,0.10)" : "none",
                  }}>
                  {f === "pending" ? "Pendientes" : f === "completed" ? "Completadas" : "Todas"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              {(["all", ...URGENCY_VALS] as const).map(u => (
                <button key={u} onClick={() => setUrgencyFilter(u)}
                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-all"
                  style={{
                    borderColor: urgencyFilter === u ? (u === "all" ? PRIMARY : URGENCY_COLOR[u as Urgency]) : "var(--color-border)",
                    color: urgencyFilter === u ? (u === "all" ? PRIMARY : URGENCY_COLOR[u as Urgency]) : "var(--color-muted-foreground)",
                    backgroundColor: urgencyFilter === u ? (u === "all" ? "rgba(124,58,237,0.07)" : `${URGENCY_COLOR[u as Urgency]}15`) : "transparent",
                  }}>
                  {u === "all" ? "Todas" : URGENCY_LABEL[u as Urgency]}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="bg-white rounded-2xl border border-[var(--color-border)] shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden">
            {filter !== "completed" && pending.length === 0 && completed.length === 0 && (
              <p className="text-sm text-center text-[var(--color-muted-foreground)] py-16">Sin tareas. ¡Todo al día!</p>
            )}

            {filter !== "completed" && pending.map(t => (
              <TodoItem key={t.id} todo={t} onToggle={handleToggle} onDelete={handleDelete} onUpdate={handleUpdate} />
            ))}

            {filter === "all" && completed.length > 0 && (
              <div className="border-t border-[rgba(0,0,0,0.05)]">
                <button onClick={() => setShowCompleted(v => !v)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-muted-foreground)] px-4 py-3 hover:text-[var(--color-foreground)] transition-colors w-full">
                  {showCompleted ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  Completadas ({completed.length})
                </button>
                {showCompleted && completed.map(t => (
                  <TodoItem key={t.id} todo={t} onToggle={handleToggle} onDelete={handleDelete} onUpdate={handleUpdate} />
                ))}
              </div>
            )}

            {filter === "completed" && (
              completed.length === 0
                ? <p className="text-sm text-center text-[var(--color-muted-foreground)] py-16">Ninguna tarea completada aún.</p>
                : completed.map(t => (
                  <TodoItem key={t.id} todo={t} onToggle={handleToggle} onDelete={handleDelete} onUpdate={handleUpdate} />
                ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
