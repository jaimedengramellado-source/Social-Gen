"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { PlatformSelector } from "@/components/creator/platform-selector";
import { IdeaCard } from "@/components/creator/idea-card";
import { HookComparator } from "@/components/creator/hook-comparator";
import { ScriptSection } from "@/components/creator/script-section";
import { ViralScoreBadge } from "@/components/creator/viral-score-badge";
import { UpgradeModal } from "@/components/shared/upgrade-modal";
import { ChatInterface } from "./chat-interface";
import { ChatSidebar } from "./chat-sidebar";
import type { ChatSession } from "./chat-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Share2, BookmarkPlus, Check, Sparkles, ListChecks } from "lucide-react";
import type { Platform, Idea, Script, Channel, Profile, HookVariants } from "@/types";

type Mode = "guided" | "chat";
type Step = "platform" | "content_type" | "questions" | "ideas" | "hook-compare" | "script";

const CONTENT_TYPES = [
  { id: "educativo",       label: "Educativo",       icon: "🎓", desc: "Tutoriales, guías, análisis" },
  { id: "lifestyle",       label: "Lifestyle",       icon: "✨", desc: "Rutinas, día a día, vlogs" },
  { id: "entretenimiento", label: "Entretenimiento", icon: "🎭", desc: "Humor, retos, reacciones" },
  { id: "mix",             label: "Híbrido",         icon: "🔀", desc: "Mezcla de formatos" },
];

const QUESTIONS: { id: string; question: string; placeholder: string; optional?: boolean }[] = [
  {
    id: "audience",
    question: "¿A quién va dirigido este vídeo?",
    placeholder: "ej. Emprendedores de 25-40 años que quieren escalar su negocio online...",
  },
  {
    id: "goal",
    question: "¿Qué quieres que haga el espectador al terminar?",
    placeholder: "ej. Que se suscriba, que compre mi curso, que deje un comentario...",
  },
  {
    id: "angle",
    question: "¿Tienes algún ángulo o idea concreta?",
    placeholder: "ej. Quiero hablar sobre el error que cometen la mayoría al hacer X...",
    optional: true,
  },
];

interface CrearClientProps {
  profile: Profile;
  defaultChannel: Channel | null;
}

export function CrearClient({ profile, defaultChannel }: CrearClientProps) {
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<Mode>("chat");
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [step, setStep] = useState<Step>("platform");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [contentType, setContentType] = useState<string | null>(null);

  const [platform, setPlatform] = useState<Platform | null>((defaultChannel?.platform as Platform) || null);
  const [niche, setNiche] = useState(defaultChannel?.niche || "");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [script, setScript] = useState<Script | null>(null);
  const [hookVariants, setHookVariants] = useState<HookVariants | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSection, setLoadingSection] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"saving" | "saved" | null>(null);

  useEffect(() => {
    const trending = searchParams.get("trending");
    if (trending) setNiche(trending);
  }, [searchParams]);

  useEffect(() => {
    document.body.style.overflow = mode === "chat" ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mode]);


  useEffect(() => {
    fetch("/api/chat/sessions")
      .then(r => r.json())
      .then(d => { if (d.sessions) setChatSessions(d.sessions); })
      .catch(() => {});
  }, []);

  async function handleSelectSession(id: string) {
    if (id === activeSessionId) return;
    const res = await fetch(`/api/chat/sessions/${id}`);
    const data = await res.json();
    if (data.session) {
      setActiveSessionId(id);
      setActiveMessages(data.session.messages ?? []);
    }
  }

  function handleNewChat() {
    setActiveSessionId(null);
    setActiveMessages([]);
  }

  async function handleDeleteSession(id: string) {
    await fetch(`/api/chat/sessions/${id}`, { method: "DELETE" });
    setChatSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) handleNewChat();
  }

  async function handleRenameSession(id: string, title: string) {
    setChatSessions(prev => prev.map(s => s.id === id ? { ...s, title } : s));
    try {
      await fetch(`/api/chat/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
    } catch {
    }
  }

  function handleSessionCreated(id: string, title: string, messages: { role: "user" | "assistant"; content: string }[]) {
    const now = new Date().toISOString();
    setChatSessions(prev => [{ id, title, created_at: now, updated_at: now }, ...prev]);
    setActiveSessionId(id);
    setActiveMessages(messages);
  }

  function handleSessionUpdated(id: string, title: string) {
    const now = new Date().toISOString();
    setChatSessions(prev => prev.map(s => s.id === id ? { ...s, title, updated_at: now } : s));
  }

  useEffect(() => {
    if (!script) return;
    const timer = setInterval(async () => {
      setAutoSaveStatus("saving");
      await fetch(`/api/scripts/${script.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "draft" }),
      }).catch(() => {});
      setAutoSaveStatus("saved");
      setTimeout(() => setAutoSaveStatus(null), 2000);
    }, 30000);
    return () => clearInterval(timer);
  }, [script]);

  // ── Navigation ──────────────────────────────────────────────────────────────
  function goBack() {
    if (step === "content_type") { setStep("platform"); }
    else if (step === "questions") {
      if (questionIndex > 0) setQuestionIndex(q => q - 1);
      else setStep("content_type");
    }
    else if (step === "ideas") { setQuestionIndex(QUESTIONS.length - 1); setStep("questions"); }
    else if (step === "hook-compare") { setStep("ideas"); }
    else if (step === "script") { setStep(hookVariants ? "hook-compare" : "ideas"); }
  }

  function nextQuestion() {
    if (questionIndex < QUESTIONS.length - 1) {
      setQuestionIndex(q => q + 1);
    } else {
      handleGenerateIdeas();
    }
  }

  // ── API calls ───────────────────────────────────────────────────────────────
  async function handleGenerateIdeas() {
    if (!platform || !niche) return;
    setLoading(true);
    const res = await fetch("/api/ai/generate-ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, niche, count: 10, answers, contentType }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.status === 402) { setShowUpgrade(true); return; }
    if (data.ideas) { setIdeas(data.ideas); setProjectId(data.projectId || null); setStep("ideas"); }
  }

  async function handleSelectIdea(idea: Idea) {
    setSelectedIdea(idea);
    if (idea.viral_score >= 70) {
      setStep("hook-compare");
      await generateScript(idea, null);
    } else {
      await generateScript(idea, null);
    }
  }

  async function generateScript(idea: Idea, selectedHook: string | null) {
    setLoading(true);
    setStep("script");
    const res = await fetch("/api/ai/generate-script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ideaId: idea.id, projectId, idea, platform, niche, answers }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.status === 402) { setShowUpgrade(true); setStep("ideas"); return; }
    if (data.script) {
      const s = data.script;
      if (s.hooks_variants) { setHookVariants(s.hooks_variants); if (!selectedHook) setStep("hook-compare"); }
      if (selectedHook) s.hook = selectedHook;
      setScript(s);
    }
  }

  async function handleRegenerateSection(section: string) {
    if (!script) return;
    setLoadingSection(section);
    const currentContent = section === "hook" ? script.hook : section === "intro" ? script.intro : section === "cta" ? script.cta : "";
    const res = await fetch("/api/ai/regenerate-section", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scriptId: script.id, section, currentContent, context: `Título: ${script.title}, Plataforma: ${script.platform}, Nicho: ${script.niche}` }),
    });
    const data = await res.json();
    setLoadingSection(null);
    if (res.status === 402) { setShowUpgrade(true); return; }
    if (data.content) setScript(prev => prev ? { ...prev, [section]: data.content } : prev);
  }

  async function handleSaveIdea(ideaId: string) {
    const supabase = createClient();
    await supabase.from("ideas").update({ is_saved: true }).eq("id", ideaId);
    setIdeas(prev => prev.map(i => i.id === ideaId ? { ...i, is_saved: true } : i));
  }

  async function handleSaveScript() {
    if (!script) return;
    const supabase = createClient();
    await supabase.from("scripts").update({ status: "saved" }).eq("id", script.id);
    setSaved(true);
  }

  async function handleCopyShare() {
    if (!script) return;
    const url = `${window.location.origin}/share/${script.share_token}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function resetGuided() {
    setStep("platform"); setIdeas([]); setScript(null); setSelectedIdea(null);
    setHookVariants(null); setProjectId(null); setQuestionIndex(0); setContentType(null);
  }

  const stepTitle: Record<Step, string> = {
    platform: "Nuevo contenido",
    content_type: "Tipo de contenido",
    questions: QUESTIONS[questionIndex]?.question ?? "Cuéntame más",
    ideas: "Elige una idea",
    "hook-compare": "Elige tu hook",
    script: selectedIdea?.title || "Tu guion viral",
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className={mode === "chat" ? "flex flex-col" : "p-6 md:p-8 max-w-4xl mx-auto"}
      style={mode === "chat" ? { height: "calc(100vh - 53px)" } : {}}
    >

      {/* Mode toggle */}
      <div className={mode === "chat" ? "px-6 pt-5 pb-2 flex-shrink-0" : "mb-8"}>
        <div className="flex items-center gap-1 bg-[var(--color-muted)] rounded-2xl p-1 w-fit">
          <button
            onClick={() => setMode("guided")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              backgroundColor: mode === "guided" ? "var(--color-card)" : "transparent",
              color: mode === "guided" ? "var(--color-foreground)" : "var(--color-muted-foreground)",
              boxShadow: mode === "guided" ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
            }}
          >
            <ListChecks size={15} /> Guiado
          </button>
          <button
            onClick={() => setMode("chat")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              backgroundColor: mode === "chat" ? "var(--color-card)" : "transparent",
              color: mode === "chat" ? "var(--color-primary)" : "var(--color-muted-foreground)",
              boxShadow: mode === "chat" ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
            }}
          >
            <Sparkles size={15} /> Chat IA
          </button>
        </div>
      </div>

      {/* ── Chat mode ── */}
      {mode === "chat" && (
        <div className="flex flex-1 min-h-0">
          <ChatSidebar
            sessions={chatSessions}
            activeId={activeSessionId}
            onSelect={handleSelectSession}
            onNew={handleNewChat}
            onDelete={handleDeleteSession}
            onRename={handleRenameSession}
          />
          <div className="flex-1 min-h-0 px-6 py-4">
            <ChatInterface
              profile={profile}
              sessionId={activeSessionId}
              initialMessages={activeMessages}
              onSessionCreated={handleSessionCreated}
              onSessionUpdated={handleSessionUpdated}
              onCreateScript={(idea) => {
                  setMode("guided");
                  setAnswers(prev => ({ ...prev, angle: idea.title }));
                  if (platform && niche.trim()) {
                    if (!contentType) setContentType("mix");
                    setStep("questions");
                  }
                }}
            />
          </div>
        </div>
      )}

      {/* ── Guided mode ── */}
      {mode === "guided" && (
        <>
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              {step !== "platform" && (
                <button onClick={goBack} className="p-2 rounded-lg hover:bg-[var(--color-muted)] transition-all">
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <div>
                <h1 className="text-xl font-semibold">{stepTitle[step]}</h1>
                {step === "questions" && (
                  <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">
                    Pregunta {questionIndex + 1} de {QUESTIONS.length}
                    {QUESTIONS[questionIndex]?.optional && " · opcional"}
                  </p>
                )}
                {step === "script" && autoSaveStatus && (
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {autoSaveStatus === "saving" ? "Guardando..." : "✓ Guardado automáticamente"}
                  </p>
                )}
              </div>
            </div>

            {step === "script" && script && (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleCopyShare}>
                  {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                  {copied ? "Copiado" : "Compartir"}
                </Button>
                <Button variant="outline" size="sm" onClick={handleSaveScript} disabled={saved}>
                  <BookmarkPlus className="w-4 h-4" />
                  {saved ? "Guardado" : "Guardar"}
                </Button>
              </div>
            )}
          </div>

          {/* Progress bar for questions step */}
          {step === "questions" && (
            <div className="h-1 bg-[var(--color-muted)] rounded-full mb-8 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${((questionIndex + 1) / QUESTIONS.length) * 100}%`,
                  backgroundColor: "var(--color-primary)",
                }}
              />
            </div>
          )}

          {/* Steps */}
          <AnimatePresence mode="wait">

            {/* Platform */}
            {step === "platform" && (
              <motion.div key="platform" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <div className="space-y-6">
                  <div>
                    <Label className="text-base font-semibold mb-3 block">¿Para qué plataforma?</Label>
                    <PlatformSelector value={platform} onChange={setPlatform} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="niche">¿Cuál es tu nicho?</Label>
                    <Input
                      id="niche"
                      placeholder="ej. marketing digital, finanzas, fitness, desarrollo personal..."
                      value={niche}
                      onChange={(e) => setNiche(e.target.value)}
                      className="h-10"
                    />
                  </div>
                  <Button size="lg" disabled={!platform || !niche.trim()} onClick={() => setStep("content_type")} className="w-full md:w-auto">
                    Continuar →
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Content type */}
            {step === "content_type" && (
              <motion.div key="content_type" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <p className="text-sm text-[var(--color-muted-foreground)] mb-5">
                  Esto ayuda a la IA a generar ideas más precisas para tu estilo de contenido.
                </p>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {CONTENT_TYPES.map(ct => (
                    <button
                      key={ct.id}
                      onClick={() => { setContentType(ct.id); setStep("questions"); setQuestionIndex(0); }}
                      className="p-5 rounded-2xl border-2 text-left transition-all hover:scale-[1.02] duration-150"
                      style={{
                        borderColor: contentType === ct.id ? "var(--color-primary)" : "var(--color-border)",
                        backgroundColor: contentType === ct.id ? "var(--color-primary-light)" : "var(--color-card)",
                      }}
                    >
                      <span className="text-3xl block mb-2">{ct.icon}</span>
                      <span className="font-semibold text-sm block mb-0.5">{ct.label}</span>
                      <span className="text-xs text-[var(--color-muted-foreground)]">{ct.desc}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Questions — one at a time */}
            {step === "questions" && (
              <motion.div
                key={`question-${questionIndex}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {(() => {
                  const q = QUESTIONS[questionIndex];
                  return (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Textarea
                          autoFocus
                          id={q.id}
                          placeholder={q.placeholder}
                          value={answers[q.id] || ""}
                          onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                          className="min-h-[120px] text-sm"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) nextQuestion();
                          }}
                        />
                        <p className="text-[11px] text-[var(--color-muted-foreground)]">Cmd+Enter para continuar</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          size="lg"
                          disabled={loading || (!q.optional && !answers[q.id]?.trim())}
                          onClick={nextQuestion}
                          className="flex-1 md:flex-none"
                        >
                          {loading ? (
                            <span className="flex items-center gap-2">
                              <span className="inline-flex gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:0ms]" />
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:150ms]" />
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:300ms]" />
                              </span>
                              Generando ideas...
                            </span>
                          ) : questionIndex < QUESTIONS.length - 1 ? "Siguiente →" : "⚡ Generar ideas (2 créditos)"}
                        </Button>
                        {q.optional && (
                          <Button variant="ghost" size="lg" onClick={nextQuestion} disabled={loading}>
                            Saltar
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </motion.div>
            )}

            {/* Ideas */}
            {step === "ideas" && (
              <motion.div key="ideas" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <p className="text-sm text-[var(--color-muted-foreground)] mb-5">
                  {ideas.length} ideas para <strong>{niche}</strong> en <strong>{platform}</strong>. Elige la mejor.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {loading
                    ? Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-xl border border-[var(--color-border)] p-5 space-y-3">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-full" />
                          <Skeleton className="h-3 w-2/3" />
                        </div>
                      ))
                    : ideas.map((idea, i) => (
                        <IdeaCard key={idea.id ?? i} idea={idea} index={i} onSelect={handleSelectIdea} onSave={handleSaveIdea} />
                      ))}
                </div>
              </motion.div>
            )}

            {/* Hook compare */}
            {step === "hook-compare" && hookVariants && (
              <motion.div key="hook-compare" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="rounded-xl border p-4 space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <HookComparator
                    variants={hookVariants}
                    onSelect={(hook) => { setScript(prev => prev ? { ...prev, hook } : prev); setStep("script"); }}
                  />
                )}
                {script && !loading && (
                  <Button variant="ghost" className="mt-4" onClick={() => setStep("script")}>
                    Saltar → usar hook generado
                  </Button>
                )}
              </motion.div>
            )}

            {/* Script */}
            {step === "script" && (
              <motion.div key="script" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                {loading ? (
                  <div className="space-y-4">
                    {["HOOK", "INTRO", "CONTENIDO", "CTA"].map(s => (
                      <div key={s} className="rounded-xl border border-l-4 border-[var(--color-border)] p-5 space-y-2">
                        <p className="text-xs font-bold uppercase text-[var(--color-muted-foreground)]">{s}</p>
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-4/5" />
                        <Skeleton className="h-4 w-3/5" />
                      </div>
                    ))}
                  </div>
                ) : script ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between bg-white rounded-xl border border-[var(--color-border)] p-4">
                      <div>
                        <p className="font-semibold">{script.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="purple">{script.platform}</Badge>
                          <span className="text-xs text-[var(--color-muted-foreground)]">~{script.estimated_retention}% retención estimada</span>
                        </div>
                      </div>
                      <ViralScoreBadge score={script.viral_score} size="lg" animate />
                    </div>

                    <ScriptSection label="Hook" content={script.hook} borderColor="border-l-amber-400" bgColor="bg-amber-50/40" loading={loadingSection === "hook"} onRegenerate={() => handleRegenerateSection("hook")} />
                    <ScriptSection label="Intro" content={script.intro} borderColor="border-l-purple-400" bgColor="bg-purple-50/30" loading={loadingSection === "intro"} onRegenerate={() => handleRegenerateSection("intro")} />

                    {script.main_content?.map((section, i) => (
                      <div key={i} className="rounded-xl border border-l-4 border-l-green-400 bg-green-50/30 border-[var(--color-border)] p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted-foreground)]">{section.section}</span>
                          <span className="text-xs text-[var(--color-muted-foreground)]">{section.timestamp}</span>
                        </div>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{section.content}</p>
                      </div>
                    ))}

                    {script.retention_peaks?.length > 0 && (
                      <div className="rounded-xl border border-[var(--color-border)] bg-sky-50/40 p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-3">Picos de retención</p>
                        <div className="space-y-2">
                          {script.retention_peaks.map((peak, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              <span className="text-xs font-mono bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded shrink-0">{peak.timestamp}</span>
                              <span className="text-[var(--color-muted-foreground)]">{peak.suggestion}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <ScriptSection label="CTA" content={script.cta} borderColor="border-l-red-400" bgColor="bg-red-50/30" loading={loadingSection === "cta"} onRegenerate={() => handleRegenerateSection("cta")} />

                    {script.title_suggestions?.length > 0 && (
                      <div className="rounded-xl border border-[var(--color-border)] bg-white p-5">
                        <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-3">Títulos sugeridos</p>
                        <ul className="space-y-2">
                          {script.title_suggestions.map(t => (
                            <li key={t} className="text-sm p-2 rounded-lg hover:bg-[var(--color-muted)] cursor-pointer transition-all">{t}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {script.thumbnail_concepts?.length > 0 && (
                      <div className="rounded-xl border border-[var(--color-border)] bg-white p-5">
                        <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-3">Conceptos de miniatura</p>
                        <ul className="space-y-2">
                          {script.thumbnail_concepts.map((t, i) => (
                            <li key={i} className="text-sm flex items-start gap-2">
                              <span className="text-[var(--color-muted-foreground)]">{i + 1}.</span>{t}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center gap-3 pt-2">
                      <Button onClick={handleSaveScript} disabled={saved} variant={saved ? "secondary" : "default"}>
                        <BookmarkPlus className="w-4 h-4" />{saved ? "Guardado" : "Guardar guion"}
                      </Button>
                      <Button variant="outline" onClick={handleCopyShare}>
                        {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                        {copied ? "Copiado" : "Compartir"}
                      </Button>
                      <Button variant="ghost" onClick={resetGuided}>Crear otro →</Button>
                    </div>
                  </div>
                ) : null}
              </motion.div>
            )}

          </AnimatePresence>
        </>
      )}

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} creditsRemaining={profile.credits_remaining} />
    </div>
  );
}
