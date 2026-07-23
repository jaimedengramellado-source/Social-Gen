"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ViralScoreBadge } from "@/components/creator/viral-score-badge";
import { Badge } from "@/components/ui/badge";
import {
  YoutubeIcon, TiktokIcon, InstagramIcon, FacebookIcon, XIcon, LinkedinIcon, ThreadsIcon,
} from "@/components/shared/brand-icons";

const PLATFORMS = [
  { label: "YouTube", Icon: YoutubeIcon },
  { label: "TikTok", Icon: TiktokIcon },
  { label: "Instagram", Icon: InstagramIcon },
  { label: "Facebook", Icon: FacebookIcon },
  { label: "X", Icon: XIcon },
  { label: "LinkedIn", Icon: LinkedinIcon },
  { label: "Threads", Icon: ThreadsIcon },
];

const LOADING_STAGES = [
  "Analizando tu nicho…",
  "Detectando patrones virales…",
  "Puntuando el potencial de cada idea…",
  "Escribiendo tu hook de apertura…",
];

const HERO_PLACEHOLDERS = [
  "Describe tu canal o tema… ej: recetas veganas para universitarios sin dinero",
  "Ej: finanzas personales para millennials que viven al día",
  "Ej: fitness en casa para madres sin tiempo libre",
  "Ej: desarrollo personal para emprendedores que siempre fracasan",
  "Ej: tecnología y gadgets para gente que no entiende de tecnología",
];

function LogoLoader({ size = 48 }: { size?: number }) {
  const triangleSize = size * 0.38;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: "#0D0D0D",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg
        width={triangleSize}
        height={triangleSize}
        viewBox="0 0 18 18"
        style={{
          animation: "triangle-spin 1s steps(4, end) infinite",
          transformOrigin: "center",
        }}
      >
        <polygon points="3,2 15,9 3,16" fill="white" />
      </svg>
    </div>
  );
}

export function LandingHero() {
  const words = ["La", "plataforma", "de", "los", "creadores", "de", "contenido", "virales"];
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setPlaceholderIdx(i => (i + 1) % HERO_PLACEHOLDERS.length);
    }, 3500);
    return () => clearInterval(id);
  }, []);
  const [result, setResult] = useState<{
    plataforma: string;
    ideas: Array<{ title: string; viral_score: number; hook_type: string; why_viral: string }>;
    hook: string;
    intro: string;
    por_que: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingStage, setLoadingStage] = useState(0);
  const [thinking, setThinking] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const thinkingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading) return;
    setLoadingStage(0);
    const id = setInterval(() => {
      setLoadingStage(s => Math.min(s + 1, LOADING_STAGES.length - 1));
    }, 3500);
    return () => clearInterval(id);
  }, [loading]);

  useEffect(() => {
    const el = thinkingRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thinking]);

  const handleSubmit = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setThinking("");

    try {
      const res = await fetch("/api/ai/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Algo salió mal.");
        return;
      }

      // Stream NDJSON: eventos "thinking" en directo y "result"/"error" al final
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;

      const handleLine = (line: string) => {
        if (!line.trim()) return;
        let evt: { type: string; text?: string; data?: typeof result; message?: string };
        try { evt = JSON.parse(line); } catch { return; }
        if (evt.type === "thinking" && evt.text) {
          setThinking(t => t + evt.text);
        } else if (evt.type === "result" && evt.data) {
          setResult(evt.data);
          finished = true;
        } else if (evt.type === "error") {
          setError(evt.message || "Algo salió mal.");
          finished = true;
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        lines.forEach(handleLine);
      }
      handleLine(buffer);

      if (!finished) setError("Algo salió mal. Inténtalo de nuevo.");
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
      setThinking("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <section className="min-h-screen flex flex-col items-center justify-center px-6 pt-20 pb-16 relative overflow-hidden">
      {/* Background glow */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.04] blur-3xl pointer-events-none"
        style={{ backgroundColor: "var(--color-primary)" }}
      />

      <div className="mx-auto max-w-4xl text-center relative w-full">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--color-primary-light)] bg-[var(--color-primary-light)] px-4 py-1.5 text-xs font-medium text-[var(--color-primary)] mb-10"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-primary)] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--color-primary)]" />
          </span>
          Nuevo: Hook Comparator con 3 variantes de IA
        </motion.div>

        {/* Headline */}
        <h1
          className="text-6xl md:text-7xl lg:text-8xl font-normal leading-none mb-6"
          style={{ fontFamily: "var(--font-instrument-serif)", letterSpacing: "-0.03em" }}
        >
          {words.map((word, i) => (
            <motion.span
              key={word + i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.06 }}
              className="inline-block mr-[0.2em]"
            >
              {word}
            </motion.span>
          ))}
        </h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.55 }}
          className="text-lg md:text-xl text-[var(--color-muted-foreground)] max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Tu primer vídeo viral en segundos. La mejor IA para garantizar visitas.
        </motion.p>

        {/* Demo input */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.65 }}
          className="w-full max-w-2xl mx-auto"
        >
          <div
            className="relative flex items-end gap-3 rounded-2xl border bg-white p-3 shadow-[var(--shadow-popup)]"
            style={{ borderColor: loading ? "var(--color-primary)" : "var(--color-border)", transition: "border-color 200ms" }}
          >
            <textarea
              ref={inputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={HERO_PLACEHOLDERS[placeholderIdx]}
              rows={2}
              className="flex-1 resize-none bg-transparent text-base md:text-sm leading-relaxed outline-none placeholder:text-[var(--color-muted-foreground)]"
              style={{ fontFamily: "var(--font-sans)" }}
            />
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-150"
              style={{ backgroundColor: "var(--color-primary)" }}
              aria-label="Generar"
            >
              {loading ? (
                <LogoLoader size={18} />
              ) : (
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              )}
            </button>
          </div>


          {/* Panel de pensamiento en vivo */}
          <AnimatePresence>
            {loading && (
              <motion.div
                key="loader"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25 }}
                className="mt-6 rounded-2xl border border-[var(--color-border)] bg-white p-5 text-left shadow-[var(--shadow-popup)] relative overflow-hidden"
              >
                {/* Barra de progreso animada */}
                <motion.div
                  className="absolute top-0 left-0 h-[2px] w-1/3 rounded-full"
                  style={{ backgroundColor: "var(--color-primary)" }}
                  animate={{ x: ["-100%", "300%"] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                />

                <div className="flex items-center gap-3 mb-3">
                  <LogoLoader size={28} />
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-[var(--color-foreground)]">
                      La IA está pensando
                    </span>
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="w-1 h-1 rounded-full inline-block"
                        style={{ backgroundColor: "var(--color-primary)" }}
                        animate={{ opacity: [0.2, 1, 0.2], y: [0, -2, 0] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={loadingStage}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.25 }}
                      className="ml-auto text-xs text-[var(--color-muted-foreground)] hidden sm:block"
                    >
                      {LOADING_STAGES[loadingStage]}
                    </motion.span>
                  </AnimatePresence>
                </div>

                {/* Razonamiento en directo */}
                <div className="relative">
                  <div
                    ref={thinkingRef}
                    className="max-h-32 overflow-hidden text-xs leading-relaxed text-[var(--color-muted-foreground)] whitespace-pre-wrap scroll-smooth"
                    style={{
                      maskImage: "linear-gradient(to bottom, transparent 0%, black 25%)",
                      WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 25%)",
                    }}
                  >
                    {thinking || "Leyendo tu contexto y preparando el análisis…"}
                    <motion.span
                      className="inline-block w-[2px] h-3 ml-0.5 align-middle"
                      style={{ backgroundColor: "var(--color-primary)" }}
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.9, repeat: Infinity }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Result */}
          <AnimatePresence>
            {error && (
              <motion.p
                key="error"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4 text-sm text-[var(--color-destructive)] text-center"
              >
                {error}
              </motion.p>
            )}

            {result && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="mt-5 rounded-2xl border border-[var(--color-border)] bg-white text-left shadow-[var(--shadow-popup)] overflow-hidden"
              >
                {/* Visible part — ideas con potencial + preview del guion */}
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs font-medium text-[var(--color-primary)] bg-[var(--color-primary-light)] px-2.5 py-1 rounded-full">
                      Análisis IA · {result.plataforma?.split(/[—(/]/)[0].trim().slice(0, 24)}
                    </span>
                    <span className="text-xs text-[var(--color-muted-foreground)]">Vista previa gratuita</span>
                  </div>

                  {result.ideas && result.ideas.length > 0 && (
                    <>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-2.5">
                        {result.ideas.length} ideas con potencial viral para tu nicho
                      </p>
                      <div className="flex flex-col gap-2.5 mb-5">
                        {result.ideas.slice(0, 3).map((idea, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.15 + i * 0.12 }}
                            className="rounded-xl border border-[var(--color-border)] p-4 hover:shadow-[var(--shadow-card)] transition-shadow"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <Badge variant="purple" className="text-xs">{idea.hook_type}</Badge>
                                  {i === 0 && (
                                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-primary)]">
                                      Mejor idea
                                    </span>
                                  )}
                                </div>
                                <h3 className="font-semibold text-sm leading-snug mb-1.5">{idea.title}</h3>
                                <p
                                  className={`text-xs text-[var(--color-primary)] bg-[var(--color-primary-light)] rounded-lg px-2.5 py-1.5 inline-block ${
                                    i === 0 ? "" : "select-none"
                                  }`}
                                  style={i === 0 ? undefined : { filter: "blur(4px)" }}
                                >
                                  💡 {idea.why_viral}
                                </p>
                              </div>
                              <ViralScoreBadge score={idea.viral_score} size="sm" animate />
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </>
                  )}

                  <div className="border-t border-[var(--color-border)] pt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-1.5">
                      Hook de apertura · Mejor idea
                    </p>
                    <p
                      className="text-lg font-normal leading-snug mb-4"
                      style={{ fontFamily: "var(--font-instrument-serif)" }}
                    >
                      "{result.hook}"
                    </p>

                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-1.5">Primeros 30 segundos</p>

                    {/* Texto que se desvanece */}
                    <div className="relative">
                      <p className="text-sm leading-relaxed text-[var(--color-foreground)]"
                        style={{
                          maskImage: "linear-gradient(to bottom, black 30%, transparent 100%)",
                          WebkitMaskImage: "linear-gradient(to bottom, black 30%, transparent 100%)",
                        }}
                      >
                        {result.intro}
                      </p>
                      {/* Capa de blur sobre el fade */}
                      <div
                        className="absolute bottom-0 left-0 right-0 h-16"
                        style={{
                          backdropFilter: "blur(3px)",
                          WebkitBackdropFilter: "blur(3px)",
                          maskImage: "linear-gradient(to bottom, transparent, black)",
                          WebkitMaskImage: "linear-gradient(to bottom, transparent, black)",
                        }}
                      />
                    </div>

                    {result.por_que && (
                      <p className="mt-2 text-xs text-[var(--color-muted-foreground)] italic">
                        ✦ {result.por_que}
                      </p>
                    )}
                  </div>
                </div>

                {/* Locked section */}
                <div className="relative">
                  {/* Blurred fake content */}
                  <div
                    className="px-5 pb-4 select-none pointer-events-none"
                    style={{ filter: "blur(5px)", opacity: 0.5 }}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-1.5">Desarrollo del guion</p>
                    <p className="text-sm leading-relaxed text-[var(--color-foreground)] mb-3">
                      Aquí el algoritmo detecta que el espectador ya lleva 45 segundos y necesita un nuevo estímulo. Introduce el giro inesperado que cambia la narrativa y mantiene la retención por encima del 70%...
                    </p>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-1.5">Dirección visual + Retención + CTA</p>
                    <p className="text-sm leading-relaxed text-[var(--color-foreground)]">
                      Cierra con el loop abierto que genera comentarios y fuerza al algoritmo a distribuirlo...
                    </p>
                    <p className="text-xs text-[var(--color-muted-foreground)] mt-3">Guion completo de las 3 ideas · Dirección visual · Análisis de retención</p>
                  </div>

                  {/* Lock overlay */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center"
                    style={{ background: "linear-gradient(to bottom, transparent 0%, var(--color-card) 30%)" }}
                  >
                    <div className="mt-8 text-center px-6">
                      <p className="text-sm font-semibold text-[var(--color-foreground)] mb-1">
                        ¿Quieres ver el análisis completo y ganar el juego de las redes sociales?
                      </p>
                      <p className="text-xs text-[var(--color-muted-foreground)] mb-4">
                        Guion completo, dirección visual y las 3 ideas desbloqueadas. Regístrate gratis, sin tarjeta de crédito.
                      </p>
                      <a
                        href="/signup"
                        className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-px"
                        style={{ backgroundColor: "var(--color-foreground)" }}
                      >
                        Ver análisis completo gratis →
                      </a>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Platform badges */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.9 }}
        className="mt-16 flex flex-wrap items-center justify-center gap-3"
      >
        {PLATFORMS.map(({ label, Icon }) => (
          <span
            key={label}
            className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium shadow-[var(--shadow-card)]"
          >
            <Icon size={14} colored />
            {label}
          </span>
        ))}
      </motion.div>
    </section>
  );
}
