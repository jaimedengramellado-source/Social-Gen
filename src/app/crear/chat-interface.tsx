"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send, Bookmark, BookmarkCheck, ArrowRight,
  Plus, ArrowUp,
  Lightbulb, FileText, Anchor, TrendingUp, Sparkles, Calendar, Hash,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Profile } from "@/types";
import { uploadChatImage } from "@/lib/upload";

type Message = {
  role: "user" | "assistant";
  content: string;
  attachment?: { url: string; mime_type: string };
};

type IdeaItem = {
  title: string;
  hook: string;
  content_style: string;
  viral_score: number;
};

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

function IdeaCards({ ideas, onCreateScript }: { ideas: IdeaItem[]; onCreateScript?: (title: string) => void }) {
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
              </div>
              {/* Viral score */}
              <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-black text-sm"
                style={{ backgroundColor: bg, color: text, boxShadow: `0 0 0 2px ${ring}` }}>
                {idea.viral_score}
              </div>
            </div>

            <div className="flex items-center justify-between mt-3">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "var(--color-muted)", color: "var(--color-muted-foreground)" }}>
                {idea.content_style}
              </span>
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
                  onClick={() => onCreateScript?.(idea.title)}
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

function AssistantAvatar() {
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
    const trimmed = content.trim();
    if (!trimmed.startsWith("{")) return null;
    const parsed = JSON.parse(trimmed);
    if (parsed.type === "ideas" && Array.isArray(parsed.ideas)) return parsed.ideas;
  } catch {}
  return null;
}

function MessageBubble({ msg, streaming, onCreateScript }: {
  msg: Message;
  streaming?: boolean;
  onCreateScript?: (title: string) => void;
}) {
  const isUser = msg.role === "user";

  if (!isUser && !streaming) {
    const ideas = parseIdeas(msg.content);
    if (ideas) {
      return (
        <div className="flex items-end gap-2.5">
          <AssistantAvatar />
          <IdeaCards ideas={ideas} onCreateScript={onCreateScript} />
        </div>
      );
    }
  }

  return (
    <div className={`flex items-end gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      {!isUser && <AssistantAvatar />}
      <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
        isUser
          ? "text-white rounded-br-sm"
          : "bg-white border border-[var(--color-border)] text-[var(--color-foreground)] rounded-bl-sm"
      }`}
        style={isUser ? { backgroundColor: "var(--color-primary)" } : {}}>
        {isUser ? (
          <>
            {msg.attachment?.mime_type.startsWith("image/") && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={msg.attachment.url} alt="adjunto" className="rounded-xl max-w-full max-h-64 mb-2" />
            )}
            <p className="whitespace-pre-wrap">{msg.content}</p>
          </>
        ) : (
          <div className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
            {streaming && (
              <span className="inline-block w-0.5 h-3.5 bg-current ml-0.5 animate-pulse rounded-full" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface ChatInterfaceProps {
  profile: Profile;
  sessionId: string | null;
  initialMessages?: Message[];
  onSessionCreated: (id: string, title: string, messages: Message[]) => void;
  onSessionUpdated: (id: string, title: string) => void;
  onCreateScript?: (title: string) => void;
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
  const currentSessionId = useRef<string | null>(sessionId);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    currentSessionId.current = sessionId;
    setMessages(initialMessages ?? []);
    setStreaming("");
  }, [sessionId, initialMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  useEffect(() => {
    const id = setInterval(() => setPlaceholderIdx(i => (i + 1) % PLACEHOLDERS.length), 3000);
    return () => clearInterval(id);
  }, []);

  async function send(content: string) {
    if (!content.trim() || loading) return;
    const userMsg: Message = {
      role: "user",
      content: content.trim(),
      ...(attachment ? { attachment: { url: attachment.url, mime_type: attachment.mime_type } } : {}),
    };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setLoading(true);
    setStreaming("");
    setIsStreamingJSON(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok || !res.body) {
        setMessages(prev => [...prev, { role: "assistant", content: "Error al conectar. Inténtalo de nuevo." }]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        const looksLikeJSON = full.trimStart().startsWith("{");
        setIsStreamingJSON(looksLikeJSON);
        if (!looksLikeJSON) setStreaming(full);
      }

      const finalMessages = [...history, { role: "assistant" as const, content: full }];
      setMessages(finalMessages);
      await saveSession(finalMessages, content.trim());
    } finally {
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  function onInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
  }

  const isEmpty = messages.length === 0 && !loading;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6">
        <h1
          className="text-4xl md:text-5xl text-center mb-10 tracking-tight"
          style={{
            fontFamily: "var(--font-instrument-serif)",
            color: "var(--color-foreground)",
          }}
        >
          ¿Qué puedo hacer por ti?
        </h1>

        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />

        <div className="w-full max-w-2xl bg-white rounded-3xl border border-[var(--color-border)] shadow-sm transition-shadow focus-within:border-[var(--color-muted-foreground)] focus-within:shadow-md">
          {attachment && (
            <div className="px-5 pt-4 flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={attachment.url} alt="preview" className="w-12 h-12 rounded-lg object-cover border border-[var(--color-border)]" />
              <span className="text-xs text-[var(--color-muted-foreground)] truncate flex-1">{attachment.name}</span>
              <button
                onClick={() => setAttachment(null)}
                className="text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                aria-label="Quitar adjunto"
              >
                ✕
              </button>
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
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-9 h-9 rounded-full border border-[var(--color-border)] flex items-center justify-center hover:bg-[var(--color-muted)] transition-colors disabled:opacity-40"
              aria-label="Adjuntar archivo"
            >
              <Plus size={16} className="text-[var(--color-muted-foreground)]" />
            </button>
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-30 hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "var(--color-foreground)" }}
              aria-label="Enviar"
            >
              <ArrowUp size={16} className="text-white" />
            </button>
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
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} onCreateScript={onCreateScript} />
        ))}

        {loading && (
          <div className="flex items-end gap-2.5">
            <AssistantAvatar />
            {streaming && !isStreamingJSON ? (
              <div className="max-w-[78%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm leading-relaxed bg-white border border-[var(--color-border)]">
                <div className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{streaming}</ReactMarkdown>
                  <span className="inline-block w-0.5 h-3.5 bg-current ml-0.5 animate-pulse rounded-full" />
                </div>
              </div>
            ) : (
              <div className="bg-white border border-[var(--color-border)] rounded-2xl rounded-bl-sm px-4 py-2">
                {isStreamingJSON
                  ? <p className="text-sm text-[var(--color-muted-foreground)]">Generando ideas...</p>
                  : <TypingDots />
                }
              </div>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="pt-3 border-t border-[var(--color-border)] flex-shrink-0">
        <div className="bg-white rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden transition-shadow focus-within:border-[var(--color-muted-foreground)] focus-within:shadow-md">
          <div className="flex items-end gap-3 px-4 py-3">
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
              disabled={!input.trim() || loading}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white flex-shrink-0 disabled:opacity-30 transition-opacity"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              <Send size={13} />
            </button>
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
