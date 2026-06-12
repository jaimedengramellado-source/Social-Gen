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
const QUADRANTS = [
  { label: "Hazlo ya",    sub: "Urgente · Importante",        bg: "#FEE2E2", border: "#FCA5A5", color: "#dc2626", textBg: "#dc262615", isUrgent: true,  isImportant: true  },
  { label: "Planifícalo", sub: "No urgente · Importante",     bg: "#DBEAFE", border: "#93C5FD", color: "#2563eb", textBg: "#2563eb15", isUrgent: false, isImportant: true  },
  { label: "Delégalo",    sub: "Urgente · Poco importante",   bg: "#FEF3C7", border: "#FCD34D", color: "#d97706", textBg: "#d9770615", isUrgent: true,  isImportant: false },
  { label: "Elimínalo",   sub: "No urgente · Poco importante",bg: "#F3F4F6", border: "#D1D5DB", color: "#6b7280", textBg: "#6b728015", isUrgent: false, isImportant: false },
];

function MatrixView({ todos, onToggle }: { todos: Todo[]; onToggle: (id: string, v: boolean) => void }) {
  const pending = todos.filter(t => !t.completed);
  const isUrgent = (t: Todo) => t.urgency === "alta" || t.urgency === "muy_urgente";
  const isImportant = (t: Todo) => t.importance === "muy_importante" || t.importance === "importante";

  return (
    <div className="space-y-3">
      {/* Axis labels */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-bold text-[var(--color-muted-foreground)] tracking-widest uppercase">↑ Importancia</span>
        <span className="text-[11px] font-bold text-[var(--color-muted-foreground)] tracking-widest uppercase">Urgencia →</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {QUADRANTS.map(q => {
          const tasks = pending.filter(t => isUrgent(t) === q.isUrgent && isImportant(t) === q.isImportant);
          return (
            <div key={q.label} className="rounded-2xl p-4 min-h-[160px] flex flex-col"
              style={{ backgroundColor: q.bg, border: `2px solid ${q.border}` }}>
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-black" style={{ color: q.color }}>{q.label}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: q.color + "99" }}>{q.sub}</p>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: q.color + "20", color: q.color }}>
                  {tasks.length}
                </span>
              </div>

              {/* Tasks */}
              <div className="flex-1 space-y-1.5">
                {tasks.length === 0 ? (
                  <p className="text-xs text-center py-6" style={{ color: q.color + "60" }}>Sin tareas</p>
                ) : tasks.map(t => (
                  <button key={t.id} onClick={() => onToggle(t.id, true)}
                    className="w-full text-left text-xs px-3 py-2 rounded-xl flex items-center gap-2 group transition-colors bg-white/70 hover:bg-white border border-white/40">
                    <span className="w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 transition-colors group-hover:bg-white/80"
                      style={{ borderColor: q.color }} />
                    <span className="truncate flex-1 font-medium" style={{ color: "#1a1a2e" }}>{t.title}</span>
                    <span className="text-[9px] flex-shrink-0 font-semibold" style={{ color: q.color + "99" }}>
                      {URGENCY_LABEL[t.urgency]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-center text-[var(--color-muted-foreground)]">
        Haz clic en una tarea para marcarla como completada
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
