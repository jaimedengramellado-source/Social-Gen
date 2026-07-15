"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Bookmark, BookmarkCheck, ArrowRight,
  Plus, ArrowUp, ImageIcon, FileText, Clapperboard,
  Lightbulb, Anchor, TrendingUp, Sparkles, Calendar, Hash,
  Users, X, Check, ExternalLink, Loader2,
  Search, ChevronUp, ChevronDown, PanelRightOpen, PanelRightClose, History,
  Reply, Wand2, MonitorPlay, Smartphone, Briefcase, AlertTriangle, Folder,
  PenLine,
} from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Profile, Snippet } from "@/types";
import { uploadChatImage, uploadChatFile } from "@/lib/upload";
import { extractJSON } from "@/lib/utils";
import { UpgradeModal } from "@/components/shared/upgrade-modal";
import { PlatformPreviewModal } from "@/components/creator/platform-preview";

const CREATORS = [
  {
    id: "mrbeast",
    handle: "@mrbeast",
    name: "MrBeast",
    description: "Retos extremos · Stakes altos · Producción masiva",
    photo: "/creators/mrbeast.png",
    color: "#FF0000",
    initial: "M",
  },
  {
    id: "stevejobs",
    handle: "@stevejobs",
    name: "Steve Jobs",
    description: "Minimalismo · El porqué antes que el cómo · Reality distortion",
    photo: "/creators/stevejobs.jpg",
    color: "#555555",
    initial: "S",
  },
  {
    id: "traxnyc",
    handle: "@traxnyc",
    name: "TraxNYC",
    description: "Joyería · Lujo urbano · NYC Diamond District",
    photo: "/creators/traxnyc.webp",
    color: "#C9A84C",
    initial: "T",
  },
  {
    id: "collinskey",
    handle: "@collinskey",
    name: "Collins Key",
    description: "Formato corto viral · Trend-jacking en TikTok/Reels · Clips de millones de vistas",
    photo: "/creators/collinskey.jpg",
    color: "#00A8E8",
    initial: "C",
  },
];

type Creator = typeof CREATORS[number];

const CONTENT_FORMATS = [
  { id: "youtube_long", label: "YouTube (vídeo largo)", short: "YouTube", icon: MonitorPlay },
  { id: "shorts", label: "Reels, TikTok y Shorts", short: "Reels/TikTok/Short", icon: Smartphone },
  { id: "linkedin", label: "Post de LinkedIn", short: "LinkedIn", icon: Briefcase },
] as const;

type ContentFormat = typeof CONTENT_FORMATS[number]["id"];

// Estilos especiales para el flujo de LinkedIn: el modelo marca las 3 variantes de hook
// con un blockquote (">") y el post final con un fence ```linkedin-post``` para que se
// distingan visualmente en el chat (recuadro rojo vs. recuadro azul claro).
const markdownComponents: Components = {
  blockquote: ({ children }) => (
    <div
      className="not-prose my-3 rounded-xl border px-4 py-3 text-sm leading-relaxed text-[var(--color-foreground)] [&>*]:mt-3 [&>*:first-child]:mt-0 [&_strong]:font-semibold"
      style={{ borderColor: "var(--color-destructive)", backgroundColor: "rgba(220, 38, 38, 0.06)" }}
    >
      {children}
    </div>
  ),
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children, ...props }) => {
    // "titulos-miniaturas": bloque de títulos y miniaturas de la escaleta de YouTube largo,
    // mismo recuadro azul claro que el post de LinkedIn.
    if (className?.includes("language-linkedin-post") || className?.includes("language-titulos-miniaturas")) {
      return (
        <div
          className="not-prose my-3 whitespace-pre-wrap rounded-xl border px-4 py-3 font-sans text-sm leading-relaxed text-[var(--color-foreground)]"
          style={{ borderColor: "#BFDBFE", backgroundColor: "#EFF6FF" }}
        >
          {children}
        </div>
      );
    }
    // "guion": bloque de guion completo (FORMATO GUION COMPLETO). Cada párrafo separado
    // por línea en blanco es diálogo (se muestra entrecomillado en cursiva) salvo que esté
    // envuelto en [corchetes], en cuyo caso es una indicación visual y se muestra en un
    // recuadro aparte para que no se confunda con el texto hablado.
    if (className?.includes("language-guion")) {
      const raw = String(children).replace(/\n$/, "");
      const blocks = raw.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
      return (
        <div className="not-prose my-3 space-y-2.5">
          {blocks.map((block, i) => {
            const cue = block.match(/^\[([\s\S]+)\]$/);
            if (cue) {
              return (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs font-medium leading-relaxed"
                  style={{ backgroundColor: "var(--bg-info)", color: "var(--text-info)" }}
                >
                  <Clapperboard size={13} className="mt-0.5 flex-shrink-0" />
                  <span>{cue[1].trim()}</span>
                </div>
              );
            }
            const dialogue = block.replace(/^["“”']+|["“”']+$/g, "").trim();
            return (
              <p key={i} className="text-sm italic leading-relaxed text-[var(--color-foreground)]">
                &ldquo;{dialogue}&rdquo;
              </p>
            );
          })}
        </div>
      );
    }
    if (className) {
      return (
        <pre className="not-prose rounded-lg bg-[var(--color-muted)] px-3 py-2 overflow-x-auto text-xs">
          <code className={className} {...props}>{children}</code>
        </pre>
      );
    }
    return (
      <code className="rounded bg-[var(--color-muted)] px-1 py-0.5 text-xs" {...props}>{children}</code>
    );
  },
};

type Message = {
  role: "user" | "assistant";
  content: string;
  attachment?: { url: string; mime_type: string; name?: string };
  creatorId?: string;
  replyTo?: string;
};

type SelRect = { top: number; bottom: number; left: number; width: number };

function popoverPosition(rect: SelRect, estHeight: number, width: number): React.CSSProperties {
  const margin = 8;
  const placeAbove = rect.top - estHeight - margin > 8;
  const top = placeAbove ? rect.top - estHeight - margin : rect.bottom + margin;
  const centerLeft = rect.left + rect.width / 2;
  const left = Math.min(Math.max(centerLeft, width / 2 + margin), window.innerWidth - width / 2 - margin);
  return { position: "fixed", top, left, transform: "translateX(-50%)", zIndex: 60 };
}

// Finds the Range for `text` inside `container`, walking (and concatenating) text nodes so
// the match can span across markdown-generated elements (e.g. a <strong> boundary).
function findRangeForText(container: Element, text: string): Range | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes: { node: Text; start: number; end: number }[] = [];
  let full = "";
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const t = node as Text;
    const start = full.length;
    full += t.textContent ?? "";
    nodes.push({ node: t, start, end: full.length });
  }
  const idx = full.indexOf(text);
  if (idx === -1 || nodes.length === 0) return null;
  const endIdx = idx + text.length;
  const startEntry = nodes.find(n => idx >= n.start && idx < n.end);
  const endEntry = [...nodes].reverse().find(n => endIdx > n.start && endIdx <= n.end);
  if (!startEntry || !endEntry) return null;
  const range = document.createRange();
  range.setStart(startEntry.node, idx - startEntry.start);
  range.setEnd(endEntry.node, endIdx - endEntry.start);
  return range;
}

// Finds the smallest changed span between two markdown strings that are expected to be
// identical except for one edited fragment (the contract our modify-selection prompt
// enforces). Diffing client-side is more robust than trusting the model to echo back an
// exact copy of the new fragment in a separate field — those two fields can drift apart.
function diffNewFragment(oldStr: string, newStr: string): string {
  const maxStart = Math.min(oldStr.length, newStr.length);
  let start = 0;
  while (start < maxStart && oldStr[start] === newStr[start]) start++;
  let oldEnd = oldStr.length;
  let newEnd = newStr.length;
  while (oldEnd > start && newEnd > start && oldStr[oldEnd - 1] === newStr[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }
  return newStr.slice(start, newEnd).trim();
}

// Paints a fading highlight over `text` inside the given message container using the CSS
// Custom Highlight API — a pure paint-time overlay, so it can't corrupt React's DOM tree
// (unlike wrapping the match in a real <mark> element, which React's reconciler wouldn't
// know about and would fight with on the next re-render).
function flashModifiedText(msgIndex: number, text: string) {
  if (!text.trim() || typeof window === "undefined") return;
  const w = window as unknown as { Highlight?: new (...ranges: Range[]) => unknown };
  const css = CSS as unknown as { highlights?: Map<string, unknown> };
  if (!w.Highlight || !css.highlights) return;
  const container = document.querySelector(`[data-msg-index="${msgIndex}"][data-assistant-text="true"]`);
  if (!container) return;
  // The diffed fragment is raw markdown and may carry stray syntax (e.g. a lone "**") at
  // its edges if the edit landed mid-token — fall back to a markdown-stripped match.
  const range = findRangeForText(container, text) ?? findRangeForText(container, stripMarkdown(text).trim());
  if (!range) return;

  const HIGHLIGHT_NAME = "modify-flash";
  const highlight = new w.Highlight(range);
  css.highlights.set(HIGHLIGHT_NAME, highlight as never);

  const root = document.documentElement;
  const duration = 1400;
  const start = performance.now();
  function step(now: number) {
    const t = Math.min(1, (now - start) / duration);
    const pct = 45 * (1 - t);
    root.style.setProperty("--modify-flash-pct", `${pct}%`);
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      css.highlights?.delete(HIGHLIGHT_NAME);
      root.style.removeProperty("--modify-flash-pct");
    }
  }
  requestAnimationFrame(step);
}

type IdeaItem = {
  title: string;
  hook: string;
  content_style: string;
  viral_score: number;
  why_viral?: string;
  hook_type?: string;
  differentiator?: string;
};

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/\[(.+?)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`~]/g, "");
}

const GUIDED_SCRIPT_PROMPT = "__GUIDED_SCRIPT__";

function messagePlainText(msg: Message): string {
  if (msg.content === GUIDED_SCRIPT_PROMPT) return "Quiero crear un guion";
  if (msg.role !== "assistant") return msg.content;
  const ideas = parseIdeas(msg.content);
  if (ideas) return ideas.map(idea => `${idea.title} ${idea.hook}`).join(" — ");
  const question = parseQuestion(msg.content);
  if (question) return question.question;
  return stripMarkdown(msg.content);
}

const PLACEHOLDERS = [
  "Dame ideas para un vídeo de...",
  "¿Cómo hago viral un vídeo de...?",
  "Necesito un guion para...",
  "¿Qué funciona ahora en TikTok sobre...?",
];

const QUICK_ACTIONS = [
  { icon: Lightbulb,  label: "Ideas virales",   prompt: "Dame 5 ideas virales para mi nicho con hook fuerte." },
  { icon: FileText,   label: "Escribir guion",  prompt: "Escríbeme un guion corto para un vídeo de TikTok sobre..." },
  { icon: Anchor,     label: "Analizar hook",   prompt: "Analiza este hook y dime cómo mejorarlo: ..." },
  { icon: TrendingUp, label: "Estrategia",      prompt: "¿Qué estrategia me recomiendas para crecer en TikTok esta semana?" },
];

const QUICK_ACTIONS_EXTRA = [
  { icon: Sparkles, label: "Tendencias", prompt: "¿Qué está funcionando ahora mismo en mi nicho?" },
  { icon: Calendar, label: "Calendario", prompt: "Plantéame un calendario de publicación para los próximos 7 días." },
  { icon: Hash,     label: "Hashtags",   prompt: "Dame hashtags virales para un vídeo sobre..." },
];

const WELCOME_MESSAGES = [
  "¿Qué puedo hacer por ti?",
  "Vamos a aumentar tus seguidores",
  "¿Cuál es la idea de hoy?",
  "Tu próximo vídeo empieza aquí",
  "¿Listo para crear algo viral?",
  "Vamos a hacer crecer tu canal",
  "¿Por dónde empezamos?",
  "Cuéntame tu idea",
  "¿En qué te ayudo hoy?",
  "Hoy es buen día para publicar",
  "¿Cuál es el siguiente vídeo?",
  "Vamos a por ello",
];

function scoreColor(score: number) {
  if (score >= 75) return { bg: "#d1fae5", text: "#065f46", ring: "#10b981" };
  if (score >= 50) return { bg: "#fef3c7", text: "#92400e", ring: "#f59e0b" };
  return { bg: "#fee2e2", text: "#991b1b", ring: "#ef4444" };
}

type FolderItem = { id: string; name: string };

function IdeaCards({ ideas, onCreateScript }: { ideas: IdeaItem[]; onCreateScript?: (idea: { title: string; hook?: string }) => void }) {
  const [saved, setSaved] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then(r => r.json())
      .then(d => { if (d.projects) setFolders(d.projects); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (openMenu === null) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
        setCreatingFolder(false);
        setNewFolderName("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenu]);

  function toggleMenu(i: number) {
    if (saved[i]) return;
    setOpenMenu(prev => prev === i ? null : i);
    setCreatingFolder(false);
    setNewFolderName("");
  }

  async function handleSave(idea: IdeaItem, i: number, folderId?: string) {
    if (saved[i] || saving[i]) return;
    setSaving(s => ({ ...s, [i]: true }));
    try {
      await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: idea.title, hook: idea.hook, viral_score: idea.viral_score, content_style: idea.content_style, project_id: folderId }),
      });
      setSaved(s => ({ ...s, [i]: true }));
    } finally {
      setSaving(s => ({ ...s, [i]: false }));
      setOpenMenu(null);
      setCreatingFolder(false);
      setNewFolderName("");
    }
  }

  async function handleCreateFolderAndSave(idea: IdeaItem, i: number) {
    const name = newFolderName.trim();
    if (!name) return;
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (data.project) {
      setFolders(f => [data.project, ...f]);
      await handleSave(idea, i, data.project.id);
    }
  }

  return (
    <div className="space-y-3 w-full max-w-2xl">
      <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-1">
        Ideas generadas
      </p>
      {ideas.map((idea, i) => {
        const { bg, text, ring } = scoreColor(idea.viral_score);
        return (
          <div key={i} className="bg-white rounded-2xl border border-[var(--color-border)] p-4"
            style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm leading-snug" style={{ color: "var(--color-foreground)" }}>
                  {idea.title}
                </p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--color-muted-foreground)" }}>
                  {idea.hook}
                </p>
                {idea.why_viral && (
                  <p className="text-xs rounded-lg px-2.5 py-1.5 mt-2 leading-relaxed"
                    style={{ color: "var(--color-primary)", backgroundColor: "var(--color-primary-light)" }}>
                    {idea.why_viral}
                  </p>
                )}
              </div>
              {/* Viral score */}
              <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-black text-sm"
                style={{ backgroundColor: bg, color: text, boxShadow: `0 0 0 2px ${ring}` }}>
                {idea.viral_score}
              </div>
            </div>

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                {idea.hook_type && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: "var(--color-primary-light)", color: "var(--color-primary)" }}>
                    {idea.hook_type}
                  </span>
                )}
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "var(--color-muted)", color: "var(--color-muted-foreground)" }}>
                  {idea.content_style}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() => toggleMenu(i)}
                    disabled={saved[i] || saving[i]}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-60"
                    style={{
                      borderColor: "var(--color-border)",
                      color: saved[i] ? "var(--color-primary)" : "var(--color-muted-foreground)",
                      backgroundColor: saved[i] ? "var(--color-primary-light)" : "transparent",
                    }}
                  >
                    {saved[i] ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
                    {saving[i] ? "Guardando..." : saved[i] ? "Guardada" : "Guardar"}
                    {!saved[i] && !saving[i] && <ChevronDown size={10} />}
                  </button>

                  {openMenu === i && (
                    <div
                      ref={menuRef}
                      className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl border border-[var(--color-border)] overflow-hidden z-50"
                      style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)" }}
                    >
                      <button
                        onClick={() => handleSave(idea, i)}
                        className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-[var(--color-muted)] flex items-center gap-2"
                      >
                        <Bookmark size={12} /> Sin carpeta
                      </button>
                      {folders.length > 0 && <div className="h-px bg-[var(--color-border)]" />}
                      {folders.map(folder => (
                        <button
                          key={folder.id}
                          onClick={() => handleSave(idea, i, folder.id)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--color-muted)] truncate"
                        >
                          {folder.name}
                        </button>
                      ))}
                      <div className="h-px bg-[var(--color-border)]" />
                      {creatingFolder ? (
                        <div className="p-2 flex items-center gap-1">
                          <input
                            autoFocus
                            value={newFolderName}
                            onChange={e => setNewFolderName(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") handleCreateFolderAndSave(idea, i); }}
                            placeholder="Nombre de la carpeta"
                            className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-[var(--color-border)] focus:outline-none"
                          />
                          <button
                            onClick={() => handleCreateFolderAndSave(idea, i)}
                            className="p-1.5 rounded-lg"
                            style={{ color: "var(--color-primary)" }}
                          >
                            <Check size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setCreatingFolder(true)}
                          className="w-full text-left px-3 py-2 text-xs font-semibold flex items-center gap-2 hover:bg-[var(--color-muted)]"
                          style={{ color: "var(--color-primary)" }}
                        >
                          <Plus size={12} /> Nueva carpeta
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onCreateScript?.({ title: idea.title, hook: idea.hook })}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90"
                  style={{ backgroundColor: "var(--color-primary)" }}
                >
                  Crear guion <ArrowRight size={11} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MentionDropdown({ creators, selectedIndex, onSelect }: {
  creators: typeof CREATORS;
  selectedIndex: number;
  onSelect: (handle: string) => void;
}) {
  if (creators.length === 0) return null;
  return (
    <div
      className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden z-50"
      style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.04)" }}
    >
      <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest"
        style={{ color: "var(--color-muted-foreground)" }}>
        Estilo de creador
      </p>
      {creators.map((c, i) => (
        <button
          key={c.id}
          onMouseDown={e => { e.preventDefault(); onSelect(c.handle); }}
          className={`w-full flex items-center gap-3 px-4 py-2.5 pb-3 text-left transition-colors ${
            i === selectedIndex ? "bg-[var(--color-primary-light)]" : "hover:bg-[var(--color-muted)]"
          }`}
        >
          {c.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.photo} alt={c.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0"
              style={{ backgroundColor: c.color }}
            >
              {c.initial}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight" style={{ color: "var(--color-foreground)" }}>
              {c.handle}
              <span className="ml-1.5 text-xs font-normal" style={{ color: "var(--color-muted-foreground)" }}>
                {c.name}
              </span>
            </p>
            <p className="text-xs mt-0.5 truncate" style={{ color: "var(--color-muted-foreground)" }}>
              {c.description}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}

function TypingDots() {
  return (
    <div className="relative w-5 h-5 my-1.5 mx-1.5 animate-spin" style={{ animationDuration: "1.1s" }}>
      {[0, 1, 2].map(i => (
        <span key={i}
          className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full bg-[var(--color-muted-foreground)]"
          style={{ transform: `translate(-50%, -50%) rotate(${i * 120}deg) translateX(7px)` }}
        />
      ))}
    </div>
  );
}

function RotatingStatusText({ phrases, className, style }: { phrases: string[]; className?: string; style?: React.CSSProperties }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
    if (phrases.length <= 1) return;
    const interval = setInterval(() => {
      setIndex(i => (i + 1) % phrases.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [phrases]);

  return (
    <span className={`relative inline-grid ${className ?? ""}`} style={style}>
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="[grid-area:1/1]"
        >
          {phrases[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function AssistantAvatar({ creator }: { creator?: Creator | null }) {
  if (creator) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border flex-shrink-0 mb-0.5"
        style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
        {creator.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={creator.photo} alt={creator.name} className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: creator.color }} />
        )}
        <span className="text-xs font-semibold leading-none" style={{ color: "var(--color-foreground)" }}>
          {creator.name}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-baseline gap-[0.05em] px-2 py-1 rounded-lg border flex-shrink-0 mb-0.5"
      style={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)" }}>
      <span className="text-xs font-normal leading-none" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--color-foreground)" }}>Social</span>
      <span className="text-xs font-normal leading-none" style={{ fontFamily: "var(--font-instrument-serif)", fontStyle: "italic", color: "var(--color-primary)", letterSpacing: "-0.02em" }}>Flamingo</span>
    </div>
  );
}

type QuestionItem = {
  question: string;
  options: string[];
  allow_custom?: boolean;
  placeholder?: string;
};

function parseIdeas(content: string): IdeaItem[] | null {
  try {
    const cleaned = extractJSON(content);
    if (!cleaned) return null;
    const parsed = JSON.parse(cleaned);
    if (parsed.type === "ideas" && Array.isArray(parsed.ideas)) return parsed.ideas;
  } catch {}
  return null;
}

function parseQuestion(content: string): QuestionItem | null {
  try {
    const cleaned = extractJSON(content);
    if (!cleaned) return null;
    const parsed = JSON.parse(cleaned);
    if (parsed.type === "question" && typeof parsed.question === "string") return parsed as QuestionItem;
  } catch {}
  return null;
}

function looksLikeStructuredJSON(text: string): boolean {
  const t = text.trimStart();
  return t.startsWith("{") || t.startsWith("```");
}

function QuestionCard({ item, onAnswer }: { item: QuestionItem; onAnswer: (a: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const done = selected !== null;

  function pick(opt: string) {
    if (done) return;
    setSelected(opt);
    onAnswer(opt);
  }

  function submitCustom() {
    if (!custom.trim() || done) return;
    setSelected(custom.trim());
    onAnswer(custom.trim());
  }

  return (
    <div
      className="rounded-2xl border p-4 max-w-sm w-full"
      style={{ backgroundColor: "white", borderColor: "var(--color-border)", boxShadow: "var(--shadow-card)" }}
    >
      <p className="text-sm font-semibold mb-3" style={{ color: "var(--color-foreground)" }}>
        {item.question}
      </p>
      {item.options.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {item.options.map(opt => (
            <button
              key={opt}
              onClick={() => pick(opt)}
              disabled={done}
              className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all disabled:cursor-default"
              style={{
                borderColor: selected === opt ? "var(--color-primary)" : "var(--color-border)",
                backgroundColor: selected === opt ? "var(--color-primary)" : "var(--color-muted)",
                color: selected === opt ? "white" : "var(--color-foreground)",
                opacity: done && selected !== opt ? 0.4 : 1,
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
      {item.allow_custom && !done && (
        <div className="flex gap-2 mt-1">
          <input
            type="text"
            value={custom}
            onChange={e => setCustom(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submitCustom()}
            placeholder={item.placeholder ?? "Escribe tu respuesta..."}
            className="flex-1 text-xs px-3 py-2 rounded-xl outline-none border"
            style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-muted)" }}
          />
          <button
            onClick={submitCustom}
            disabled={!custom.trim()}
            className="px-3 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-30 transition-opacity"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg, msgIndex, streaming, onCreateScript, onExport, onAnswer, onPreview }: {
  msg: Message;
  msgIndex: number;
  streaming?: boolean;
  onCreateScript?: (idea: { title: string; hook?: string }) => void;
  onExport?: (content: string, title: string) => Promise<void>;
  onAnswer?: (answer: string) => void;
  onPreview?: (content: string) => void;
}) {
  const isUser = msg.role === "user";
  const creator = msg.creatorId ? CREATORS.find(c => c.id === msg.creatorId) ?? null : null;
  const [exportState, setExportState] = useState<"idle" | "exporting" | "done">("idle");

  async function handleBtnExport() {
    if (exportState !== "idle" || !onExport) return;
    setExportState("exporting");
    try {
      const firstLine = msg.content.split("\n").find(l => l.trim()) ?? "";
      const title = firstLine.replace(/^#+\s*/, "").slice(0, 80) || "Contenido generado";
      await onExport(msg.content, title);
      setExportState("done");
      setTimeout(() => setExportState("idle"), 3000);
    } catch {
      setExportState("idle");
    }
  }

  if (!isUser && !streaming) {
    const question = parseQuestion(msg.content);
    if (question) {
      return (
        <div className="flex items-end gap-2.5">
          <AssistantAvatar creator={creator} />
          <QuestionCard item={question} onAnswer={onAnswer ?? (() => {})} />
        </div>
      );
    }
    const ideas = parseIdeas(msg.content);
    if (ideas) {
      return (
        <div className="flex items-end gap-2.5">
          <AssistantAvatar creator={creator} />
          <IdeaCards ideas={ideas} onCreateScript={onCreateScript} />
        </div>
      );
    }
  }

  return (
    <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {!isUser && <AssistantAvatar creator={creator} />}
      {isUser ? (
        <div className="max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed text-white rounded-tr-sm"
          style={{ backgroundColor: "var(--color-primary)" }}>
          {msg.replyTo && (
            <div className="mb-2 px-2.5 py-1.5 rounded-lg border-l-2 border-white/40 bg-white/10 flex items-start gap-1.5">
              <Reply size={11} className="mt-0.5 flex-shrink-0 opacity-70" />
              <p className="text-xs opacity-80 line-clamp-2">{msg.replyTo}</p>
            </div>
          )}
          {msg.attachment?.mime_type.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={msg.attachment.url} alt="adjunto" className="rounded-xl max-w-full max-h-64 mb-2" />
          ) : msg.attachment ? (
            <div className="flex items-center gap-2 mb-2 px-2.5 py-1.5 rounded-xl bg-white/20">
              <FileText size={13} className="flex-shrink-0" />
              <span className="text-xs truncate">{msg.attachment.name || "Documento"}</span>
            </div>
          ) : null}
          {msg.content && msg.content !== "__GUIDED_SCRIPT__" && (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          )}
          {msg.content === "__GUIDED_SCRIPT__" && (
            <p className="whitespace-pre-wrap">Quiero crear un guion</p>
          )}
        </div>
      ) : (
        <div className="flex-1 min-w-0 pt-0.5 pr-4">
          <div
            className="text-sm leading-relaxed text-[var(--color-foreground)]"
            {...(!streaming ? { "data-assistant-text": "true", "data-msg-index": msgIndex } : {})}
          >
            <div className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{msg.content}</ReactMarkdown>
              {streaming && (
                <span className="inline-block w-0.5 h-3.5 bg-current ml-0.5 animate-pulse rounded-full" />
              )}
            </div>
          </div>
          {!streaming && !isUser && msg.content.length > 80 && (onExport || onPreview) && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {onExport && (
                <button
                  onClick={handleBtnExport}
                  disabled={exportState === "exporting"}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all hover:shadow-sm disabled:opacity-60"
                  style={{
                    borderColor: exportState === "done" ? "var(--color-success)" : "var(--color-border)",
                    color: exportState === "done" ? "var(--color-success)" : "var(--color-muted-foreground)",
                    backgroundColor: "white",
                  }}
                >
                  {exportState === "exporting" ? (
                    <><Loader2 size={11} className="animate-spin" /> Guardando...</>
                  ) : exportState === "done" ? (
                    <><Check size={11} /> Guardado en Documentos</>
                  ) : (
                    <><ExternalLink size={11} /> Exportar a Documentos</>
                  )}
                </button>
              )}
              {onPreview && (
                <button
                  onClick={() => onPreview(msg.content)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all hover:shadow-sm"
                  style={{
                    borderColor: "var(--color-border)",
                    color: "var(--color-muted-foreground)",
                    backgroundColor: "white",
                  }}
                >
                  <Smartphone size={11} /> Vista previa
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ChatInterfaceProps {
  profile: Profile;
  sessionId: string | null;
  initialMessages?: Message[];
  projectId?: string | null;
  projectName?: string | null;
  onSessionCreated: (id: string, title: string, messages: Message[], projectId: string | null) => void;
  onSessionUpdated: (id: string) => void;
  onOpenHistory?: () => void;
}

export function ChatInterface({ profile, sessionId, initialMessages, projectId, projectName, onSessionCreated, onSessionUpdated, onOpenHistory }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages ?? []);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [isStreamingJSON, setIsStreamingJSON] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [showMore, setShowMore] = useState(false);
  const [attachment, setAttachment] = useState<{ url: string; mime_type: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [snippets, setSnippets] = useState<Snippet[] | null>(null);
  const [contentFormat, setContentFormat] = useState<ContentFormat | null>(null);
  const [showFormatMenu, setShowFormatMenu] = useState(false);
  const [activeCreator, setActiveCreator] = useState<Creator | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [exportedDoc, setExportedDoc] = useState<{ id: string; title: string } | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [maxTokensHit, setMaxTokensHit] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [welcomeKey, setWelcomeKey] = useState(0);
  const [welcomeIdx, setWelcomeIdx] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const [highlightedMsgIndex, setHighlightedMsgIndex] = useState<number | null>(null);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [selToolbar, setSelToolbar] = useState<{ msgIndex: number; text: string; rect: SelRect } | null>(null);
  const [modifyPopover, setModifyPopover] = useState<{ msgIndex: number; text: string; rect: SelRect } | null>(null);
  const [modifyInstruction, setModifyInstruction] = useState("");
  const [modifyLoading, setModifyLoading] = useState(false);
  const [replyQuote, setReplyQuote] = useState<{ text: string } | null>(null);
  const [pendingFlash, setPendingFlash] = useState<{ msgIndex: number; text: string } | null>(null);
  const modifyPopoverRef = useRef<HTMLDivElement | null>(null);
  const isFirstSessionChange = useRef(true);
  const isEmpty = messages.length === 0 && !loading;
  const currentSessionId = useRef<string | null>(sessionId);
  const sessionTitleRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const skipNextScrollRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Whether the viewport should keep following new content. Turns off the moment the
  // user scrolls away from the bottom (e.g. to reread the start of a streaming reply),
  // so generation no longer yanks them back down; turns back on once they return to it.
  const pinnedToBottomRef = useRef(true);
  // Timestamp of when the user last scrolled away, so we require REACTIVATE_DELAY_MS of
  // "settled near the bottom" before resuming autoscroll — otherwise a reply mid-generation
  // fights the user's attempt to scroll up, re-pinning almost instantly.
  const scrolledAwayAtRef = useRef<number | null>(null);
  const reactivateTimeoutRef = useRef<number | undefined>(undefined);
  // True for a short window after a real wheel/touch gesture. Our own scrollIntoView calls
  // never fire wheel/touch events, so this is how the scroll handler tells "user scrolled"
  // apart from "we auto-scrolled" without racing against the smooth-scroll animation.
  const userInteractingRef = useRef(false);
  const userInteractingTimeoutRef = useRef<number | undefined>(undefined);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const formatMenuRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const highlightTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    setWelcomeIdx(Math.floor(Math.random() * WELCOME_MESSAGES.length));
  }, []);

  useEffect(() => {
    if (!exportedDoc) return;
    const t = setTimeout(() => setExportedDoc(null), 8000);
    return () => clearTimeout(t);
  }, [exportedDoc]);

  async function handleExportMessage(content: string, title: string): Promise<void> {
    const res = await fetch("/api/documents/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, title }),
    });
    if (!res.ok) throw new Error("Export failed");
    const data = await res.json() as { id: string; title: string };
    setExportedDoc(data);
  }

  function handleCreateScriptFromIdea(idea: { title: string; hook?: string }) {
    const lines = [
      "Escribe un guion completo listo para grabar para este vídeo:",
      "",
      `**${idea.title}**`,
      ...(idea.hook ? [`Hook de apertura sugerido: "${idea.hook}"`] : []),
      "",
      "Incluye: hook (0-3 segundos), intro que engancha, desarrollo con 2-3 bloques de contenido con timestamps, y CTA final potente.",
    ];
    send(lines.join("\n"));
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Solo se permiten imágenes."); return; }
    if (file.size > 5 * 1024 * 1024) { alert("Máximo 5 MB."); return; }
    setUploading(true);
    try {
      const { url, mime_type } = await uploadChatImage(file);
      setAttachment({ url, mime_type, name: file.name });
    } catch {
      alert("Error al subir la imagen.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDocSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert("Máximo 10 MB."); return; }
    setUploading(true);
    try {
      const { url, mime_type } = await uploadChatFile(file);
      setAttachment({ url, mime_type, name: file.name });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al subir el documento.");
    } finally {
      setUploading(false);
      if (docInputRef.current) docInputRef.current.value = "";
    }
  }

  useEffect(() => {
    currentSessionId.current = sessionId;
    sessionTitleRef.current = null;
    pinnedToBottomRef.current = true;
    scrolledAwayAtRef.current = null;
    window.clearTimeout(reactivateTimeoutRef.current);
    setMessages(initialMessages ?? []);
    setStreaming("");
    setMaxTokensHit(false);
    setActiveCreator(null);
    setContentFormat(null);
    setSearchOpen(false);
    setSearchQuery("");
    setSearchIndex(0);
    setHighlightedMsgIndex(null);
    setSelToolbar(null);
    setModifyPopover(null);
    setReplyQuote(null);
    setPendingFlash(null);
    if (!isFirstSessionChange.current) {
      setWelcomeKey(k => k + 1);
      setWelcomeIdx(i => (i + 1) % WELCOME_MESSAGES.length);
    }
    isFirstSessionChange.current = false;
  }, [sessionId, initialMessages]);

  function scrollToBottom(behavior: ScrollBehavior = "smooth") {
    if (!pinnedToBottomRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior });
  }

  const scrollListenerCleanupRef = useRef<(() => void) | null>(null);
  // Callback ref instead of useEffect(..., []): the message list only mounts once the
  // conversation isn't empty (see the isEmpty early return below), so a mount-effect with
  // an empty dependency array would find scrollRef.current still null and never attach —
  // this fires every time the actual DOM node appears/disappears instead.
  const setScrollRef = useCallback((el: HTMLDivElement | null) => {
    scrollListenerCleanupRef.current?.();
    scrollListenerCleanupRef.current = null;
    scrollRef.current = el;
    if (!el) return;

    const REACTIVATE_DELAY_MS = 2000;
    const INTERACTION_WINDOW_MS = 250;
    let lastScrollTop = el.scrollTop;
    let touchStartY = 0;
    let pointerHeld = false;

    function isNearBottom() {
      const el2 = scrollRef.current;
      return !!el2 && el2.scrollHeight - el2.scrollTop - el2.clientHeight < 120;
    }

    function markUserInteracting() {
      userInteractingRef.current = true;
      window.clearTimeout(userInteractingTimeoutRef.current);
      // While a pointer is held down (scrollbar drag, text selection) the interaction
      // has no natural end until pointerup, so don't let the window expire mid-drag.
      if (pointerHeld) return;
      userInteractingTimeoutRef.current = window.setTimeout(() => {
        userInteractingRef.current = false;
      }, INTERACTION_WINDOW_MS);
    }

    function maybeReactivate() {
      const awayAt = scrolledAwayAtRef.current;
      if (awayAt === null) return;
      if (Date.now() - awayAt < REACTIVATE_DELAY_MS) return;
      if (!isNearBottom()) return;
      pinnedToBottomRef.current = true;
      scrolledAwayAtRef.current = null;
    }

    function unpin() {
      if (!pinnedToBottomRef.current) return;
      pinnedToBottomRef.current = false;
      scrolledAwayAtRef.current = Date.now();
      window.clearTimeout(reactivateTimeoutRef.current);
      reactivateTimeoutRef.current = window.setTimeout(maybeReactivate, REACTIVATE_DELAY_MS);
    }

    // Unpin on the upward gesture itself instead of waiting to be >120px from the
    // bottom: while streaming re-anchors every ~30ms, a normal wheel/trackpad notch
    // never escapes that threshold before being yanked back down, so a distance-based
    // unpin makes scrolling up during generation nearly impossible.
    function onWheel(e: WheelEvent) {
      markUserInteracting();
      if (e.deltaY < 0) unpin();
    }

    function onTouchStart(e: TouchEvent) {
      markUserInteracting();
      touchStartY = e.touches[0]?.clientY ?? 0;
    }

    function onTouchMove(e: TouchEvent) {
      markUserInteracting();
      const y = e.touches[0]?.clientY ?? 0;
      if (y - touchStartY > 8) unpin();
    }

    function onPointerDown() {
      pointerHeld = true;
      markUserInteracting();
    }

    function onPointerUp() {
      pointerHeld = false;
      markUserInteracting();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "PageUp" || e.key === "ArrowUp" || e.key === "Home") {
        markUserInteracting();
      }
    }

    function onScroll() {
      const st = el!.scrollTop;
      const delta = st - lastScrollTop;
      lastScrollTop = st;
      // Ignore scroll events that aren't the direct result of a user gesture —
      // those are our own scrollIntoView calls, not the user trying to move around.
      if (!userInteractingRef.current) return;
      // Our autoscroll only ever moves down, so an upward delta during an interaction
      // is always the user — catches scrollbar drags and keyboard scrolling too.
      if (delta < 0) {
        unpin();
        return;
      }
      if (isNearBottom()) {
        maybeReactivate();
      } else if (pinnedToBottomRef.current) {
        unpin();
      }
    }

    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("pointerdown", onPointerDown, { passive: true });
    el.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
    el.addEventListener("scroll", onScroll, { passive: true });
    scrollListenerCleanupRef.current = () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("scroll", onScroll);
      window.clearTimeout(reactivateTimeoutRef.current);
      window.clearTimeout(userInteractingTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    // Editing a message in place (Modificar) shouldn't yank the viewport to the bottom —
    // the flash highlight already draws the eye to where the change happened.
    if (skipNextScrollRef.current) {
      skipNextScrollRef.current = false;
      return;
    }
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Instant, not smooth: this runs on every reveal tick (~30ms). A smooth scroll here
    // starts a browser-animated scroll that's still mid-flight several ticks later, so it
    // keeps fighting the user's own scroll-up gesture even after we've unpinned.
    if (!streaming) return;
    scrollToBottom("auto");
  }, [streaming]);

  useEffect(() => {
    const id = setInterval(() => setPlaceholderIdx(i => (i + 1) % PLACEHOLDERS.length), 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!showAttachMenu) return;
    function onDocClick(e: MouseEvent) {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showAttachMenu]);

  useEffect(() => {
    if (!showFormatMenu) return;
    function onDocClick(e: MouseEvent) {
      if (formatMenuRef.current && !formatMenuRef.current.contains(e.target as Node)) {
        setShowFormatMenu(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [showFormatMenu]);

  useEffect(() => {
    if (!searchOpen) return;
    function onDocClick(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [searchOpen]);

  useEffect(() => setSearchIndex(0), [searchQuery]);

  useEffect(() => {
    function handleSelection() {
      if (modifyPopover) return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) { setSelToolbar(null); return; }
      const text = sel.toString().trim();
      if (!text) { setSelToolbar(null); return; }
      const anchor = sel.anchorNode;
      const el = anchor instanceof Element ? anchor : anchor?.parentElement;
      const container = el?.closest('[data-assistant-text="true"]') as HTMLElement | null;
      if (!container) { setSelToolbar(null); return; }
      const msgIndex = Number(container.dataset.msgIndex);
      const domRect = sel.getRangeAt(0).getBoundingClientRect();
      if (domRect.width === 0 && domRect.height === 0) { setSelToolbar(null); return; }
      setSelToolbar({
        msgIndex,
        text,
        rect: { top: domRect.top, bottom: domRect.bottom, left: domRect.left, width: domRect.width },
      });
    }
    document.addEventListener("mouseup", handleSelection);
    document.addEventListener("keyup", handleSelection);
    return () => {
      document.removeEventListener("mouseup", handleSelection);
      document.removeEventListener("keyup", handleSelection);
    };
  }, [modifyPopover]);

  useEffect(() => {
    if (!modifyPopover) return;
    function onDocClick(e: MouseEvent) {
      if (modifyPopoverRef.current && !modifyPopoverRef.current.contains(e.target as Node)) {
        setModifyPopover(null);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [modifyPopover]);

  useEffect(() => {
    if (!pendingFlash) return;
    const { msgIndex, text } = pendingFlash;
    setPendingFlash(null);
    // Double rAF: wait for React to commit the new content and the browser to paint it
    // before searching the DOM for the replacement text.
    requestAnimationFrame(() => requestAnimationFrame(() => flashModifiedText(msgIndex, text)));
  }, [pendingFlash, messages]);

  async function applyModify() {
    if (!modifyPopover || modifyLoading) return;
    const { msgIndex, text } = modifyPopover;
    const original = messages[msgIndex];
    if (!original) { setModifyPopover(null); return; }
    setModifyLoading(true);
    try {
      const res = await fetch("/api/ai/modify-selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: original.content, selection: text, instruction: modifyInstruction.trim() }),
      });
      if (!res.ok) throw new Error("modify failed");
      const data = await res.json();
      if (typeof data.content === "string" && data.content.trim()) {
        const updated = messages.map((m, i) => (i === msgIndex ? { ...m, content: data.content } : m));
        skipNextScrollRef.current = true;
        setMessages(updated);
        const diffed = diffNewFragment(original.content, data.content);
        const fragment = diffed || (typeof data.replacement === "string" ? data.replacement.trim() : "");
        if (fragment) setPendingFlash({ msgIndex, text: fragment });
        // Close the popover now, in the same batch as the content update, so the flash
        // highlight is visible immediately instead of sitting hidden behind "Aplicando..."
        // for as long as the background persist call takes.
        setModifyPopover(null);
        setModifyInstruction("");
        if (currentSessionId.current) {
          fetch(`/api/chat/sessions/${currentSessionId.current}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: updated }),
          }).catch(() => {});
        }
      } else {
        setModifyPopover(null);
        setModifyInstruction("");
      }
    } catch {
      alert("No se pudo modificar el texto. Inténtalo de nuevo.");
    } finally {
      setModifyLoading(false);
    }
  }

  type SearchMatch = { msgIndex: number; snippet: string; highlightStart: number; highlightLen: number };

  const searchMatches = useMemo<SearchMatch[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results: SearchMatch[] = [];
    messages.forEach((msg, i) => {
      const plain = messagePlainText(msg);
      const idx = plain.toLowerCase().indexOf(q);
      if (idx === -1) return;
      const start = Math.max(0, idx - 28);
      const end = Math.min(plain.length, idx + q.length + 28);
      results.push({
        msgIndex: i,
        snippet: (start > 0 ? "…" : "") + plain.slice(start, end).replace(/\s+/g, " ").trim() + (end < plain.length ? "…" : ""),
        highlightStart: idx - start + (start > 0 ? 1 : 0),
        highlightLen: q.length,
      });
    });
    return results;
  }, [searchQuery, messages]);

  const clampedSearchIndex = Math.min(searchIndex, Math.max(searchMatches.length - 1, 0));

  const outlineEntries = useMemo(() => {
    return messages
      .map((msg, i) => ({ msg, i }))
      .filter(({ msg }) => msg.role === "user")
      .map(({ msg, i }) => {
        const raw = messagePlainText(msg).trim() || msg.attachment?.name || "Adjunto";
        return { msgIndex: i, label: raw.length > 50 ? raw.slice(0, 50) + "…" : raw };
      });
  }, [messages]);

  function jumpToMessage(index: number) {
    messageRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMsgIndex(index);
    if (highlightTimeoutRef.current) window.clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = window.setTimeout(() => setHighlightedMsgIndex(null), 1600);
  }

  function openSearch() {
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  }

  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchIndex(0);
  }

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") { e.preventDefault(); closeSearch(); return; }
    if (searchMatches.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSearchIndex(i => Math.min(i + 1, searchMatches.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSearchIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); jumpToMessage(searchMatches[clampedSearchIndex].msgIndex); }
  }

  const filteredCreators = mentionQuery !== null
    ? CREATORS.filter(c =>
        c.handle.slice(1).startsWith(mentionQuery) ||
        c.name.toLowerCase().includes(mentionQuery)
      )
    : [];

  function completeMention(handle: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const cursor = ta.selectionStart;
    const before = input.slice(0, cursor);
    const match = before.match(/@(\w*)$/);
    if (!match) return;
    const start = cursor - match[0].length;
    const newVal = input.slice(0, start) + handle + " " + input.slice(cursor);
    setInput(newVal);
    setMentionQuery(null);
    setTimeout(() => {
      const newCursor = start + handle.length + 1;
      ta.setSelectionRange(newCursor, newCursor);
      ta.focus();
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
    }, 0);
  }

  useEffect(() => {
    if (!showAttachMenu || snippets !== null) return;
    fetch("/api/snippets")
      .then(r => r.json())
      .then(data => setSnippets(Array.isArray(data) ? data : []))
      .catch(() => setSnippets([]));
  }, [showAttachMenu, snippets]);

  function renderSnippetsMenuSection() {
    if (snippets === null) return null;
    return (
      <>
        <div className="mx-3 my-1 border-t border-[var(--color-border)]" />
        <p className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-muted-foreground)" }}>
          <PenLine size={11} /> Firmas
        </p>
        {snippets.length === 0 ? (
          <a
            href="/ajustes?tab=ia"
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-[var(--color-muted)] transition-colors text-left"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            <Plus size={13} className="flex-shrink-0" />
            Crear firmas y CTAs en Ajustes
          </a>
        ) : (
          snippets.map(s => (
            <button
              key={s.id}
              onClick={() => insertSnippet(s.content)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-[var(--color-muted)] transition-colors text-left"
              style={{ color: "var(--color-foreground)" }}
              title={s.content}
            >
              <PenLine size={13} className="flex-shrink-0 text-[var(--color-muted-foreground)]" />
              <span className="flex-1 truncate">{s.name}</span>
            </button>
          ))
        )}
      </>
    );
  }

  function insertSnippet(content: string) {
    setShowAttachMenu(false);
    const ta = textareaRef.current;
    if (!ta) {
      setInput(prev => (prev ? `${prev}\n${content}` : content));
      return;
    }
    const start = ta.selectionStart ?? input.length;
    const end = ta.selectionEnd ?? input.length;
    const before = input.slice(0, start);
    const after = input.slice(end);
    const sep = before && !/[\s\n]$/.test(before) ? "\n" : "";
    const next = before + sep + content + after;
    setInput(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = (before + sep + content).length;
      ta.setSelectionRange(pos, pos);
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
    });
  }

  async function send(content: string) {
    if ((!content.trim() && !attachment) || loading) return;
    setMentionQuery(null);
    const userMsg: Message = {
      role: "user",
      content: content.trim(),
      ...(attachment ? { attachment: { url: attachment.url, mime_type: attachment.mime_type, name: attachment.name } } : {}),
      ...(replyQuote ? { replyTo: replyQuote.text } : {}),
    };
    const history = [...messages, userMsg];
    pinnedToBottomRef.current = true;
    scrolledAwayAtRef.current = null;
    window.clearTimeout(reactivateTimeoutRef.current);
    setMessages(history);
    setInput("");
    setReplyQuote(null);
    setLoading(true);
    setStreaming("");
    setIsStreamingJSON(false);
    setIsThinking(false);
    setMaxTokensHit(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    let revealId: number | undefined;
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, creatorMode: activeCreator?.id ?? null, contentFormat }),
      });

      if (!res.ok || !res.body) {
        if (res.status === 402) {
          setShowUpgrade(true);
          return;
        }
        const errorText =
          res.status === 429
            ? "Demasiadas peticiones seguidas. Espera un momento e inténtalo de nuevo."
            : "Error al conectar. Inténtalo de nuevo.";
        setMessages(prev => [...prev, { role: "assistant", content: errorText }]);
        return;
      }

      let full = "";
      let cleanFull = "";
      let revealIdx = 0;
      let networkDone = false;
      let pendingDocExport: { id: string; title: string } | null = null;
      let revealResolve!: () => void;
      const revealComplete = new Promise<void>(r => { revealResolve = r; });

      // Reveal word by word (up to 8 chars per tick) at 30ms.
      // Uses cleanFull once available so the __DOC_EXPORT__ marker never appears.
      // Time-based: background tabs throttle setInterval to ≥1s, so each tick
      // advances by elapsed time — at 30ms per step — instead of one fixed step;
      // así la escritura no se congela al cambiar de ventana y se pone al día sola.
      const REVEAL_TICK_MS = 30;
      let lastTick = performance.now();
      revealId = window.setInterval(() => {
        const text = cleanFull || full;
        const now = performance.now();
        const steps = Math.max(1, Math.round((now - lastTick) / REVEAL_TICK_MS));
        lastTick = now;
        if (revealIdx < text.length) {
          for (let s = 0; s < steps && revealIdx < text.length; s++) {
            let next = revealIdx + 1;
            while (next < text.length && text[next] !== " " && text[next] !== "\n" && next - revealIdx < 8) {
              next++;
            }
            revealIdx = next;
          }
          setStreaming(text.slice(0, revealIdx));
        } else if (networkDone) {
          window.clearInterval(revealId);
          revealResolve();
        }
      }, REVEAL_TICK_MS);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const THINKING_START = "\n__THINKING_START__";
      const THINKING_END = "\n__THINKING_END__";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });

        // Model is reasoning before answering — show a "pensando" state and strip the
        // marker so it never renders as part of the message.
        const thinkingStartIdx = full.indexOf(THINKING_START);
        if (thinkingStartIdx !== -1) {
          full = full.slice(0, thinkingStartIdx) + full.slice(thinkingStartIdx + THINKING_START.length);
          setIsThinking(true);
        }
        const thinkingEndIdx = full.indexOf(THINKING_END);
        if (thinkingEndIdx !== -1) {
          full = full.slice(0, thinkingEndIdx) + full.slice(thinkingEndIdx + THINKING_END.length);
          setIsThinking(false);
        }

        // If AI output text before a tool call, discard everything and restart
        const rollbackIdx = full.indexOf("\n__ROLLBACK__");
        if (rollbackIdx !== -1) {
          full = full.slice(rollbackIdx + "\n__ROLLBACK__".length);
          revealIdx = 0;
          setStreaming("");
          setIsStreamingJSON(false);
        }
        if (looksLikeStructuredJSON(full)) setIsStreamingJSON(true);
      }

      // Process export marker before revealing completes
      networkDone = true;
      const MAX_TOKENS_MARKER = "\n__MAX_TOKENS__";
      const maxTokIdx = full.indexOf(MAX_TOKENS_MARKER);
      let hitMaxTokens = false;
      if (maxTokIdx !== -1) {
        full = full.slice(0, maxTokIdx) + full.slice(maxTokIdx + MAX_TOKENS_MARKER.length);
        hitMaxTokens = true;
        if (revealIdx > full.length) revealIdx = full.length;
      }
      const DOC_EXPORT_MARKER = "\n__DOC_EXPORT__:";
      const markerIdx = full.indexOf(DOC_EXPORT_MARKER);
      if (markerIdx !== -1) {
        try { pendingDocExport = JSON.parse(full.slice(markerIdx + DOC_EXPORT_MARKER.length)); } catch {}
        cleanFull = full.slice(0, markerIdx);
        if (revealIdx > markerIdx) revealIdx = markerIdx;
      } else {
        cleanFull = full;
      }

      await revealComplete;

      const displayContent = cleanFull;
      const finalMessages = [
        ...history,
        { role: "assistant" as const, content: displayContent, ...(activeCreator ? { creatorId: activeCreator.id } : {}) },
      ];
      // Batch all three in one render: clear bubble, stop loading, show committed message
      setStreaming("");
      setLoading(false);
      setMessages(finalMessages);
      if (pendingDocExport) setExportedDoc(pendingDocExport);
      if (hitMaxTokens) setMaxTokensHit(true);
      await saveSession(finalMessages, content.trim());
    } catch {
      // Fallo de red o stream interrumpido: sin esto la promesa quedaría rechazada
      // sin manejar y el usuario no vería ningún feedback.
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Se ha perdido la conexión mientras se generaba la respuesta. Inténtalo de nuevo." }]);
    } finally {
      if (revealId !== undefined) window.clearInterval(revealId);
      setLoading(false);
      setStreaming("");
      setIsStreamingJSON(false);
      setIsThinking(false);
      setAttachment(null);
    }
  }

  function continueTruncated() {
    setMaxTokensHit(false);
    send("Tu última respuesta se ha cortado por el límite de longitud. Continúa EXACTAMENTE desde donde te quedaste, sin repetir nada de lo ya escrito, y divide lo que falte en varios mensajes: cuando un mensaje vaya a quedar demasiado largo, córtalo en un punto natural y termina ofreciendo continuar en el siguiente.");
  }

  async function saveSession(finalMessages: Message[], firstUserMessage: string) {
    if (!currentSessionId.current) {
      const raw = firstUserMessage.trim();
      // El flujo "Guiado" manda el sentinel __GUIDED_SCRIPT__ como primer mensaje; sin esto
      // el chat aparecería en la barra lateral titulado con ese texto interno. Y un primer
      // mensaje solo con imagen deja el título vacío, así que caemos al mismo default del server.
      const base = raw === GUIDED_SCRIPT_PROMPT ? "Guion guiado" : raw;
      const title = (base.length > 45 ? base.slice(0, 45) + "…" : base) || "Nueva conversación";
      sessionTitleRef.current = title;
      const res = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, messages: finalMessages, project_id: projectId ?? null }),
      });
      const data = await res.json();
      if (data.session) {
        currentSessionId.current = data.session.id;
        onSessionCreated(data.session.id, title, finalMessages, projectId ?? null);
      }
    } else {
      await fetch(`/api/chat/sessions/${currentSessionId.current}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: finalMessages }),
      });
      onSessionUpdated(currentSessionId.current);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery !== null && filteredCreators.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, filteredCreators.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return; }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        completeMention(filteredCreators[mentionIndex].handle);
        return;
      }
      if (e.key === "Escape") { setMentionQuery(null); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  function onInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setInput(val);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";

    const cursor = e.target.selectionStart ?? val.length;
    const before = val.slice(0, cursor);
    const match = before.match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1].toLowerCase());
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  }

  if (isEmpty) {
    return (
      <div className="relative flex flex-col items-center justify-center h-full px-4 md:px-6 pb-16 md:pb-0">
        {onOpenHistory && (
          <button
            onClick={onOpenHistory}
            title="Historial de chats"
            className="absolute top-2 left-0 w-7 h-7 rounded-full flex md:hidden items-center justify-center border shadow-sm transition-colors hover:bg-[var(--color-muted)]"
            style={{ background: "var(--color-background)", borderColor: "var(--color-border)", color: "var(--color-muted-foreground)" }}
            aria-label="Historial de chats"
          >
            <History size={14} />
          </button>
        )}
        {projectName && (
          <motion.div
            key={`badge-${welcomeKey}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center gap-2 mb-5 px-4 py-2 rounded-full border"
            style={{ backgroundColor: "var(--color-primary-light)", borderColor: "rgba(140,34,48,0.2)" }}
          >
            <Folder size={13} color="var(--color-primary)" />
            <span className="text-sm font-medium" style={{ color: "var(--color-primary)" }}>
              {projectName}
            </span>
          </motion.div>
        )}
        <motion.h1
          key={welcomeKey}
          initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: projectName ? 0.1 : 0 }}
          className="text-3xl md:text-5xl text-center mb-6 md:mb-10 tracking-tight"
          style={{
            fontFamily: "var(--font-instrument-serif)",
            color: "var(--color-foreground)",
          }}
        >
          {WELCOME_MESSAGES[welcomeIdx]}
        </motion.h1>

        <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleFileSelect} />
        <input type="file" ref={docInputRef} accept=".pdf,.txt,.md,.doc,.docx,.csv" className="hidden" onChange={handleDocSelect} />

        <div className="relative w-full max-w-2xl">
          {mentionQuery !== null && filteredCreators.length > 0 && (
            <MentionDropdown creators={filteredCreators} selectedIndex={mentionIndex} onSelect={completeMention} />
          )}
          {activeCreator && (
            <div className="flex items-center gap-2.5 px-4 py-2 mb-2 rounded-2xl border"
              style={{ backgroundColor: "var(--color-primary-light)", borderColor: "rgba(140,34,48,0.25)" }}>
              {activeCreator.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={activeCreator.photo} alt={activeCreator.name} className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: activeCreator.color }} />
              )}
              <p className="flex-1 text-xs font-medium" style={{ color: "var(--color-primary)" }}>
                Creando con <span className="font-bold">{activeCreator.name}</span> · sus respuestas sonarán como él
              </p>
              <button
                onClick={() => setActiveCreator(null)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold hover:bg-white/60 transition-colors"
                style={{ color: "var(--color-primary)" }}
              >
                <X size={10} /> Salir
              </button>
            </div>
          )}
        <div className="bg-white rounded-3xl border border-[var(--color-border)] shadow-sm transition-shadow focus-within:border-[var(--color-muted-foreground)] focus-within:shadow-md">
          {attachment && (
            <div className="px-5 pt-4 flex items-center gap-2">
              {attachment.mime_type.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={attachment.url} alt="preview" className="w-12 h-12 rounded-lg object-cover border border-[var(--color-border)]" />
              ) : (
                <div className="w-12 h-12 rounded-lg border border-[var(--color-border)] flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "var(--color-muted)" }}>
                  <FileText size={18} className="text-[var(--color-muted-foreground)]" />
                </div>
              )}
              <span className="text-xs text-[var(--color-muted-foreground)] truncate flex-1">{attachment.name}</span>
              <button onClick={() => setAttachment(null)} className="text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]" aria-label="Quitar adjunto">✕</button>
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={onInput}
            onKeyDown={onKeyDown}
            placeholder="Asigna una tarea o pregunta cualquier cosa"
            rows={3}
            className="w-full px-5 pt-5 pb-2 text-sm outline-none bg-transparent resize-none leading-relaxed"
            style={{ maxHeight: 200, scrollbarWidth: "none" }}
          />
          <div className="flex items-center justify-between px-3 pb-3">
            <div className="flex items-center gap-2">
            <div ref={attachMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setShowAttachMenu(v => !v)}
                disabled={uploading}
                className="relative w-9 h-9 rounded-full border border-[var(--color-border)] flex items-center justify-center hover:bg-[var(--color-muted)] transition-colors disabled:opacity-40"
                aria-label="Adjuntar"
              >
                <Plus size={16} className="text-[var(--color-muted-foreground)]" />
                {activeCreator && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white"
                    style={{ backgroundColor: activeCreator.color }} />
                )}
              </button>
              {showAttachMenu && (
                <div className="absolute bottom-full left-0 mb-2 bg-white rounded-xl border border-[var(--color-border)] shadow-lg py-1 min-w-[200px] z-20">
                  <button
                    onClick={() => { setShowAttachMenu(false); fileInputRef.current?.click(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-[var(--color-muted)] transition-colors text-left"
                    style={{ color: "var(--color-foreground)" }}
                  >
                    <ImageIcon size={13} className="flex-shrink-0 text-[var(--color-muted-foreground)]" />
                    Imagen
                  </button>
                  <button
                    onClick={() => { setShowAttachMenu(false); docInputRef.current?.click(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-[var(--color-muted)] transition-colors text-left"
                    style={{ color: "var(--color-foreground)" }}
                  >
                    <FileText size={13} className="flex-shrink-0 text-[var(--color-muted-foreground)]" />
                    Documento
                  </button>
                  <button
                    onClick={() => { setShowAttachMenu(false); send(GUIDED_SCRIPT_PROMPT); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-[var(--color-primary-light)] transition-colors text-left font-semibold"
                    style={{ color: "var(--color-primary)" }}
                  >
                    <Clapperboard size={13} className="flex-shrink-0" />
                    Guiado
                  </button>
                  {renderSnippetsMenuSection()}
                  <div className="mx-3 my-1 border-t border-[var(--color-border)]" />
                  <p className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-muted-foreground)" }}>
                    <Users size={11} /> Crear con creador
                  </p>
                  {CREATORS.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setActiveCreator(prev => prev?.id === c.id ? null : c); setShowAttachMenu(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-[var(--color-muted)] transition-colors text-left"
                      style={{ color: "var(--color-foreground)" }}
                    >
                      {c.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.photo} alt={c.name} className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                      )}
                      <span className="flex-1">{c.name}</span>
                      {activeCreator?.id === c.id && <Check size={12} style={{ color: "var(--color-primary)" }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div ref={formatMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setShowFormatMenu(v => !v)}
                className="flex items-center gap-1 h-7 px-2 rounded-full border transition-colors text-[11px] font-medium"
                style={{
                  borderColor: contentFormat ? "var(--color-primary)" : "var(--color-border)",
                  color: contentFormat ? "var(--color-primary)" : "var(--color-muted-foreground)",
                  backgroundColor: contentFormat ? "var(--color-primary-light)" : "transparent",
                }}
                aria-label="Formato de contenido"
              >
                {(() => { const F = CONTENT_FORMATS.find(f => f.id === contentFormat)?.icon ?? Clapperboard; return <F size={12} />; })()}
                <span className="hidden sm:inline">
                  {contentFormat ? CONTENT_FORMATS.find(f => f.id === contentFormat)?.short : "Formato"}
                </span>
                <ChevronDown size={10} />
              </button>
              {showFormatMenu && (
                <div className="absolute bottom-full left-0 mb-2 bg-white rounded-xl border border-[var(--color-border)] shadow-lg py-1 min-w-[220px] z-20">
                  {CONTENT_FORMATS.map(f => (
                    <button
                      key={f.id}
                      onClick={() => { setContentFormat(prev => prev === f.id ? null : f.id); setShowFormatMenu(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-[var(--color-muted)] transition-colors text-left"
                      style={{ color: "var(--color-foreground)" }}
                    >
                      <f.icon size={13} className="flex-shrink-0 text-[var(--color-muted-foreground)]" />
                      <span className="flex-1">{f.label}</span>
                      {contentFormat === f.id && <Check size={12} style={{ color: "var(--color-primary)" }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            </div>
            <button
              onClick={() => send(input)}
              disabled={(!input.trim() && !attachment) || loading}
              className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-30 hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "var(--color-foreground)" }}
              aria-label="Enviar"
            >
              <ArrowUp size={16} className="text-white" />
            </button>
          </div>
        </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 mt-6 max-w-2xl">
          {QUICK_ACTIONS.map(({ label, icon: Icon, prompt }) => (
            <button
              key={label}
              onClick={() => send(prompt)}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--color-border)] bg-white text-sm transition-all duration-150 hover:shadow-md hover:-translate-y-0.5"
            >
              <Icon size={14} className="text-[var(--color-muted-foreground)]" />
              {label}
            </button>
          ))}
        </div>

        {!showMore ? (
          <button
            onClick={() => setShowMore(true)}
            className="mt-2 px-4 py-2 rounded-full border border-[var(--color-border)] bg-transparent text-sm text-[var(--color-muted-foreground)] transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 hover:bg-white"
          >
            Más
          </button>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2 max-w-2xl">
            {QUICK_ACTIONS_EXTRA.map(({ label, icon: Icon, prompt }) => (
              <button
                key={label}
                onClick={() => send(prompt)}
                className="flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--color-border)] bg-white text-sm transition-all duration-150 hover:shadow-md hover:-translate-y-0.5"
              >
                <Icon size={14} className="text-[var(--color-muted-foreground)]" />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full gap-3">
    <div className="flex flex-col h-full flex-1 min-w-0">

      {/* Search + outline toggle */}
      <div className="flex items-center justify-end gap-1.5 mb-2 flex-shrink-0">
        {onOpenHistory && (
          <button
            onClick={onOpenHistory}
            title="Historial de chats"
            className="w-7 h-7 rounded-full flex md:hidden items-center justify-center border shadow-sm transition-colors hover:bg-[var(--color-muted)] flex-shrink-0 mr-auto"
            style={{ background: "var(--color-background)", borderColor: "var(--color-border)", color: "var(--color-muted-foreground)" }}
            aria-label="Historial de chats"
          >
            <History size={14} />
          </button>
        )}
        <div
          ref={searchContainerRef}
          className="flex items-center gap-1.5 relative"
          style={{ flex: searchOpen ? 1 : "0 0 auto", minWidth: 0 }}
        >
          {searchOpen && (
            <div className="flex-1 min-w-0 relative">
              <div className="flex items-center gap-2 bg-white rounded-full border border-[var(--color-border)] pl-3.5 pr-2 py-1.5 shadow-sm focus-within:border-[var(--color-muted-foreground)]">
                  <Search size={13} className="text-[var(--color-muted-foreground)] flex-shrink-0" />
                  <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={onSearchKeyDown}
                    placeholder="Buscar en esta conversación..."
                    className="flex-1 text-xs outline-none bg-transparent min-w-0"
                  />
                  {searchQuery && (
                    <span className="text-[10px] text-[var(--color-muted-foreground)] flex-shrink-0 tabular-nums">
                      {searchMatches.length > 0 ? `${clampedSearchIndex + 1}/${searchMatches.length}` : "0/0"}
                    </span>
                  )}
                  {searchMatches.length > 1 && (
                    <div className="flex items-center flex-shrink-0">
                      <button
                        onClick={() => setSearchIndex(i => Math.max(i - 1, 0))}
                        disabled={clampedSearchIndex === 0}
                        className="p-1 rounded-full hover:bg-[var(--color-muted)] disabled:opacity-30 transition-colors"
                        aria-label="Resultado anterior"
                      >
                        <ChevronUp size={12} />
                      </button>
                      <button
                        onClick={() => setSearchIndex(i => Math.min(i + 1, searchMatches.length - 1))}
                        disabled={clampedSearchIndex === searchMatches.length - 1}
                        className="p-1 rounded-full hover:bg-[var(--color-muted)] disabled:opacity-30 transition-colors"
                        aria-label="Siguiente resultado"
                      >
                        <ChevronDown size={12} />
                      </button>
                    </div>
                  )}
                  <button onClick={closeSearch} className="p-1 rounded-full hover:bg-[var(--color-muted)] flex-shrink-0 transition-colors" aria-label="Cerrar búsqueda">
                    <X size={12} className="text-[var(--color-muted-foreground)]" />
                  </button>
                </div>

                {searchQuery && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl border border-[var(--color-border)] shadow-lg overflow-hidden z-20 max-h-64 overflow-y-auto">
                    {searchMatches.length === 0 ? (
                      <p className="px-3.5 py-2.5 text-xs text-[var(--color-muted-foreground)]">Sin resultados</p>
                    ) : (
                      searchMatches.map((m, i) => (
                        <button
                          key={`${m.msgIndex}-${i}`}
                          onClick={() => jumpToMessage(m.msgIndex)}
                          className={`w-full text-left px-3.5 py-2 text-xs transition-colors ${i === clampedSearchIndex ? "bg-[var(--color-primary-light)]" : "hover:bg-[var(--color-muted)]"}`}
                        >
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                            {messages[m.msgIndex].role === "user" ? "Tú" : "Social Flamingo"}
                          </span>
                          <p className="mt-0.5 text-[var(--color-foreground)] line-clamp-1">
                            {m.snippet.slice(0, m.highlightStart)}
                            <mark className="bg-[var(--color-primary-light)] text-[var(--color-primary)] rounded-sm px-0.5">
                              {m.snippet.slice(m.highlightStart, m.highlightStart + m.highlightLen)}
                            </mark>
                            {m.snippet.slice(m.highlightStart + m.highlightLen)}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => (searchOpen ? closeSearch() : openSearch())}
              title="Buscar en el chat"
              className="w-7 h-7 rounded-full flex items-center justify-center border shadow-sm transition-colors hover:bg-[var(--color-muted)] flex-shrink-0"
              style={{ background: "var(--color-background)", borderColor: "var(--color-border)", color: searchOpen ? "var(--color-primary)" : "var(--color-muted-foreground)" }}
              aria-label="Buscar en el chat"
            >
              <Search size={14} />
            </button>
          </div>
          <button
            onClick={() => setOutlineOpen(v => !v)}
            title={outlineOpen ? "Ocultar índice" : "Mostrar índice"}
            className="w-7 h-7 rounded-full items-center justify-center border shadow-sm transition-colors hover:bg-[var(--color-muted)] flex-shrink-0 hidden lg:flex"
            style={{ background: "var(--color-background)", borderColor: "var(--color-border)", color: outlineOpen ? "var(--color-primary)" : "var(--color-muted-foreground)" }}
            aria-label={outlineOpen ? "Ocultar índice" : "Mostrar índice"}
          >
            {outlineOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
          </button>
        </div>

      {/* Messages area */}
      <div ref={setScrollRef} className="flex-1 overflow-y-auto overflow-x-hidden space-y-6 pb-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            ref={el => { messageRefs.current[i] = el; }}
            className="rounded-xl transition-colors duration-700 -mx-2 px-2"
            style={{ backgroundColor: highlightedMsgIndex === i ? "var(--color-primary-light)" : "transparent" }}
          >
            <MessageBubble msg={msg} msgIndex={i} onCreateScript={handleCreateScriptFromIdea} onExport={handleExportMessage} onAnswer={send} onPreview={setPreviewContent} />
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-3">
            <AssistantAvatar creator={activeCreator} />
            {isThinking ? (
              <div className="pt-0.5 flex items-center gap-2">
                <TypingDots />
                <RotatingStatusText
                  className="text-sm"
                  style={{ color: "var(--color-muted-foreground)" }}
                  phrases={[
                    "Pensando la mejor respuesta...",
                    "Analizando el contexto...",
                    "Conectando ideas...",
                    "Afinando el enfoque...",
                    "Casi listo...",
                  ]}
                />
              </div>
            ) : streaming && !isStreamingJSON ? (
              <div className="flex-1 min-w-0 text-sm leading-relaxed text-[var(--color-foreground)] pt-0.5 pr-4">
                <div className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{streaming}</ReactMarkdown>
                  <span className="inline-block w-0.5 h-3.5 bg-current ml-0.5 animate-pulse rounded-full" />
                </div>
              </div>
            ) : isStreamingJSON ? (
              <div className="space-y-3 w-full max-w-2xl">
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "var(--color-muted-foreground)" }}>
                  <RotatingStatusText
                    phrases={[
                      "Generando ideas...",
                      "Explorando ángulos...",
                      "Puliendo los hooks...",
                      "Casi listo...",
                    ]}
                  />
                </p>
                {[0, 1, 2].map(i => (
                  <div key={i} className="bg-white rounded-2xl border border-[var(--color-border)] p-4 animate-pulse">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 rounded-full w-4/5" style={{ backgroundColor: "var(--color-muted)" }} />
                        <div className="h-2.5 rounded-full w-full" style={{ backgroundColor: "var(--color-muted)" }} />
                        <div className="h-2.5 rounded-full w-3/4" style={{ backgroundColor: "var(--color-muted)" }} />
                      </div>
                      <div className="w-10 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: "var(--color-muted)" }} />
                    </div>
                    <div className="h-7 rounded-lg w-2/3 mt-3" style={{ backgroundColor: "var(--color-muted)" }} />
                    <div className="flex items-center justify-between mt-3">
                      <div className="h-4 rounded-full w-16" style={{ backgroundColor: "var(--color-muted)" }} />
                      <div className="h-7 rounded-lg w-24" style={{ backgroundColor: "var(--color-muted)" }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="pt-0.5">
                <TypingDots />
              </div>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Aviso de respuesta truncada por el tope de tokens */}
      {maxTokensHit && (
        <div className="flex justify-center px-4 py-2 flex-shrink-0">
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-md text-sm max-w-md w-full"
            style={{ borderColor: "#FDE68A", backgroundColor: "#FFFBEB" }}>
            <AlertTriangle size={16} className="flex-shrink-0" style={{ color: "#B45309" }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold" style={{ color: "#78350F" }}>La respuesta se ha cortado</p>
              <p className="text-[11px]" style={{ color: "#92400E" }}>Ha alcanzado el límite de longitud por mensaje.</p>
            </div>
            <button
              onClick={continueTruncated}
              disabled={loading}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              Continuar en varios mensajes
            </button>
            <button
              onClick={() => setMaxTokensHit(false)}
              className="flex-shrink-0 hover:opacity-70 transition-opacity"
              aria-label="Cerrar"
            >
              <X size={12} style={{ color: "#92400E" }} />
            </button>
          </div>
        </div>
      )}

      {/* Export notification */}
      {exportedDoc && (
        <div className="flex justify-center px-4 py-2 flex-shrink-0">
          <div className="flex items-center gap-2.5 px-4 py-2 bg-white rounded-full border shadow-md text-sm max-w-sm w-full"
            style={{ borderColor: "var(--color-border)" }}>
            <Check size={13} className="flex-shrink-0" style={{ color: "var(--color-success)" }} />
            <span className="flex-1 truncate text-xs" style={{ color: "var(--color-foreground)" }}>
              Guardado en Documentos
            </span>
            <a
              href={`/documentos/${exportedDoc.id}`}
              className="text-xs font-semibold hover:underline flex-shrink-0"
              style={{ color: "var(--color-primary)" }}
            >
              Abrir →
            </a>
            <button
              onClick={() => setExportedDoc(null)}
              className="flex-shrink-0 hover:opacity-70 transition-opacity"
              aria-label="Cerrar"
            >
              <X size={12} style={{ color: "var(--color-muted-foreground)" }} />
            </button>
          </div>
        </div>
      )}

      {/* Creator mode banner */}
      {activeCreator && (
        <div className="flex items-center gap-2.5 px-4 py-2 border-t border-[var(--color-border)] flex-shrink-0"
          style={{ backgroundColor: "var(--color-primary-light)" }}>
          {activeCreator.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={activeCreator.photo} alt={activeCreator.name} className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: activeCreator.color }} />
          )}
          <p className="flex-1 text-xs font-medium" style={{ color: "var(--color-primary)" }}>
            Hablando con <span className="font-bold">{activeCreator.name}</span> · el creador ha tomado el chat
          </p>
          <button
            onClick={() => setActiveCreator(null)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors hover:bg-white/60"
            style={{ color: "var(--color-primary)" }}
            aria-label="Salir del modo creador"
          >
            <X size={11} /> Salir
          </button>
        </div>
      )}

      {/* Input bar */}
      <div className="pt-3 pb-16 md:pb-0 border-t border-[var(--color-border)] flex-shrink-0">
        <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleFileSelect} />
        <input type="file" ref={docInputRef} accept=".pdf,.txt,.md,.doc,.docx,.csv" className="hidden" onChange={handleDocSelect} />
        <div className="relative">
          {mentionQuery !== null && filteredCreators.length > 0 && (
            <MentionDropdown creators={filteredCreators} selectedIndex={mentionIndex} onSelect={completeMention} />
          )}
        <div className="bg-white rounded-2xl border border-[var(--color-border)] shadow-sm transition-shadow focus-within:border-[var(--color-muted-foreground)] focus-within:shadow-md">
          {replyQuote && (
            <div className="px-4 pt-3 flex items-start gap-2">
              <div className="flex-1 min-w-0 flex items-start gap-1.5 px-3 py-1.5 rounded-lg border-l-2"
                style={{ borderColor: "var(--color-primary)", backgroundColor: "var(--color-muted)" }}>
                <Reply size={12} className="mt-0.5 flex-shrink-0" style={{ color: "var(--color-primary)" }} />
                <p className="text-xs line-clamp-2 flex-1" style={{ color: "var(--color-muted-foreground)" }}>{replyQuote.text}</p>
              </div>
              <button onClick={() => setReplyQuote(null)} className="p-1 rounded-full hover:bg-[var(--color-muted)] flex-shrink-0" aria-label="Quitar cita">
                <X size={12} className="text-[var(--color-muted-foreground)]" />
              </button>
            </div>
          )}
          {attachment && (
            <div className="px-4 pt-3 flex items-center gap-2">
              {attachment.mime_type.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={attachment.url} alt="preview" className="w-10 h-10 rounded-lg object-cover border border-[var(--color-border)]" />
              ) : (
                <div className="w-10 h-10 rounded-lg border border-[var(--color-border)] flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "var(--color-muted)" }}>
                  <FileText size={15} className="text-[var(--color-muted-foreground)]" />
                </div>
              )}
              <span className="text-xs text-[var(--color-muted-foreground)] truncate flex-1">{attachment.name}</span>
              <button onClick={() => setAttachment(null)} className="text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]" aria-label="Quitar adjunto">✕</button>
            </div>
          )}
          <div className="flex items-end gap-3 px-4 py-3">
            <div ref={attachMenuRef} className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowAttachMenu(v => !v)}
                disabled={uploading}
                className="relative w-8 h-8 rounded-full border border-[var(--color-border)] flex items-center justify-center hover:bg-[var(--color-muted)] transition-colors disabled:opacity-40"
                aria-label="Adjuntar"
              >
                <Plus size={14} className="text-[var(--color-muted-foreground)]" />
                {activeCreator && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white"
                    style={{ backgroundColor: activeCreator.color }} />
                )}
              </button>
              {showAttachMenu && (
                <div className="absolute bottom-full left-0 mb-2 bg-white rounded-xl border border-[var(--color-border)] shadow-lg py-1 min-w-[200px] z-20">
                  <button
                    onClick={() => { setShowAttachMenu(false); fileInputRef.current?.click(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-[var(--color-muted)] transition-colors text-left"
                    style={{ color: "var(--color-foreground)" }}
                  >
                    <ImageIcon size={13} className="flex-shrink-0 text-[var(--color-muted-foreground)]" />
                    Imagen
                  </button>
                  <button
                    onClick={() => { setShowAttachMenu(false); docInputRef.current?.click(); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-[var(--color-muted)] transition-colors text-left"
                    style={{ color: "var(--color-foreground)" }}
                  >
                    <FileText size={13} className="flex-shrink-0 text-[var(--color-muted-foreground)]" />
                    Documento
                  </button>
                  <button
                    onClick={() => { setShowAttachMenu(false); send(GUIDED_SCRIPT_PROMPT); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-[var(--color-primary-light)] transition-colors text-left font-semibold"
                    style={{ color: "var(--color-primary)" }}
                  >
                    <Clapperboard size={13} className="flex-shrink-0" />
                    Guiado
                  </button>
                  {renderSnippetsMenuSection()}
                  <div className="mx-3 my-1 border-t border-[var(--color-border)]" />
                  <p className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-muted-foreground)" }}>
                    <Users size={11} /> Crear con creador
                  </p>
                  {CREATORS.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setActiveCreator(prev => prev?.id === c.id ? null : c); setShowAttachMenu(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-[var(--color-muted)] transition-colors text-left"
                      style={{ color: "var(--color-foreground)" }}
                    >
                      {c.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.photo} alt={c.name} className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                      )}
                      <span className="flex-1">{c.name}</span>
                      {activeCreator?.id === c.id && <Check size={12} style={{ color: "var(--color-primary)" }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div ref={formatMenuRef} className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowFormatMenu(v => !v)}
                className="flex items-center gap-1 h-7 px-2 rounded-full border transition-colors text-[11px] font-medium"
                style={{
                  borderColor: contentFormat ? "var(--color-primary)" : "var(--color-border)",
                  color: contentFormat ? "var(--color-primary)" : "var(--color-muted-foreground)",
                  backgroundColor: contentFormat ? "var(--color-primary-light)" : "transparent",
                }}
                aria-label="Formato de contenido"
              >
                {(() => { const F = CONTENT_FORMATS.find(f => f.id === contentFormat)?.icon ?? Clapperboard; return <F size={12} />; })()}
                <span className="hidden sm:inline">
                  {contentFormat ? CONTENT_FORMATS.find(f => f.id === contentFormat)?.short : "Formato"}
                </span>
                <ChevronDown size={10} />
              </button>
              {showFormatMenu && (
                <div className="absolute bottom-full left-0 mb-2 bg-white rounded-xl border border-[var(--color-border)] shadow-lg py-1 min-w-[220px] z-20">
                  {CONTENT_FORMATS.map(f => (
                    <button
                      key={f.id}
                      onClick={() => { setContentFormat(prev => prev === f.id ? null : f.id); setShowFormatMenu(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-[var(--color-muted)] transition-colors text-left"
                      style={{ color: "var(--color-foreground)" }}
                    >
                      <f.icon size={13} className="flex-shrink-0 text-[var(--color-muted-foreground)]" />
                      <span className="flex-1">{f.label}</span>
                      {contentFormat === f.id && <Check size={12} style={{ color: "var(--color-primary)" }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={onInput}
              onKeyDown={onKeyDown}
              placeholder={PLACEHOLDERS[placeholderIdx]}
              rows={1}
              className="flex-1 text-sm outline-none bg-transparent resize-none leading-relaxed transition-all duration-500"
              style={{ maxHeight: 200, scrollbarWidth: "none" }}
            />
            <button
              onClick={() => send(input)}
              disabled={(!input.trim() && !attachment) || loading}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white flex-shrink-0 disabled:opacity-30 transition-opacity"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              <Send size={13} />
            </button>
          </div>
        </div>
        </div>
        <div className="hidden md:flex items-center justify-end mt-2 px-1 pb-1">
          <p className="text-[10px] text-[var(--color-muted-foreground)]">
            Enter para enviar · Shift+Enter para nueva línea
          </p>
        </div>
      </div>
    </div>

    {outlineOpen && (
      <aside
        className="hidden lg:flex flex-col w-56 flex-shrink-0 h-full pl-3 py-1 rounded-l-xl"
        style={{ background: "var(--color-card)", boxShadow: "-4px 0 12px rgba(0,0,0,0.05), -1px 0 2px rgba(0,0,0,0.04)" }}
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] px-1 pb-2 flex-shrink-0">
          En este chat
        </p>
        <div className="flex-1 overflow-y-auto space-y-0.5" style={{ scrollbarWidth: "none" }}>
          {outlineEntries.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-[var(--color-muted-foreground)]">Aún no hay mensajes</p>
          ) : (
            outlineEntries.map(entry => (
              <button
                key={entry.msgIndex}
                onClick={() => jumpToMessage(entry.msgIndex)}
                className={`w-full text-left px-2 py-1.5 rounded-lg text-xs leading-snug transition-colors line-clamp-2 ${
                  highlightedMsgIndex === entry.msgIndex
                    ? "bg-[var(--color-primary-light)] text-[var(--color-primary)]"
                    : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                }`}
              >
                {entry.label}
              </button>
            ))
          )}
        </div>
      </aside>
    )}

    {selToolbar && !modifyPopover && createPortal(
      <div
        style={popoverPosition(selToolbar.rect, 42, 170)}
        className="flex items-center gap-0.5 bg-[var(--color-foreground)] text-white rounded-full shadow-lg px-1 py-1"
      >
        <button
          onMouseDown={e => e.preventDefault()}
          onClick={() => {
            setReplyQuote({ text: selToolbar.text });
            setSelToolbar(null);
            window.getSelection()?.removeAllRanges();
            textareaRef.current?.focus();
          }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium hover:bg-white/15 transition-colors"
        >
          <Reply size={12} /> Responder
        </button>
        <div className="w-px h-4 bg-white/20" />
        <button
          onMouseDown={e => e.preventDefault()}
          onClick={() => {
            setModifyPopover({ msgIndex: selToolbar.msgIndex, text: selToolbar.text, rect: selToolbar.rect });
            setModifyInstruction("");
            setSelToolbar(null);
          }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium hover:bg-white/15 transition-colors"
        >
          <Wand2 size={12} /> Modificar
        </button>
      </div>,
      document.body
    )}

    {modifyPopover && createPortal(
      <div
        ref={modifyPopoverRef}
        style={popoverPosition(modifyPopover.rect, 168, 288)}
        className="w-72 bg-white rounded-2xl border border-[var(--color-border)] shadow-lg p-3"
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-1.5">
          Modificar selección
        </p>
        <p className="text-xs italic mb-2 line-clamp-2" style={{ color: "var(--color-muted-foreground)" }}>
          &quot;{modifyPopover.text}&quot;
        </p>
        <textarea
          autoFocus
          value={modifyInstruction}
          onChange={e => setModifyInstruction(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); applyModify(); }
            if (e.key === "Escape") { e.preventDefault(); setModifyPopover(null); }
          }}
          placeholder="Instrucciones (opcional)... o déjalo en blanco para mejorarlo"
          rows={2}
          disabled={modifyLoading}
          className="w-full text-xs px-2.5 py-2 rounded-xl border border-[var(--color-border)] outline-none resize-none mb-2 focus:border-[var(--color-muted-foreground)] disabled:opacity-60"
        />
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setModifyPopover(null)}
            disabled={modifyLoading}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-[var(--color-muted)] disabled:opacity-40"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            Cancelar
          </button>
          <button
            onClick={applyModify}
            disabled={modifyLoading}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-60 transition-opacity"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            {modifyLoading ? <><Loader2 size={12} className="animate-spin" /> Aplicando...</> : "Aplicar"}
          </button>
        </div>
      </div>,
      document.body
    )}

    {previewContent && (
      <PlatformPreviewModal
        content={previewContent}
        channelName={profile.channel_name}
        onClose={() => setPreviewContent(null)}
      />
    )}

    <UpgradeModal
      open={showUpgrade}
      onClose={() => setShowUpgrade(false)}
      creditsRemaining={profile.credits_remaining}
      plan={profile.plan}
    />
    </div>
  );
}
