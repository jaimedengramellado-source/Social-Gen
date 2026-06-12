"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Search, FileText, Lightbulb, Plus, Share2, ExternalLink, Zap,
  ChevronRight, CheckCircle, Loader2, AlertCircle, FolderOpen, Folder,
  ChevronDown,
} from "lucide-react";
import { ViralScoreBadge } from "@/components/creator/viral-score-badge";
import { PLATFORM_LABELS } from "@/types";
import { timeAgo } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Script, ScriptSection } from "@/types";

const PRIMARY = "var(--color-primary)";
const ACCENT = "var(--color-accent)";
const AUTOSAVE_MS = 5 * 60 * 1000;

type IdeaRow = {
  id: string; title: string; viral_score: number; platform: string;
  niche: string; is_saved: boolean; created_at: string; hook_type: string;
  description: string; content_style: string;
};
type ScriptRow = {
  id: string; title: string; platform: string; viral_score: number;
  status: string; created_at: string; share_token: string; niche: string;
};
type ProjectRow = {
  id: string; name: string; platform: string | null; niche: string | null; created_at: string;
  ideas: IdeaRow[]; scripts: ScriptRow[];
};

type SaveStatus = "saved" | "saving" | "unsaved" | "error";
type Selection = { type: "script"; id: string } | { type: "idea"; id: string; idea: IdeaRow } | null;

function AutoTextarea({
  value, onChange, placeholder, className = "", large = false,
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; className?: string; large?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={1}
      className={`w-full resize-none overflow-hidden bg-transparent focus:outline-none leading-relaxed placeholder:text-[var(--color-muted-foreground)] ${large ? "text-2xl font-bold" : "text-sm"} ${className}`}
      style={{ minHeight: large ? "2.5rem" : "1.5rem", ...(large ? { fontFamily: "var(--font-serif)" } : {}) }}
    />
  );
}

function fmtSaveTime(d: Date) {
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "ahora mismo";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  return `hace ${Math.floor(diff / 3600)}h`;
}

export function BibliotecaClient({
  projects, orphanScripts, orphanSavedIdeas,
}: {
  projects: ProjectRow[];
  orphanScripts: ScriptRow[];
  orphanSavedIdeas: IdeaRow[];
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<Selection>(null);

  // Script editor state
  const [fullScript, setFullScript] = useState<Script | null>(null);
  const [loadingScript, setLoadingScript] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editHook, setEditHook] = useState("");
  const [editIntro, setEditIntro] = useState("");
  const [editSections, setEditSections] = useState<ScriptSection[]>([]);
  const [editCta, setEditCta] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const q = query.toLowerCase();
  const filteredProjects = projects.filter(p =>
    !q || p.name?.toLowerCase().includes(q) || p.niche?.toLowerCase().includes(q) ||
    p.ideas.some(i => i.title?.toLowerCase().includes(q)) ||
    p.scripts.some(s => s.title?.toLowerCase().includes(q))
  );
  const filteredOrphanScripts = orphanScripts.filter(s =>
    !q || s.title?.toLowerCase().includes(q) || s.niche?.toLowerCase().includes(q)
  );
  const filteredOrphanIdeas = orphanSavedIdeas.filter(i =>
    !q || i.title?.toLowerCase().includes(q) || i.niche?.toLowerCase().includes(q)
  );

  function toggleProject(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function selectScript(id: string, scriptRow?: ScriptRow) {
    setSelection({ type: "script", id });
    setFullScript(null);
    setIsDirty(false);
    setLoadingScript(true);
    try {
      const supabase = createClient();
      const { data } = await supabase.from("scripts").select("*").eq("id", id).single();
      const s = data as Script;
      setFullScript(s);
      setEditTitle(s.title || "");
      setEditHook(s.hook || "");
      setEditIntro(s.intro || "");
      setEditSections(s.main_content || []);
      setEditCta(s.cta || "");
      setSaveStatus("saved");
      setLastSaved(null);
    } catch { /* ignore */ }
    finally { setLoadingScript(false); }
    void scriptRow;
  }

  function selectIdea(idea: IdeaRow) {
    setSelection({ type: "idea", id: idea.id, idea });
    setFullScript(null);
    setIsDirty(false);
  }

  function markDirty() { setIsDirty(true); setSaveStatus("unsaved"); }

  const saveChanges = useCallback(async () => {
    if (!fullScript || !isDirty) return;
    setSaveStatus("saving");
    try {
      const supabase = createClient();
      await supabase.from("scripts").update({
        title: editTitle, hook: editHook, intro: editIntro,
        main_content: editSections, cta: editCta,
      }).eq("id", fullScript.id);
      setSaveStatus("saved");
      setLastSaved(new Date());
      setIsDirty(false);
    } catch { setSaveStatus("error"); }
  }, [fullScript, isDirty, editTitle, editHook, editIntro, editSections, editCta]);

  useEffect(() => {
    if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    if (!fullScript) return;
    autoSaveRef.current = setInterval(() => { saveChanges(); }, AUTOSAVE_MS);
    return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current); };
  }, [fullScript?.id, saveChanges]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); saveChanges(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [saveChanges]);

  const updateSection = (i: number, field: "section" | "content", val: string) => {
    setEditSections(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
    markDirty();
  };

  const selectedScriptRow = selection?.type === "script"
    ? [...projects.flatMap(p => p.scripts), ...orphanScripts].find(s => s.id === selection.id)
    : null;

  return (
    <div className="flex h-full">

      {/* ── Sidebar ── */}
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-[var(--color-border)] bg-white overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border)]">
          <Link
            href="/crear"
            className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-80 mb-3"
            style={{ backgroundColor: PRIMARY }}
          >
            <Plus size={14} /> Nuevo guion
          </Link>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
            <input
              type="text" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Buscar…"
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] focus:outline-none focus:border-[var(--color-foreground)] transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">

          {/* Projects */}
          {filteredProjects.length === 0 && filteredOrphanScripts.length === 0 && filteredOrphanIdeas.length === 0 && (
            <p className="text-xs text-[var(--color-muted-foreground)] text-center py-8 px-4">Sin contenido aún</p>
          )}

          {filteredProjects.map(project => {
            const isOpen = expanded.has(project.id);
            return (
              <div key={project.id}>
                <button
                  onClick={() => toggleProject(project.id)}
                  className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[var(--color-muted)] transition-colors"
                >
                  <span className="flex-shrink-0 text-[var(--color-muted-foreground)]">
                    {isOpen ? <FolderOpen size={13} /> : <Folder size={13} />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="text-xs font-semibold truncate block leading-snug">{project.name}</span>
                    <span className="text-[10px] text-[var(--color-muted-foreground)]">
                      {project.ideas.length} ideas · {project.scripts.length} guion{project.scripts.length !== 1 ? "es" : ""}
                    </span>
                  </span>
                  <ChevronDown
                    size={12}
                    className="flex-shrink-0 text-[var(--color-muted-foreground)] transition-transform"
                    style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                  />
                </button>

                {isOpen && (
                  <div className="pl-4 pb-1">
                    {/* Ideas inside project */}
                    {project.ideas.length > 0 && (
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] px-2 py-1.5">
                          Ideas generadas
                        </p>
                        {project.ideas.map(idea => (
                          <button
                            key={idea.id}
                            onClick={() => selectIdea(idea)}
                            className="w-full text-left px-2 py-2 rounded-lg transition-colors hover:bg-[var(--color-muted)] flex items-start gap-2"
                            style={{
                              backgroundColor: selection?.type === "idea" && selection.id === idea.id ? ACCENT : undefined,
                              borderLeft: selection?.type === "idea" && selection.id === idea.id ? `2px solid ${PRIMARY}` : "2px solid transparent",
                            }}
                          >
                            <Lightbulb size={11} className="mt-0.5 flex-shrink-0" style={{ color: PRIMARY }} />
                            <span className="flex-1 min-w-0">
                              <span className="text-[11px] font-medium truncate block leading-snug">{idea.title}</span>
                              <span className="text-[10px] text-[var(--color-muted-foreground)]">⚡{idea.viral_score}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Scripts inside project */}
                    {project.scripts.length > 0 && (
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] px-2 py-1.5 mt-1">
                          Guion generado
                        </p>
                        {project.scripts.map(script => (
                          <button
                            key={script.id}
                            onClick={() => selectScript(script.id, script)}
                            className="w-full text-left px-2 py-2 rounded-lg transition-colors hover:bg-[var(--color-muted)] flex items-start gap-2"
                            style={{
                              backgroundColor: selection?.type === "script" && selection.id === script.id ? ACCENT : undefined,
                              borderLeft: selection?.type === "script" && selection.id === script.id ? `2px solid ${PRIMARY}` : "2px solid transparent",
                            }}
                          >
                            <FileText size={11} className="mt-0.5 flex-shrink-0" style={{ color: PRIMARY }} />
                            <span className="flex-1 min-w-0">
                              <span className="text-[11px] font-medium truncate block leading-snug">{script.title}</span>
                              <span className="text-[10px] text-[var(--color-muted-foreground)]">⚡{script.viral_score}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Orphan scripts (created before project system) */}
          {filteredOrphanScripts.length > 0 && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] px-4 py-2 mt-2">
                Guiones anteriores
              </p>
              {filteredOrphanScripts.map(script => (
                <button
                  key={script.id}
                  onClick={() => selectScript(script.id, script)}
                  className="w-full text-left px-4 py-2.5 transition-colors hover:bg-[var(--color-muted)]"
                  style={{
                    backgroundColor: selection?.type === "script" && selection.id === script.id ? ACCENT : undefined,
                    borderLeft: selection?.type === "script" && selection.id === script.id ? `2px solid ${PRIMARY}` : "2px solid transparent",
                  }}
                >
                  <p className="text-xs font-medium truncate leading-snug">{script.title}</p>
                  <p className="text-[10px] text-[var(--color-muted-foreground)] mt-0.5">
                    {PLATFORM_LABELS[script.platform as keyof typeof PLATFORM_LABELS] || script.platform} · ⚡{script.viral_score}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Orphan saved ideas */}
          {filteredOrphanIdeas.length > 0 && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] px-4 py-2 mt-2">
                Ideas guardadas
              </p>
              {filteredOrphanIdeas.map(idea => (
                <button
                  key={idea.id}
                  onClick={() => selectIdea(idea)}
                  className="w-full text-left px-4 py-2.5 transition-colors hover:bg-[var(--color-muted)]"
                  style={{
                    backgroundColor: selection?.type === "idea" && selection.id === idea.id ? ACCENT : undefined,
                    borderLeft: selection?.type === "idea" && selection.id === idea.id ? `2px solid ${PRIMARY}` : "2px solid transparent",
                  }}
                >
                  <p className="text-xs font-medium truncate leading-snug">{idea.title}</p>
                  <p className="text-[10px] text-[var(--color-muted-foreground)] mt-0.5">{idea.hook_type} · ⚡{idea.viral_score}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* ── Main area ── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Nothing selected */}
        {!selection && (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: ACCENT }}>
              <FolderOpen size={28} style={{ color: PRIMARY }} />
            </div>
            <p className="text-base font-semibold mb-1">Selecciona un proyecto</p>
            <p className="text-sm text-[var(--color-muted-foreground)] max-w-xs">
              Cada guion que crees genera una carpeta con todas sus ideas y variantes.
            </p>
          </div>
        )}

        {/* ── Script editor ── */}
        {selection?.type === "script" && (
          <>
            <div className="flex items-center justify-between px-8 py-2.5 border-b border-[var(--color-border)] bg-white flex-shrink-0">
              <div className="flex items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
                {saveStatus === "saving" && <><Loader2 size={12} className="animate-spin" /> Guardando…</>}
                {saveStatus === "saved" && lastSaved && <><CheckCircle size={12} className="text-green-500" /> Guardado {fmtSaveTime(lastSaved)}</>}
                {saveStatus === "unsaved" && <><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Sin guardar · autoguardado en 5 min</>}
                {saveStatus === "error" && <><AlertCircle size={12} className="text-red-500" /> Error al guardar</>}
              </div>
              <div className="flex items-center gap-2">
                {isDirty && (
                  <button
                    onClick={saveChanges}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-80"
                    style={{ backgroundColor: PRIMARY }}
                  >
                    Guardar
                  </button>
                )}
                {selectedScriptRow?.share_token && (
                  <Link href={`/share/${selectedScriptRow.share_token}`} target="_blank"
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-foreground)] transition-colors">
                    <Share2 size={11} /> Compartir
                  </Link>
                )}
                {fullScript && (
                  <Link href={`/crear?script=${fullScript.id}`}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-80"
                    style={{ backgroundColor: PRIMARY }}>
                    <ExternalLink size={11} /> Abrir editor
                  </Link>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "#EBEBEB" }}>
              {loadingScript && (
                <div className="max-w-2xl mx-auto py-10 px-6">
                  <div className="bg-white rounded shadow-[0_2px_12px_rgba(0,0,0,0.10)] px-12 py-14 space-y-4">
                    <div className="h-8 w-2/3 rounded-lg bg-[var(--color-muted)] animate-pulse" />
                    <div className="h-4 w-1/3 rounded-lg bg-[var(--color-muted)] animate-pulse" />
                    <div className="h-px bg-[var(--color-border)] my-6" />
                    {[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-[var(--color-muted)] animate-pulse" />)}
                  </div>
                </div>
              )}
              {!loadingScript && !fullScript && (
                <div className="text-center py-16">
                  <p className="text-sm text-[var(--color-muted-foreground)]">No se pudo cargar el guion.</p>
                </div>
              )}
              {!loadingScript && fullScript && (
                <div className="max-w-2xl mx-auto py-10 px-6">
                <div className="bg-white rounded shadow-[0_2px_12px_rgba(0,0,0,0.10)] px-12 py-14">
                  <AutoTextarea
                    value={editTitle}
                    onChange={v => { setEditTitle(v); markDirty(); }}
                    placeholder="Título del guion…"
                    large
                    className="mb-4"
                  />
                  <div className="flex flex-wrap items-center gap-2 mb-6">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: ACCENT, color: PRIMARY }}>
                      {PLATFORM_LABELS[fullScript.platform as keyof typeof PLATFORM_LABELS] || fullScript.platform}
                    </span>
                    {fullScript.niche && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
                        {fullScript.niche}
                      </span>
                    )}
                    <ViralScoreBadge score={fullScript.viral_score} size="sm" />
                    <span className="text-xs text-[var(--color-muted-foreground)]">{timeAgo(fullScript.created_at)}</span>
                  </div>
                  <div className="h-px bg-[var(--color-border)] mb-8" />

                  <section className="mb-8">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-2">🎣 Hook</p>
                    <div className="rounded-xl p-4 focus-within:ring-1 transition-all" style={{ backgroundColor: "var(--color-muted)" }}>
                      <AutoTextarea value={editHook} onChange={v => { setEditHook(v); markDirty(); }} placeholder="Hook…" className="font-medium" />
                    </div>
                  </section>

                  {fullScript.intro !== undefined && (
                    <section className="mb-8">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-2">Introducción</p>
                      <AutoTextarea value={editIntro} onChange={v => { setEditIntro(v); markDirty(); }} placeholder="Introducción…"
                        className="border-b border-[var(--color-border)] focus:border-[var(--color-foreground)] pb-1 transition-colors" />
                    </section>
                  )}

                  {editSections.length > 0 && (
                    <section className="mb-8 space-y-7">
                      {editSections.map((sec, i) => (
                        <div key={i}>
                          <div className="flex items-center gap-2 mb-2">
                            <input type="text" value={sec.section}
                              onChange={e => updateSection(i, "section", e.target.value)}
                              className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] bg-transparent focus:outline-none border-b border-transparent focus:border-[var(--color-muted-foreground)] transition-colors" />
                            {sec.timestamp && <span className="text-[10px] text-[var(--color-muted-foreground)] opacity-50">[{sec.timestamp}]</span>}
                          </div>
                          <AutoTextarea value={sec.content} onChange={v => updateSection(i, "content", v)}
                            placeholder="Contenido de la sección…"
                            className="border-b border-[var(--color-border)] focus:border-[var(--color-foreground)] pb-1 transition-colors" />
                        </div>
                      ))}
                    </section>
                  )}

                  {fullScript.cta !== undefined && (
                    <section className="mb-8">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-2">🎯 CTA</p>
                      <div className="rounded-xl p-4 focus-within:ring-1 transition-all" style={{ backgroundColor: "var(--color-muted)" }}>
                        <AutoTextarea value={editCta} onChange={v => { setEditCta(v); markDirty(); }} placeholder="Call to action…" />
                      </div>
                    </section>
                  )}

                  {fullScript.title_suggestions?.length > 0 && (
                    <section className="mb-10">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-2">Títulos alternativos</p>
                      <ul className="space-y-1.5">
                        {fullScript.title_suggestions.map((t, i) => (
                          <li key={i} className="text-sm text-[var(--color-muted-foreground)] flex items-start gap-2">
                            <span style={{ color: PRIMARY }}>·</span> {t}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  <p className="text-xs text-[var(--color-muted-foreground)] text-center pb-4">
                    Autoguardado cada 5 minutos · Ctrl+S para guardar ahora
                  </p>
                </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Idea view ── */}
        {selection?.type === "idea" && (
          <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "#EBEBEB" }}>
            <div className="max-w-2xl mx-auto py-10 px-6">
            <div className="bg-white rounded shadow-[0_2px_12px_rgba(0,0,0,0.10)] px-12 py-14">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: ACCENT }}>
                  <Lightbulb size={16} style={{ color: PRIMARY }} />
                </div>
                <h1 className="text-2xl font-bold leading-tight" style={{ fontFamily: "var(--font-serif)" }}>
                  {selection.idea.title}
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-6">
                {selection.idea.hook_type && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
                    {selection.idea.hook_type}
                  </span>
                )}
                {selection.idea.platform && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: ACCENT, color: PRIMARY }}>
                    {PLATFORM_LABELS[selection.idea.platform as keyof typeof PLATFORM_LABELS] || selection.idea.platform}
                  </span>
                )}
                <ViralScoreBadge score={selection.idea.viral_score} size="sm" />
                <span className="text-xs text-[var(--color-muted-foreground)]">{timeAgo(selection.idea.created_at)}</span>
              </div>

              {selection.idea.description && (
                <>
                  <div className="h-px bg-[var(--color-border)] mb-6" />
                  <p className="text-sm leading-relaxed text-[var(--color-muted-foreground)] mb-8">
                    {selection.idea.description}
                  </p>
                </>
              )}

              <div className="h-px bg-[var(--color-border)] mb-8" />

              <div className="space-y-3">
                <Link
                  href={`/crear?idea=${selection.idea.id}`}
                  className="flex items-center justify-between gap-4 p-4 rounded-xl text-white transition-opacity hover:opacity-80"
                  style={{ backgroundColor: PRIMARY }}
                >
                  <div>
                    <p className="text-sm font-semibold">Generar guion completo</p>
                    <p className="text-xs opacity-80">La IA escribirá el guion a partir de esta idea</p>
                  </div>
                  <ChevronRight size={16} />
                </Link>

                <Link
                  href={`/crear?idea=${selection.idea.id}&regenerate=1`}
                  className="flex items-center justify-between gap-4 p-4 rounded-xl border transition-colors hover:border-[var(--color-foreground)]"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  <div>
                    <p className="text-sm font-semibold">Generar variantes de esta idea</p>
                    <p className="text-xs text-[var(--color-muted-foreground)]">Nuevos ángulos y hooks alternativos</p>
                  </div>
                  <Zap size={15} style={{ color: PRIMARY }} />
                </Link>
              </div>
            </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
