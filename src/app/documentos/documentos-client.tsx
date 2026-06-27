"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Search, FileText, Lightbulb, Plus, Share2, ExternalLink, Zap,
  ChevronRight, CheckCircle, Loader2, AlertCircle, FolderOpen, Folder,
  ChevronDown, Star, Cloud,
} from "lucide-react";
import { ViralScoreBadge } from "@/components/creator/viral-score-badge";
import { PLATFORM_LABELS } from "@/types";
import { timeAgo } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import type { Editor } from "@/components/ui/rich-text-editor";
import type { Script, ScriptSection } from "@/types";
import {
  Bold, Italic, Underline as UnderlineIcon,
  Heading1, Heading2, Heading3, List, ListOrdered,
} from "lucide-react";

const PRIMARY = "var(--color-primary)";
const ACCENT = "var(--color-accent)";
const AUTOSAVE_MS = 5 * 60 * 1000;

const SHORT_TEMPLATE = {
  title: "Mi Short",
  hook: "<p>🎣 <strong>Empieza aquí</strong> — Algo que detenga el scroll en 1-2 segundos.</p><p><em>Ejemplo: «¿Sabías que puedes [resultado] en solo [tiempo]?»</em></p>",
  intro: "<p>Entra directo al tema. Sin relleno. 2-3 frases máximo.</p>",
  main_content: [{ section: "Desarrollo", content: "<p>El cuerpo del video (10-20 seg). El valor que prometiste en el hook.</p>" }] as ScriptSection[],
  cta: "<p>🎯 Diles qué hacer. Una sola acción clara.</p><p><em>«Sígueme para más tips» · «Comenta si te pasó» · «Guárdalo para después»</em></p>",
};

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

function fmtSaveTime(d: Date) {
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "ahora mismo";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  return `hace ${Math.floor(diff / 3600)}h`;
}

const FONTS = ["Arial", "Times New Roman", "Georgia", "Courier New", "Verdana"];
const SIZES = [8, 9, 10, 11, 12, 14, 18, 24, 36];

export function DocumentosClient({
  projects, orphanScripts, orphanSavedIdeas,
}: {
  projects: ProjectRow[];
  orphanScripts: ScriptRow[];
  orphanSavedIdeas: IdeaRow[];
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<Selection>(null);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [localOrphanScripts, setLocalOrphanScripts] = useState<ScriptRow[]>(orphanScripts);
  const [creatingBlank, setCreatingBlank] = useState(false);

  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);
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

  // Document-level formatting (affects whole page, not per-selection)
  const [docFont, setDocFont] = useState("Arial");
  const [docSize, setDocSize] = useState(11);
  const [docTextColor, setDocTextColor] = useState("#000000");

  const q = query.toLowerCase();
  const filteredProjects = projects.filter(p =>
    !q || p.name?.toLowerCase().includes(q) || p.niche?.toLowerCase().includes(q) ||
    p.ideas.some(i => i.title?.toLowerCase().includes(q)) ||
    p.scripts.some(s => s.title?.toLowerCase().includes(q))
  );
  const filteredOrphanScripts = localOrphanScripts.filter(s =>
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
    setMobilePanelOpen(true);
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
    setMobilePanelOpen(true);
    setFullScript(null);
    setIsDirty(false);
  }

  async function createBlankDocument() {
    setCreatingBlank(true);
    try {
      const res = await fetch("/api/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Sin título" }),
      });
      const data = await res.json();
      if (data.script) {
        setLocalOrphanScripts(prev => [data.script, ...prev]);
        await selectScript(data.script.id, data.script);
      }
    } finally {
      setCreatingBlank(false);
    }
  }

  async function createFromTemplate() {
    setCreatingBlank(true);
    try {
      const res = await fetch("/api/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: SHORT_TEMPLATE.title }),
      });
      const data = await res.json();
      if (data.script) {
        const supabase = createClient();
        await supabase.from("scripts").update({
          hook: SHORT_TEMPLATE.hook,
          intro: SHORT_TEMPLATE.intro,
          main_content: SHORT_TEMPLATE.main_content,
          cta: SHORT_TEMPLATE.cta,
        }).eq("id", data.script.id);
        setLocalOrphanScripts(prev => [{ ...data.script, title: SHORT_TEMPLATE.title }, ...prev]);
        await selectScript(data.script.id);
      }
    } finally {
      setCreatingBlank(false);
    }
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
      setLocalOrphanScripts(prev => prev.map(s => s.id === fullScript.id ? { ...s, title: editTitle } : s));
    } catch { setSaveStatus("error"); }
  }, [fullScript, isDirty, editTitle, editHook, editIntro, editSections, editCta]);

  useEffect(() => {
    if (!fullScript) return;
    const timer = setInterval(() => { saveChanges(); }, AUTOSAVE_MS);
    return () => clearInterval(timer);
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
    ? [...projects.flatMap(p => p.scripts), ...localOrphanScripts].find(s => s.id === selection.id)
    : null;

  function getParagraphStyle() {
    if (!activeEditor) return "paragraph";
    if (activeEditor.isActive("heading", { level: 1 })) return "h1";
    if (activeEditor.isActive("heading", { level: 2 })) return "h2";
    if (activeEditor.isActive("heading", { level: 3 })) return "h3";
    return "paragraph";
  }

  function applyParagraphStyle(value: string) {
    if (!activeEditor) return;
    if (value === "paragraph") {
      activeEditor.chain().focus().setParagraph().run();
    } else {
      const level = parseInt(value.replace("h", "")) as 1 | 2 | 3;
      activeEditor.chain().focus().toggleHeading({ level }).run();
    }
  }

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex h-full">

      {/* ── Sidebar ── */}
      <aside className={`w-full md:w-64 flex-shrink-0 flex flex-col border-r border-[var(--color-border)] bg-white overflow-hidden ${mobilePanelOpen ? 'hidden md:flex' : ''}`}>
        <div className="p-3 border-b border-[var(--color-border)] space-y-2">
          <Link
            href="/crear"
            className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-80"
            style={{ backgroundColor: PRIMARY }}
          >
            <Plus size={14} /> Nuevo guion con IA
          </Link>
          <button
            onClick={createBlankDocument}
            disabled={creatingBlank}
            className="flex items-center justify-center gap-2 w-full py-1.5 rounded-xl text-xs font-medium border border-[var(--color-border)] transition-colors hover:bg-[var(--color-muted)] disabled:opacity-50"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            {creatingBlank
              ? <><Loader2 size={12} className="animate-spin" /> Creando…</>
              : <><FileText size={12} /> Documento en blanco</>
            }
          </button>
          <button
            onClick={createFromTemplate}
            disabled={creatingBlank}
            className="flex items-center justify-center gap-2 w-full py-1.5 rounded-xl text-xs font-medium border border-[var(--color-border)] transition-colors hover:bg-[var(--color-muted)] disabled:opacity-50"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            <Zap size={12} style={{ color: "var(--color-primary)" }} /> Plantilla Short
          </button>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
            <input
              type="text" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Buscar…"
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] focus:outline-none focus:border-[var(--color-foreground)] transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2 pb-16 md:pb-2">
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
                  <p className="text-xs font-medium truncate leading-snug">
                    {selection?.type === "script" && selection.id === script.id ? editTitle || script.title : script.title}
                  </p>
                  <p className="text-[10px] text-[var(--color-muted-foreground)] mt-0.5">
                    {PLATFORM_LABELS[script.platform as keyof typeof PLATFORM_LABELS] || script.platform} · ⚡{script.viral_score}
                  </p>
                </button>
              ))}
            </div>
          )}

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

          {/* TOC — Este documento */}
          {selection?.type === "script" && fullScript && (
            <div className="mt-3 border-t border-[var(--color-border)] pt-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] px-4 py-1.5">
                Este documento
              </p>
              <button onClick={() => scrollToSection("doc-section-hook")}
                className="w-full text-left px-5 py-1 text-[11px] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)] transition-colors">
                🎣 Hook
              </button>
              <button onClick={() => scrollToSection("doc-section-intro")}
                className="w-full text-left px-5 py-1 text-[11px] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)] transition-colors">
                Introducción
              </button>
              {editSections.map((sec, i) => (
                <button key={i} onClick={() => scrollToSection(`doc-section-main-${i}`)}
                  className="w-full text-left px-5 py-1 text-[11px] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)] transition-colors">
                  {sec.section || `Sección ${i + 1}`}
                </button>
              ))}
              <button onClick={() => scrollToSection("doc-section-cta")}
                className="w-full text-left px-5 py-1 text-[11px] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)] transition-colors">
                🎯 CTA
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main area ── */}
      <main className={`flex-1 flex-col overflow-hidden ${mobilePanelOpen ? 'flex' : 'hidden md:flex'}`}>

        {/* Mobile back button */}
        <button
          onClick={() => { setMobilePanelOpen(false); }}
          className="md:hidden flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)] text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] bg-white flex-shrink-0"
        >
          <ChevronRight size={14} className="rotate-180" /> Volver
        </button>

        {!selection && (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: ACCENT }}>
              <FolderOpen size={28} style={{ color: PRIMARY }} />
            </div>
            <p className="text-base font-semibold mb-1">Selecciona un documento</p>
            <p className="text-sm text-[var(--color-muted-foreground)] max-w-xs">
              Elige un guion del panel izquierdo o crea un documento en blanco para empezar.
            </p>
          </div>
        )}

        {/* ── Script editor ── */}
        {selection?.type === "script" && (
          <>
            {/* Document header bar */}
            <div className="flex items-center justify-between px-3 h-12 border-b border-[var(--color-border)] bg-white flex-shrink-0 gap-4">
              {/* Left: visual menu */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {["Archivo", "Editar", "Ver", "Insertar", "Formato"].map(item => (
                  <button key={item}
                    className="text-[11px] px-2 py-1 rounded hover:bg-[var(--color-muted)] transition-colors"
                    style={{ color: "var(--color-muted-foreground)" }}>
                    {item}
                  </button>
                ))}
              </div>

              {/* Center: title */}
              <div className="flex items-center gap-1.5 flex-1 max-w-xs">
                <FileText size={14} style={{ color: PRIMARY }} className="flex-shrink-0" />
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => { setEditTitle(e.target.value); markDirty(); }}
                  onBlur={() => { if (isDirty) saveChanges(); }}
                  placeholder="Sin título"
                  className="flex-1 text-sm font-medium bg-transparent focus:outline-none px-1.5 py-0.5 rounded hover:bg-[var(--color-muted)] focus:bg-[var(--color-muted)] transition-colors min-w-0"
                />
                <button className="text-[var(--color-muted-foreground)] hover:text-yellow-400 transition-colors flex-shrink-0">
                  <Star size={13} />
                </button>
                <button className="text-[var(--color-muted-foreground)] hover:text-blue-400 transition-colors flex-shrink-0">
                  <Cloud size={13} />
                </button>
              </div>

              {/* Right: status + actions */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className="flex items-center gap-1 text-[11px] text-[var(--color-muted-foreground)]">
                  {saveStatus === "saving" && <><Loader2 size={11} className="animate-spin" /> Guardando…</>}
                  {saveStatus === "saved" && lastSaved && <><CheckCircle size={11} className="text-green-500" /> Guardado {fmtSaveTime(lastSaved)}</>}
                  {saveStatus === "unsaved" && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />}
                  {saveStatus === "error" && <AlertCircle size={11} className="text-red-500" />}
                </div>
                {isDirty && (
                  <button onClick={saveChanges}
                    className="text-xs font-semibold px-2.5 py-1 rounded-md text-white"
                    style={{ backgroundColor: PRIMARY }}>
                    Guardar
                  </button>
                )}
                {selectedScriptRow?.share_token && (
                  <Link href={`/share/${selectedScriptRow.share_token}`} target="_blank"
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-[var(--color-border)] hover:border-[var(--color-foreground)] transition-colors">
                    <Share2 size={11} /> Compartir
                  </Link>
                )}
                {fullScript && (
                  <Link href={`/crear?script=${fullScript.id}`}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md text-white transition-opacity hover:opacity-80"
                    style={{ backgroundColor: PRIMARY }}>
                    <ExternalLink size={11} /> IA
                  </Link>
                )}
              </div>
            </div>

            {/* Format toolbar */}
            <div
              className="flex items-center gap-0.5 px-3 py-1.5 border-b border-[var(--color-border)] bg-white flex-shrink-0 flex-wrap"
              onMouseDown={e => e.preventDefault()}
            >
              {/* Paragraph style */}
              <select
                value={getParagraphStyle()}
                onChange={e => applyParagraphStyle(e.target.value)}
                disabled={!activeEditor}
                className="text-xs h-7 rounded px-1.5 border border-[var(--color-border)] focus:outline-none disabled:opacity-40 mr-0.5"
                style={{ color: "var(--color-foreground)", backgroundColor: "transparent" }}
              >
                <option value="paragraph">Texto normal</option>
                <option value="h1">Título 1</option>
                <option value="h2">Título 2</option>
                <option value="h3">Título 3</option>
              </select>

              <div className="w-px h-5 mx-1" style={{ backgroundColor: "var(--color-border)" }} />

              {/* Font family */}
              <select
                value={docFont}
                onChange={e => setDocFont(e.target.value)}
                className="text-xs h-7 rounded px-1.5 border border-[var(--color-border)] focus:outline-none mr-0.5"
                style={{ color: "var(--color-foreground)", backgroundColor: "transparent", fontFamily: docFont }}
              >
                {FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
              </select>

              {/* Font size */}
              <select
                value={docSize}
                onChange={e => setDocSize(Number(e.target.value))}
                className="text-xs h-7 w-14 rounded px-1.5 border border-[var(--color-border)] focus:outline-none"
                style={{ color: "var(--color-foreground)", backgroundColor: "transparent" }}
              >
                {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              <div className="w-px h-5 mx-1" style={{ backgroundColor: "var(--color-border)" }} />

              {/* B I U */}
              <FmtBtn onClick={() => activeEditor?.chain().focus().toggleBold().run()}
                active={!!activeEditor?.isActive("bold")} label="Negrita (Ctrl+B)" disabled={!activeEditor}>
                <Bold size={13} />
              </FmtBtn>
              <FmtBtn onClick={() => activeEditor?.chain().focus().toggleItalic().run()}
                active={!!activeEditor?.isActive("italic")} label="Cursiva (Ctrl+I)" disabled={!activeEditor}>
                <Italic size={13} />
              </FmtBtn>
              <FmtBtn onClick={() => activeEditor?.chain().focus().toggleUnderline().run()}
                active={!!activeEditor?.isActive("underline")} label="Subrayado (Ctrl+U)" disabled={!activeEditor}>
                <UnderlineIcon size={13} />
              </FmtBtn>

              <div className="w-px h-5 mx-1" style={{ backgroundColor: "var(--color-border)" }} />

              {/* Headings */}
              <FmtBtn onClick={() => activeEditor?.chain().focus().toggleHeading({ level: 1 }).run()}
                active={!!activeEditor?.isActive("heading", { level: 1 })} label="Título 1" disabled={!activeEditor}>
                <Heading1 size={13} />
              </FmtBtn>
              <FmtBtn onClick={() => activeEditor?.chain().focus().toggleHeading({ level: 2 }).run()}
                active={!!activeEditor?.isActive("heading", { level: 2 })} label="Título 2" disabled={!activeEditor}>
                <Heading2 size={13} />
              </FmtBtn>
              <FmtBtn onClick={() => activeEditor?.chain().focus().toggleHeading({ level: 3 }).run()}
                active={!!activeEditor?.isActive("heading", { level: 3 })} label="Título 3" disabled={!activeEditor}>
                <Heading3 size={13} />
              </FmtBtn>

              <div className="w-px h-5 mx-1" style={{ backgroundColor: "var(--color-border)" }} />

              {/* Lists */}
              <FmtBtn onClick={() => activeEditor?.chain().focus().toggleBulletList().run()}
                active={!!activeEditor?.isActive("bulletList")} label="Lista" disabled={!activeEditor}>
                <List size={13} />
              </FmtBtn>
              <FmtBtn onClick={() => activeEditor?.chain().focus().toggleOrderedList().run()}
                active={!!activeEditor?.isActive("orderedList")} label="Lista numerada" disabled={!activeEditor}>
                <ListOrdered size={13} />
              </FmtBtn>

              <div className="w-px h-5 mx-1" style={{ backgroundColor: "var(--color-border)" }} />

              {/* Text color */}
              <label
                title="Color de texto"
                className="w-7 h-7 flex flex-col items-center justify-center rounded-md cursor-pointer transition-colors hover:bg-[var(--color-muted)] relative"
                style={{ color: "var(--color-muted-foreground)" }}
              >
                <span className="text-xs font-bold leading-none" style={{ color: docTextColor }}>A</span>
                <div className="absolute bottom-1 left-1.5 right-1.5 h-0.5 rounded" style={{ backgroundColor: docTextColor }} />
                <input
                  type="color"
                  value={docTextColor}
                  onChange={e => {
                    setDocTextColor(e.target.value);
                    activeEditor?.chain().focus().setColor(e.target.value).run();
                  }}
                  className="sr-only"
                />
              </label>

              <div className="w-px h-5 mx-1" style={{ backgroundColor: "var(--color-border)" }} />

              {/* Zoom display (visual only) */}
              <span className="text-[11px] text-[var(--color-muted-foreground)] px-2 select-none">100%</span>

              {!activeEditor && (
                <span className="ml-1 text-[10px] text-[var(--color-muted-foreground)]">
                  Haz clic en una sección para editar
                </span>
              )}
            </div>

            {/* Document canvas */}
            <div className="flex-1 overflow-y-auto pb-16 md:pb-0" style={{ backgroundColor: "#F0F4F9" }}>
              {loadingScript && (
                <div className="py-6 md:py-10 px-2 md:px-6 mx-auto" style={{ maxWidth: "816px" }}>
                  <div className="bg-white space-y-4" style={{ padding: "clamp(24px, 5vw, 72px) clamp(16px, 8vw, 96px)", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }}>
                    <div className="h-8 w-2/3 rounded-lg bg-[var(--color-muted)] animate-pulse" />
                    <div className="h-4 w-1/3 rounded-lg bg-[var(--color-muted)] animate-pulse" />
                    <div className="h-px bg-[var(--color-border)] my-6" />
                    {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-[var(--color-muted)] animate-pulse" />)}
                  </div>
                </div>
              )}
              {!loadingScript && !fullScript && (
                <div className="text-center py-16">
                  <p className="text-sm text-[var(--color-muted-foreground)]">No se pudo cargar el documento.</p>
                </div>
              )}
              {!loadingScript && fullScript && (
                <div className="py-6 md:py-10 px-2 md:px-6 mx-auto" style={{ maxWidth: "816px" }}>
                  <div
                    className="bg-white doc-body"
                    style={{
                      padding: "clamp(24px, 5vw, 72px) clamp(16px, 8vw, 96px)",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                      fontFamily: docFont,
                      fontSize: `${docSize}pt`,
                      lineHeight: 1.5,
                    }}
                  >
                    {/* Title */}
                    <input
                      type="text"
                      value={editTitle}
                      onChange={e => { setEditTitle(e.target.value); markDirty(); }}
                      onBlur={() => { if (isDirty) saveChanges(); }}
                      placeholder="Título del documento…"
                      className="w-full text-2xl font-bold bg-transparent focus:outline-none leading-tight mb-4 placeholder:text-[var(--color-muted-foreground)]"
                      style={{ fontFamily: "var(--font-serif)" }}
                    />

                    <div className="flex flex-wrap items-center gap-2 mb-6">
                      {fullScript.platform && (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: ACCENT, color: PRIMARY }}>
                          {PLATFORM_LABELS[fullScript.platform as keyof typeof PLATFORM_LABELS] || fullScript.platform}
                        </span>
                      )}
                      {fullScript.niche && (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
                          {fullScript.niche}
                        </span>
                      )}
                      {fullScript.viral_score != null && <ViralScoreBadge score={fullScript.viral_score} size="sm" />}
                      <span className="text-xs text-[var(--color-muted-foreground)]">{timeAgo(fullScript.created_at)}</span>
                    </div>

                    <div className="h-px bg-[var(--color-border)] mb-8" />

                    {/* Hook */}
                    <section id="doc-section-hook" className="mb-8">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-2">🎣 Hook</p>
                      <div className="rounded-xl p-4 transition-all" style={{ backgroundColor: "var(--color-muted)" }}>
                        <RichTextEditor
                          content={editHook}
                          onChange={v => { setEditHook(v); markDirty(); }}
                          placeholder="Escribe el hook aquí…"
                          onFocusEditor={setActiveEditor}
                        />
                      </div>
                    </section>

                    {/* Intro */}
                    <section id="doc-section-intro" className="mb-8">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-2">Introducción</p>
                      <div className="border-b border-[var(--color-border)] pb-3">
                        <RichTextEditor
                          content={editIntro}
                          onChange={v => { setEditIntro(v); markDirty(); }}
                          placeholder="Escribe la introducción aquí…"
                          onFocusEditor={setActiveEditor}
                        />
                      </div>
                    </section>

                    {/* Main content sections */}
                    {editSections.length > 0 && (
                      <section className="mb-8 space-y-7">
                        {editSections.map((sec, i) => (
                          <div id={`doc-section-main-${i}`} key={i}>
                            <div className="flex items-center gap-2 mb-2">
                              <input
                                type="text"
                                value={sec.section}
                                onChange={e => updateSection(i, "section", e.target.value)}
                                className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] bg-transparent focus:outline-none border-b border-transparent focus:border-[var(--color-muted-foreground)] transition-colors"
                              />
                              {sec.timestamp && (
                                <span className="text-[10px] text-[var(--color-muted-foreground)] opacity-50">[{sec.timestamp}]</span>
                              )}
                            </div>
                            <div className="border-b border-[var(--color-border)] pb-3">
                              <RichTextEditor
                                content={sec.content}
                                onChange={v => updateSection(i, "content", v)}
                                placeholder="Contenido de la sección…"
                                onFocusEditor={setActiveEditor}
                              />
                            </div>
                          </div>
                        ))}
                      </section>
                    )}

                    {/* CTA */}
                    <section id="doc-section-cta" className="mb-8">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-2">🎯 CTA</p>
                      <div className="rounded-xl p-4 transition-all" style={{ backgroundColor: "var(--color-muted)" }}>
                        <RichTextEditor
                          content={editCta}
                          onChange={v => { setEditCta(v); markDirty(); }}
                          placeholder="Escribe el call to action aquí…"
                          onFocusEditor={setActiveEditor}
                        />
                      </div>
                    </section>

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

                    <p className="text-xs text-[var(--color-muted-foreground)] text-center pt-4 border-t border-[var(--color-border)]">
                      Autoguardado cada 5 min · Ctrl+S para guardar · Selecciona texto para formatear
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Idea view ── */}
        {selection?.type === "idea" && (
          <div className="flex-1 overflow-y-auto pb-16 md:pb-0" style={{ backgroundColor: "#F0F4F9" }}>
            <div className="py-6 md:py-10 px-2 md:px-6 mx-auto" style={{ maxWidth: "816px" }}>
              <div className="bg-white" style={{ padding: "clamp(24px, 5vw, 72px) clamp(16px, 8vw, 96px)", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }}>
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

function FmtBtn({
  onClick, active, label, disabled, children,
}: {
  onClick: () => void;
  active: boolean;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={label}
      disabled={disabled}
      className="w-7 h-7 flex items-center justify-center rounded-md transition-colors disabled:opacity-30"
      style={{
        backgroundColor: active ? "var(--color-primary-light)" : "transparent",
        color: active ? "var(--color-primary)" : "var(--color-muted-foreground)",
      }}
    >
      {children}
    </button>
  );
}
