"use client";

import { useEffect, useState } from "react";
import { timeAgo } from "@/lib/utils";
import type { Profile } from "@/types";

export interface ChatSession {
  id: string;
  title: string;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatProject {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatSidebarProps {
  sessions: ChatSession[];
  projects: ChatProject[];
  activeId: string | null;
  pendingEditProjectId: string | null;
  profile: Profile;
  onSelect: (id: string) => void;
  onNew: () => void;
  onNewInProject: (projectId: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onCreateProject: () => void;
  onDeleteProject: (id: string) => void;
  onRenameProject: (id: string, title: string) => void;
  onPendingEditHandled: () => void;
}

type DateGroup = { label: string; items: ChatSession[] };
type ChatType = "guion" | "idea" | "hook" | "imagen" | "chat";
type FilterId = "todos" | "guiones" | "ideas" | "hooks";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "guiones", label: "Guiones" },
  { id: "ideas", label: "Ideas" },
  { id: "hooks", label: "Hooks" },
];

function detectChatType(title: string): ChatType {
  const t = title.toLowerCase();
  if (/guion|script|texto|escrib|redact/.test(t)) return "guion";
  if (/idea|viral|trend|contenido/.test(t)) return "idea";
  if (/hook|anclaje|anzuelo|captaci/.test(t)) return "hook";
  if (/imagen|miniatura|thumbnail|foto/.test(t)) return "imagen";
  return "chat";
}

function chatTypeIcon(type: ChatType): { icon: string; bg: string; color: string } {
  switch (type) {
    case "guion":  return { icon: "ti-file-text", bg: "var(--surface-2)", color: "var(--text-secondary)" };
    case "idea":   return { icon: "ti-sparkles",  bg: "var(--bg-pro)",    color: "var(--text-pro)" };
    case "hook":   return { icon: "ti-anchor",    bg: "var(--bg-pro)",    color: "var(--text-pro)" };
    case "imagen": return { icon: "ti-photo",     bg: "var(--bg-success)", color: "var(--text-success)" };
    default:       return { icon: "ti-message",   bg: "var(--surface-2)", color: "var(--text-secondary)" };
  }
}

function isNew(createdAt: string) {
  return Date.now() - new Date(createdAt).getTime() < 2 * 60 * 60 * 1000;
}

function planLabel(plan: string) {
  return ({ free: "Plan Gratuito", starter: "Plan Starter", pro: "Plan Pro", agency: "Plan Agency" })[plan] ?? plan;
}

function groupByDate(sessions: ChatSession[]): DateGroup[] {
  const now = Date.now();
  const startOfToday = new Date(new Date().toDateString()).getTime();
  const day = 86400000;
  const buckets: Record<string, ChatSession[]> = {
    "Hoy": [], "Ayer": [], "Esta semana": [], "Antes": [],
  };
  const sorted = [...sessions].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  for (const s of sorted) {
    const t = new Date(s.updated_at).getTime();
    if (t >= startOfToday)           buckets["Hoy"].push(s);
    else if (t >= startOfToday - day) buckets["Ayer"].push(s);
    else if (now - t <= 7 * day)     buckets["Esta semana"].push(s);
    else                             buckets["Antes"].push(s);
  }
  return (Object.entries(buckets) as [string, ChatSession[]][])
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

export function ChatSidebar({
  sessions, projects, activeId, pendingEditProjectId, profile,
  onSelect, onNew, onNewInProject,
  onDelete, onRename,
  onCreateProject, onDeleteProject, onRenameProject,
  onPendingEditHandled,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery]           = useState("");
  const [searchActive, setSearchActive]         = useState(false);
  const [activeFilter, setActiveFilter]         = useState<FilterId>("todos");
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionValue, setEditingSessionValue] = useState("");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectValue, setEditingProjectValue] = useState("");
  const [openMenuId, setOpenMenuId]             = useState<string | null>(null);
  const [confirmDeleteProjectId, setConfirmDeleteProjectId] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!activeId) return;
    const s = sessions.find(s => s.id === activeId);
    if (s?.project_id) setExpandedProjects(prev => {
      if (prev.has(s.project_id!)) return prev;
      const next = new Set(prev); next.add(s.project_id!); return next;
    });
  }, [activeId, sessions]);

  useEffect(() => {
    if (!pendingEditProjectId) return;
    const p = projects.find(p => p.id === pendingEditProjectId);
    if (!p) return;
    setEditingProjectId(pendingEditProjectId);
    setEditingProjectValue(p.title);
    setExpandedProjects(prev => { const next = new Set(prev); next.add(pendingEditProjectId); return next; });
    onPendingEditHandled();
  }, [pendingEditProjectId, projects, onPendingEditHandled]);

  useEffect(() => {
    if (!openMenuId) {
      setConfirmDeleteProjectId(null);
      return;
    }
    function close(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest("[data-menu-root]")) setOpenMenuId(null);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [openMenuId]);

  function toggleProject(id: string) {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function commitSessionRename(id: string, old: string) {
    const v = editingSessionValue.trim();
    if (v && v !== old) onRename(id, v);
    setEditingSessionId(null);
  }

  function commitProjectRename(id: string, old: string) {
    const v = editingProjectValue.trim();
    if (v && v !== old) onRenameProject(id, v);
    setEditingProjectId(null);
  }

  // Filter + search applied to ungrouped sessions
  const ungrouped = sessions
    .filter(s => !s.project_id)
    .filter(s => !searchQuery || s.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(s => {
      if (activeFilter === "todos") return true;
      const type = detectChatType(s.title);
      return (
        (activeFilter === "guiones" && type === "guion") ||
        (activeFilter === "ideas"   && type === "idea")  ||
        (activeFilter === "hooks"   && type === "hook")
      );
    });

  const groups = groupByDate(ungrouped);
  const userInitial = (profile.full_name || profile.email || "U")[0].toUpperCase();

  function renderSessionItem(s: ChatSession, inProject = false) {
    const isEditing = editingSessionId === s.id;
    const menuOpen  = openMenuId === `s-${s.id}`;
    const type      = detectChatType(s.title);
    const { icon, bg, color } = chatTypeIcon(type);
    const active    = activeId === s.id;
    const fresh     = isNew(s.created_at);

    return (
      <div key={s.id} className="relative mb-0.5" data-menu-root>
        <div
          role="button"
          tabIndex={0}
          onClick={() => !isEditing && onSelect(s.id)}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!isEditing) onSelect(s.id); } }}
          className={`sidebar-item group${active ? " active" : ""}`}
        >
          {/* Type icon */}
          <span style={{ width: 26, height: 26, borderRadius: 6, backgroundColor: bg, color, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <i className={`ti ${icon}`} style={{ fontSize: 13 }} />
          </span>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {isEditing ? (
              <input
                autoFocus
                value={editingSessionValue}
                onChange={e => setEditingSessionValue(e.target.value)}
                onClick={e => e.stopPropagation()}
                onBlur={() => commitSessionRename(s.id, s.title)}
                onKeyDown={e => {
                  e.stopPropagation();
                  if (e.key === "Enter") { e.preventDefault(); commitSessionRename(s.id, s.title); }
                  if (e.key === "Escape") setEditingSessionId(null);
                }}
                style={{ width: "100%", fontSize: 13, background: "transparent", border: "none", borderBottom: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
              />
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <p style={{ fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, margin: 0 }}>
                  {s.title}
                </p>
                {fresh && (
                  <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 20, background: "var(--bg-info)", color: "var(--text-info)", flexShrink: 0 }}>
                    Nuevo
                  </span>
                )}
              </div>
            )}
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1, margin: 0 }}>
              {timeAgo(s.updated_at)}
            </p>
          </div>

          {/* Three-dot menu */}
          {!isEditing && (
            <button
              onClick={e => { e.stopPropagation(); setOpenMenuId(menuOpen ? null : `s-${s.id}`); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, borderRadius: 4, transition: "opacity 0.15s", flexShrink: 0 }}
              className="opacity-0 group-hover:opacity-100"
              aria-label="Opciones"
            >
              <i className="ti ti-dots" style={{ fontSize: 14 }} />
            </button>
          )}
        </div>

        {menuOpen && (
          <div style={{ position: "absolute", right: 8, top: "100%", background: "var(--surface-1)", border: "0.5px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "0 4px 16px rgba(0,0,0,0.12)", padding: "4px 0", zIndex: 30, minWidth: 130 }}>
            <button
              onClick={e => { e.stopPropagation(); setEditingSessionId(s.id); setEditingSessionValue(s.title); setOpenMenuId(null); }}
              style={{ width: "100%", textAlign: "left", padding: "6px 12px", fontSize: 12, color: "var(--text-primary)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
              <i className="ti ti-pencil" style={{ fontSize: 13 }} /> Renombrar
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(s.id); setOpenMenuId(null); }}
              style={{ width: "100%", textAlign: "left", padding: "6px 12px", fontSize: 12, color: "#DC2626", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
              <i className="ti ti-trash" style={{ fontSize: 13 }} /> Eliminar
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <aside style={{ width: 280, background: "var(--color-card)", border: "0.5px solid var(--border)", borderRadius: 12, boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>

      {/* ── HEADER ── */}
      <div style={{ padding: 14, borderBottom: "0.5px solid var(--border)", flexShrink: 0 }}>

        {/* Row: search + new button */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: searchActive ? 10 : 0 }}>
          {searchActive ? (
            <div className="transition-colors focus-within:border-[var(--color-muted-foreground)]" style={{ background: "var(--surface-2)", border: "0.5px solid var(--border)", borderRadius: "var(--radius)", padding: "7px 10px", display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 0 }}>
              <i className="ti ti-search" style={{ fontSize: 14, color: "var(--text-muted)", flexShrink: 0 }} />
              <input
                autoFocus
                placeholder="Buscar chats..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === "Escape") { setSearchActive(false); setSearchQuery(""); } }}
                style={{ border: "none", background: "transparent", outline: "none", fontSize: 13, color: "var(--text-primary)", flex: 1, minWidth: 0 }}
              />
              <button
                onClick={() => { setSearchActive(false); setSearchQuery(""); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 2, borderRadius: 4, display: "inline-flex", alignItems: "center", flexShrink: 0 }}
                aria-label="Cerrar búsqueda"
              >
                <i className="ti ti-x" style={{ fontSize: 13 }} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSearchActive(true)}
              style={{ width: 32, height: 32, background: "var(--surface-2)", border: "0.5px solid var(--border)", borderRadius: "var(--radius)", cursor: "pointer", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              aria-label="Buscar chats"
            >
              <i className="ti ti-search" style={{ fontSize: 14 }} />
            </button>
          )}
          <button
            onClick={onNew}
            style={{ background: "var(--bg-accent)", color: "var(--text-accent)", borderRadius: "var(--radius)", padding: "5px 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5, border: "none", cursor: "pointer", fontWeight: 500, flexShrink: 0, marginLeft: searchActive ? 0 : "auto", boxShadow: "0 1px 3px rgba(0,0,0,0.12)" }}
          >
            <i className="ti ti-plus" style={{ fontSize: 13 }} />
            Nuevo
          </button>
        </div>

        {/* Filter pills */}
        {searchActive && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`sidebar-filter-pill${activeFilter === f.id ? " active" : ""}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── BODY ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 8px", scrollbarWidth: "none" }}>

        {/* Projects */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p className="sidebar-section-label">Proyectos</p>
            <button
              onClick={onCreateProject}
              title="Nuevo proyecto"
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px 4px", borderRadius: 4, display: "inline-flex", alignItems: "center" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLElement).style.background = "none"; }}
            >
              <i className="ti ti-plus" style={{ fontSize: 13 }} />
            </button>
          </div>
            {projects.map(project => {
              const isExpanded    = expandedProjects.has(project.id);
              const isEditingProj = editingProjectId === project.id;
              const isConfirming  = confirmDeleteProjectId === project.id;
              const projectSessions = sessions
                .filter(s => s.project_id === project.id)
                .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

              return (
                <div key={project.id} className="mb-0.5">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => !isEditingProj && toggleProject(project.id)}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!isEditingProj) toggleProject(project.id); } }}
                    className="sidebar-item group"
                  >
                    {/* Folder icon */}
                    <span style={{ width: 26, height: 26, borderRadius: 6, background: "var(--bg-pro)", color: "var(--text-pro)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <i className="ti ti-folder" style={{ fontSize: 13 }} />
                    </span>

                    {/* Title */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {isEditingProj ? (
                        <input
                          autoFocus
                          value={editingProjectValue}
                          onChange={e => setEditingProjectValue(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          onBlur={() => commitProjectRename(project.id, project.title)}
                          onKeyDown={e => {
                            e.stopPropagation();
                            if (e.key === "Enter") { e.preventDefault(); commitProjectRename(project.id, project.title); }
                            if (e.key === "Escape") setEditingProjectId(null);
                          }}
                          style={{ width: "100%", fontSize: 13, fontWeight: 500, background: "transparent", border: "none", borderBottom: "1px solid var(--border)", color: "var(--text-primary)", outline: "none" }}
                        />
                      ) : (
                        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
                          {project.title}
                        </p>
                      )}
                    </div>

                    {/* Actions + chevron */}
                    <div style={{ display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
                      {!isEditingProj && (
                        <>
                          <button
                            onClick={e => { e.stopPropagation(); if (!isExpanded) toggleProject(project.id); setEditingProjectId(project.id); setEditingProjectValue(project.title); }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 3, borderRadius: 4, display: "inline-flex", alignItems: "center", transition: "opacity 0.15s" }}
                            className="opacity-0 group-hover:opacity-100"
                            aria-label="Renombrar proyecto"
                          >
                            <i className="ti ti-pencil" style={{ fontSize: 12 }} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setConfirmDeleteProjectId(isConfirming ? null : project.id); }}
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 3, borderRadius: 4, display: "inline-flex", alignItems: "center", transition: "opacity 0.15s, color 0.15s", color: isConfirming ? "#DC2626" : "var(--text-muted)" }}
                            className={isConfirming ? "opacity-100" : "opacity-0 group-hover:opacity-100"}
                            aria-label="Eliminar proyecto"
                          >
                            <i className="ti ti-trash" style={{ fontSize: 12 }} />
                          </button>
                        </>
                      )}
                      <i
                        className="ti ti-chevron-right"
                        style={{ fontSize: 13, color: "var(--text-muted)", transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}
                      />
                    </div>
                  </div>

                  {/* Inline delete confirmation */}
                  {isConfirming && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px 5px 10px", borderRadius: "var(--radius)", background: "var(--destructive-muted)", margin: "1px 0 2px", border: "0.5px solid var(--destructive-muted-border)" }}>
                      <p style={{ fontSize: 12, color: "var(--color-destructive)", flex: 1, margin: 0 }}>
                        Los chats se moverán al inicio.
                      </p>
                      <button
                        onClick={e => { e.stopPropagation(); onDeleteProject(project.id); setConfirmDeleteProjectId(null); }}
                        style={{ fontSize: 11, color: "#fff", background: "var(--color-destructive)", border: "none", borderRadius: 4, padding: "3px 8px", cursor: "pointer", fontWeight: 500, flexShrink: 0 }}
                      >
                        Eliminar
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDeleteProjectId(null); }}
                        style={{ background: "none", border: "none", padding: "3px 4px", cursor: "pointer", color: "var(--color-destructive)", opacity: 0.6, flexShrink: 0, display: "inline-flex", alignItems: "center" }}
                        aria-label="Cancelar"
                      >
                        <i className="ti ti-x" style={{ fontSize: 12 }} />
                      </button>
                    </div>
                  )}

                  {/* Expanded sessions */}
                  {isExpanded && (
                    <div style={{ marginLeft: 12, borderLeft: "1px solid var(--border)", paddingLeft: 4, marginTop: 2, marginBottom: 4 }}>
                      {projectSessions.length === 0 ? (
                        <p style={{ padding: "6px 8px", fontSize: 11, color: "var(--text-muted)" }}>Sin conversaciones</p>
                      ) : (
                        projectSessions.map(s => renderSessionItem(s, true))
                      )}
                      <button
                        onClick={() => onNewInProject(project.id)}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", width: "100%", borderRadius: "var(--radius)" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "none")}
                      >
                        <i className="ti ti-plus" style={{ fontSize: 11 }} /> Nuevo chat
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {/* Date groups */}
        {groups.map(group => (
          <div key={group.label}>
            <p className="sidebar-section-label">{group.label}</p>
            {group.items.map(s => renderSessionItem(s))}
          </div>
        ))}

        {ungrouped.length === 0 && projects.length === 0 && (
          <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", marginTop: 32 }}>
            Sin conversaciones
          </p>
        )}
      </div>

      {/* ── FOOTER ── */}
      <div style={{ padding: "10px 12px", borderTop: "0.5px solid var(--border)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        {/* Avatar */}
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--fill-primary)", color: "var(--on-primary)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 500, flexShrink: 0 }}>
          {userInitial}
        </div>
        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>
            {profile.full_name || profile.email}
          </p>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
            {planLabel(profile.plan)}
          </p>
        </div>
        {/* Settings */}
        <a
          href="/ajustes"
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 5, borderRadius: "var(--radius)", display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none", transition: "background 0.1s, color 0.1s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"; (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
          aria-label="Ajustes"
        >
          <i className="ti ti-settings" style={{ fontSize: 16 }} />
        </a>
      </div>
    </aside>
  );
}
