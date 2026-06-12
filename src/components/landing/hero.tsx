"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
  const [result, setResult] = useState<{
    hook: string;
    intro: string;
    plataforma: string;
    por_que: string;
    visuales?: Array<{ momento: string; tipo: string; descripcion: string }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/ai/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Algo salió mal."); return; }
      setResult(data);
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
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
          Tu primer vídeo viral en segundos. Guiones e ideas virales generados por IA, optimizados para YouTube, TikTok e Instagram.
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
              placeholder="Describe tu canal o tema… ej: recetas veganas para universitarios sin dinero"
              rows={2}
              className="flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-[var(--color-muted-foreground)]"
              style={{ fontFamily: "var(--font-sans)" }}
            />
            <button
              onClick={handleSubmit}
              disabled={!prompt.trim() || loading}
              className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-150 disabled:opacity-40"
              style={{ backgroundColor: "var(--color-foreground)" }}
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

          <p className="mt-2.5 text-xs text-[var(--color-muted-foreground)] text-center">
            Sin tarjeta de crédito · Pulsa Enter para generar
          </p>

          {/* Logo loader centrado */}
          <AnimatePresence>
            {loading && (
              <motion.div
                key="loader"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                className="mt-8 flex flex-col items-center gap-4"
              >
                <LogoLoader size={56} />
                <p className="text-sm text-[var(--color-muted-foreground)]">Generando tu guion viral…</p>
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
                {/* Visible part — hook + intro */}
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs font-medium text-[var(--color-primary)] bg-[var(--color-primary-light)] px-2.5 py-1 rounded-full">
                      Variante 1 de 3 · {result.plataforma}
                    </span>
                    <span className="text-xs text-[var(--color-muted-foreground)]">Vista previa parcial</span>
                  </div>

                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-1.5">Hook de apertura</p>
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
                    <p className="mt-2 text-xs text-[var(--color-muted-foreground)] italic border-t border-[var(--color-border)] pt-3">
                      ✦ {result.por_que}
                    </p>
                  )}

                  {/* Sugerencias visuales */}
                  {result.visuales && result.visuales.length > 0 && (
                    <div className="mt-4 border-t border-[var(--color-border)] pt-4">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-3">
                        Dirección visual
                      </p>
                      <div className="flex flex-col gap-2">
                        {result.visuales.map((v, i) => (
                          <div key={i} className="flex gap-3 items-start">
                            <span
                              className="flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5"
                              style={{
                                backgroundColor: "var(--color-muted)",
                                color: "var(--color-muted-foreground)",
                              }}
                            >
                              {v.momento}
                            </span>
                            <div className="min-w-0">
                              <span
                                className="text-[10px] font-medium uppercase tracking-wide mr-1.5"
                                style={{ color: "var(--color-primary)" }}
                              >
                                {v.tipo}
                              </span>
                              <span className="text-xs text-[var(--color-foreground)]">{v.descripcion}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-1.5">Retención + CTA</p>
                    <p className="text-sm leading-relaxed text-[var(--color-foreground)]">
                      Cierra con el loop abierto que genera comentarios y fuerza al algoritmo a distribuirlo...
                    </p>
                    <p className="text-xs text-[var(--color-muted-foreground)] mt-3">Variante 2 · Variante 3 disponibles</p>
                  </div>

                  {/* Lock overlay */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center"
                    style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.92) 30%)" }}
                  >
                    <div className="mt-8 text-center px-6">
                      <p className="text-sm font-semibold text-[var(--color-foreground)] mb-1">
                        El guion completo + 2 variantes más te esperan
                      </p>
                      <p className="text-xs text-[var(--color-muted-foreground)] mb-4">
                        Regístrate gratis. Sin tarjeta de crédito.
                      </p>
                      <a
                        href="/signup"
                        className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-px"
                        style={{ backgroundColor: "var(--color-foreground)" }}
                      >
                        Ver guion completo →
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
        {["YouTube", "YouTube Shorts", "TikTok", "Instagram Reels"].map((p) => (
          <span
            key={p}
            className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium shadow-[var(--shadow-card)]"
          >
            {p === "YouTube" && <span className="text-red-500">▶</span>}
            {p === "YouTube Shorts" && <span className="text-red-500">▶</span>}
            {p === "TikTok" && <span>♪</span>}
            {p === "Instagram Reels" && <span className="text-pink-500">⬡</span>}
            {p}
          </span>
        ))}
      </motion.div>
    </section>
  );
}
