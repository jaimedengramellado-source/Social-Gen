"use client";

import { useEffect, useState } from "react";
import { Plus, MessageSquare, MoreHorizontal } from "lucide-react";
import { timeAgo } from "@/lib/utils";

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatSidebarProps {
  sessions: ChatSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

type Group = { label: string; items: ChatSession[] };

function groupSessionsByDate(sessions: ChatSession[]): Group[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 24 * 60 * 60 * 1000;

  const buckets: Record<string, ChatSession[]> = {
    "Hoy": [], "Ayer": [], "Últimos 7 días": [], "Últimos 30 días": [], "Anterior": [],
  };

  const sorted = [...sessions].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  for (const s of sorted) {
    const t = new Date(s.updated_at).getTime();
    if (t >= startOfToday) buckets["Hoy"].push(s);
    else if (t >= startOfToday - day) buckets["Ayer"].push(s);
    else if (t >= startOfToday - 7 * day) buckets["Últimos 7 días"].push(s);
    else if (t >= startOfToday - 30 * day) buckets["Últimos 30 días"].push(s);
    else buckets["Anterior"].push(s);
  }

  return (Object.entries(buckets) as [string, ChatSession[]][])
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

export function ChatSidebar({ sessions, activeId, onSelect, onNew, onDelete, onRename }: ChatSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!openMenuId) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-menu-root]")) setOpenMenuId(null);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [openMenuId]);

  function commitRename(id: string, oldTitle: string) {
    const next = editingValue.trim();
    if (next && next !== oldTitle) {
      onRename(id, next);
    }
    setEditingId(null);
  }

  function renderSessionItem(s: ChatSession) {
    const isEditing = editingId === s.id;
    const menuOpen = openMenuId === s.id;

    return (
      <div key={s.id} className="relative mx-2 mb-0.5" data-menu-root>
        <button
          onClick={() => !isEditing && onSelect(s.id)}
          className="w-full text-left px-3 py-2 rounded-xl transition-all"
          style={{ backgroundColor: activeId === s.id ? "var(--color-muted)" : "transparent" }}
        >
          <div className="flex items-start gap-2">
            <MessageSquare size={13} className="mt-0.5 flex-shrink-0" style={{ color: "var(--color-muted-foreground)" }} />
            <div className="min-w-0 flex-1 pr-6">
              {isEditing ? (
                <input
                  value={editingValue}
                  autoFocus
                  onChange={(e) => setEditingValue(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={() => commitRename(s.id, s.title)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); commitRename(s.id, s.title); }
                    if (e.key === "Escape") { setEditingId(null); }
                  }}
                  className="w-full text-[13px] font-medium bg-transparent border-b border-[var(--color-border)] focus:border-[var(--color-foreground)] leading-snug px-0 py-0"
                  style={{ color: "var(--color-foreground)" }}
                />
              ) : (
                <p className="text-[13px] font-medium leading-snug line-clamp-2" style={{ color: "var(--color-foreground)" }}>
                  {s.title}
                </p>
              )}
              <p className="text-[10px] mt-0.5" style={{ color: "var(--color-muted-foreground)" }}>
                {timeAgo(s.updated_at)}
              </p>
            </div>
          </div>
        </button>

        {!isEditing && (
          <button
            onClick={(e) => { e.stopPropagation(); setOpenMenuId(menuOpen ? null : s.id); }}
            className="absolute right-2 top-2 p-1 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: "var(--color-muted-foreground)" }}
            aria-label="Acciones"
          >
            <MoreHorizontal size={13} />
          </button>
        )}

        {menuOpen && (
          <div className="absolute right-2 top-8 bg-white border border-[var(--color-border)] rounded-lg shadow-md py-1 z-10 min-w-[130px]">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingId(s.id);
                setEditingValue(s.title);
                setOpenMenuId(null);
              }}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--color-muted)]"
            >
              Renombrar
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(s.id);
                setOpenMenuId(null);
              }}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--color-muted)]"
              style={{ color: "var(--color-destructive)" }}
            >
              Eliminar
            </button>
          </div>
        )}
      </div>
    );
  }

  const groups = groupSessionsByDate(sessions);

  return (
    <div
      className="flex flex-col border-r border-[var(--color-border)] flex-shrink-0"
      style={{ width: 240, backgroundColor: "var(--color-background)" }}
    >
      {/* New chat button */}
      <div className="p-3 border-b border-[var(--color-border)]">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:bg-[var(--color-muted)]"
          style={{ color: "var(--color-foreground)" }}
        >
          <Plus size={15} />
          Nuevo chat
        </button>
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto py-2" style={{ scrollbarWidth: "none" }}>
        {sessions.length === 0 && (
          <p className="text-xs text-center mt-8" style={{ color: "var(--color-muted-foreground)" }}>
            Sin conversaciones aún
          </p>
        )}
        {groups.map(group => (
          <div key={group.label} className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider px-4 mb-1" style={{ color: "var(--color-muted-foreground)" }}>
              {group.label}
            </p>
            {group.items.map(s => renderSessionItem(s))}
          </div>
        ))}
      </div>
    </div>
  );
}
