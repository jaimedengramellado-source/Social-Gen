"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send, Bookmark, BookmarkCheck, ArrowRight,
  Plus, ArrowUp, ImageIcon, FileText,
  Lightbulb, Anchor, TrendingUp, Sparkles, Calendar, Hash,
  Users, X, Check,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Profile } from "@/types";
import { uploadChatImage, uploadChatFile } from "@/lib/upload";
import { extractJSON } from "@/lib/utils";

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
];

type Creator = typeof CREATORS[number];

type Message = {
  role: "user" | "assistant";
  content: string;
  attachment?: { url: string; mime_type: string; name?: string };
  creatorId?: string;
};

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

function scoreColor(score: number) {
  if (score >= 75) return { bg: "#d1fae5", text: "#065f46", ring: "#10b981" };
  if (score >= 50) return { bg: "#fef3c7", text: "#92400e", ring: "#f59e0b" };
  return { bg: "#fee2e2", text: "#991b1b", ring: "#ef4444" };
}

function IdeaCards({ ideas, onCreateScript }: { ideas: IdeaItem[]; onCreateScript?: (idea: { title: string; hook?: string }) => void }) {
  const [saved, setSaved] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});

  async function handleSave(idea: IdeaItem, i: number) {
    if (saved[i] || saving[i]) return;
    setSaving(s => ({ ...s, [i]: true }));
    try {
      await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: idea.title, hook: idea.hook, viral_score: idea.viral_score, content_style: idea.content_style }),
      });
      setSaved(s => ({ ...s, [i]: true }));
    } finally {
      setSaving(s => ({ ...s, [i]: false }));
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
                <button
                  onClick={() => handleSave(idea, i)}
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
                </button>
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
    <div className="flex items-center gap-1 px-1 py-2">
      {[0, 1, 2].map(i => (
        <span key={i}
          className="w-2 h-2 rounded-full bg-[var(--color-muted-foreground)] animate-bounce"
          style={{ animationDelay: `${i * 140}ms` }}
        />
      ))}
    </div>
  );
}

function AssistantAvatar({ creator }: { creator?: Creator | null }) {
  if (creator) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border flex-shrink-0 mb-0.5"
        style={{ backgroundColor: "var(--color-background)", borderColor: "var(--color-border)" }}>
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
      style={{ backgroundColor: "var(--color-background)", borderColor: "var(--color-border)" }}>
      <span className="text-xs font-normal leading-none" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--color-foreground)" }}>Social</span>
      <span className="text-xs font-normal leading-none" style={{ fontFamily: "var(--font-instrument-serif)", fontStyle: "italic", color: "var(--color-primary)", letterSpacing: "-0.02em" }}>Gen</span>
    </div>
  );
}

function parseIdeas(content: string): IdeaItem[] | null {
  try {
    const cleaned = extractJSON(content);
    if (!cleaned) return null;
    const parsed = JSON.parse(cleaned);
    if (parsed.type === "ideas" && Array.isArray(parsed.ideas)) return parsed.ideas;
  } catch {}
  return null;
}

function looksLikeIdeasJSON(text: string): boolean {
  const t = text.trimStart();
  return t.startsWith("{") || t.startsWith("```");
}

function MessageBubble({ msg, streaming, onCreateScript }: {
  msg: Message;
  streaming?: boolean;
  onCreateScript?: (idea: { title: string; hook?: string }) => void;
}) {
  const isUser = msg.role === "user";
  const creator = msg.creatorId ? CREATORS.find(c => c.id === msg.creatorId) ?? null : null;

  if (!isUser && !streaming) {
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
          {msg.attachment?.mime_type.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={msg.attachment.url} alt="adjunto" className="rounded-xl max-w-full max-h-64 mb-2" />
          ) : msg.attachment ? (
            <div className="flex items-center gap-2 mb-2 px-2.5 py-1.5 rounded-xl bg-white/20">
              <FileText size={13} className="flex-shrink-0" />
              <span className="text-xs truncate">{msg.attachment.name || "Documento"}</span>
            </div>
          ) : null}
          {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}
        </div>
      ) : (
        <div className="flex-1 min-w-0 text-sm leading-relaxed text-[var(--color-foreground)] pt-0.5 pr-4">
          <div className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
            {streaming && (
              <span className="inline-block w-0.5 h-3.5 bg-current ml-0.5 animate-pulse rounded-full" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface ChatInterfaceProps {
  profile: Profile;
  sessionId: string | null;
  initialMessages?: Message[];
  onSessionCreated: (id: string, title: string, messages: Message[]) => void;
  onSessionUpdated: (id: string, title: string) => void;
  onCreateScript?: (idea: { title: string; hook?: string }) => void;
}

export function ChatInterface({ profile, sessionId, initialMessages, onSessionCreated, onSessionUpdated, onCreateScript }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages ?? []);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [isStreamingJSON, setIsStreamingJSON] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [showMore, setShowMore] = useState(false);
  const [attachment, setAttachment] = useState<{ url: string; mime_type: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [activeCreator, setActiveCreator] = useState<Creator | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const currentSessionId = useRef<string | null>(sessionId);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

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
    setMessages(initialMessages ?? []);
    setStreaming("");
  }, [sessionId, initialMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!streaming) return;
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
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

  async function send(content: string) {
    if ((!content.trim() && !attachment) || loading) return;
    setMentionQuery(null);
    const userMsg: Message = {
      role: "user",
      content: content.trim(),
      ...(attachment ? { attachment: { url: attachment.url, mime_type: attachment.mime_type, name: attachment.name } } : {}),
    };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setLoading(true);
    setStreaming("");
    setIsStreamingJSON(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    let revealId: number | undefined;
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, creatorMode: activeCreator?.id ?? null }),
      });

      if (!res.ok || !res.body) {
        setMessages(prev => [...prev, { role: "assistant", content: "Error al conectar. Inténtalo de nuevo." }]);
        return;
      }

      let full = "";
      let revealIdx = 0;
      let networkDone = false;
      let revealResolve!: () => void;
      const revealComplete = new Promise<void>(r => { revealResolve = r; });

      // Reveal word by word (up to 8 chars per tick) at 30ms — smooth within paragraphs
      revealId = window.setInterval(() => {
        if (revealIdx < full.length) {
          let next = revealIdx + 1;
          while (next < full.length && full[next] !== " " && full[next] !== "\n" && next - revealIdx < 8) {
            next++;
          }
          revealIdx = next;
          setStreaming(full.slice(0, revealIdx));
        } else if (networkDone) {
          window.clearInterval(revealId);
          revealResolve();
        }
      }, 30);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        if (looksLikeIdeasJSON(full)) setIsStreamingJSON(true);
      }

      networkDone = true;
      await revealComplete; // let interval drain remaining text naturally

      const finalMessages = [
        ...history,
        { role: "assistant" as const, content: full, ...(activeCreator ? { creatorId: activeCreator.id } : {}) },
      ];
      // Batch all three in one render: clear bubble, stop loading, show committed message
      setStreaming("");
      setLoading(false);
      setMessages(finalMessages);
      await saveSession(finalMessages, content.trim());
    } finally {
      if (revealId !== undefined) window.clearInterval(revealId);
      setLoading(false);
      setStreaming("");
      setIsStreamingJSON(false);
      setAttachment(null);
    }
  }

  async function saveSession(finalMessages: Message[], firstUserMessage: string) {
    const title = firstUserMessage.length > 45
      ? firstUserMessage.slice(0, 45) + "…"
      : firstUserMessage;

    if (!currentSessionId.current) {
      const res = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, messages: finalMessages }),
      });
      const data = await res.json();
      if (data.session) {
        currentSessionId.current = data.session.id;
        onSessionCreated(data.session.id, title, finalMessages);
      }
    } else {
      await fetch(`/api/chat/sessions/${currentSessionId.current}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: finalMessages }),
      });
      onSessionUpdated(currentSessionId.current, title);
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

  const isEmpty = messages.length === 0 && !loading;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 md:px-6 pb-16 md:pb-0">
        <h1
          className="text-3xl md:text-5xl text-center mb-6 md:mb-10 tracking-tight"
          style={{
            fontFamily: "var(--font-instrument-serif)",
            color: "var(--color-foreground)",
          }}
        >
          ¿Qué puedo hacer por ti?
        </h1>

        <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleFileSelect} />
        <input type="file" ref={docInputRef} accept=".pdf,.txt,.md,.doc,.docx,.csv" className="hidden" onChange={handleDocSelect} />

        <div className="relative w-full max-w-2xl">
          {mentionQuery !== null && filteredCreators.length > 0 && (
            <MentionDropdown creators={filteredCreators} selectedIndex={mentionIndex} onSelect={completeMention} />
          )}
          {activeCreator && (
            <div className="flex items-center gap-2.5 px-4 py-2 mb-2 rounded-2xl border"
              style={{ backgroundColor: "var(--color-primary-light)", borderColor: "rgba(124,58,237,0.25)" }}>
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
    <div className="flex flex-col h-full">

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-6 pb-4">
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} onCreateScript={onCreateScript} />
        ))}

        {loading && (
          <div className="flex items-start gap-3">
            <AssistantAvatar creator={activeCreator} />
            {streaming && !isStreamingJSON ? (
              <div className="flex-1 min-w-0 text-sm leading-relaxed text-[var(--color-foreground)] pt-0.5 pr-4">
                <p className="whitespace-pre-wrap m-0">{stripMarkdown(streaming)}</p>
                <span className="inline-block w-0.5 h-3.5 bg-current ml-0.5 animate-pulse rounded-full" />
              </div>
            ) : isStreamingJSON ? (
              <div className="space-y-3 w-full max-w-2xl">
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "var(--color-muted-foreground)" }}>
                  Generando ideas...
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
        <div className="bg-white rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden transition-shadow focus-within:border-[var(--color-muted-foreground)] focus-within:shadow-md">
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
        <div className="flex items-center justify-end mt-2 px-1 pb-1">
          <p className="text-[10px] text-[var(--color-muted-foreground)]">
            Enter para enviar · Shift+Enter para nueva línea
          </p>
        </div>
      </div>
    </div>
  );
}
