"use client";

import { motion } from "framer-motion";
import { ArrowRight, Film, RotateCcw, Share2 } from "lucide-react";
import { ViralScoreBadge } from "@/components/creator/viral-score-badge";
import { Badge } from "@/components/ui/badge";

const steps = [
  {
    num: "01",
    title: "Cuéntale tu nicho",
    desc: "Una frase basta: plataforma, tema, audiencia. La IA ya sabe qué patrones virales buscar para ese hueco exacto.",
  },
  {
    num: "02",
    title: "Elige entre 10 ideas puntuadas",
    desc: "Cada idea trae un Viral Score de 0 a 100 y el tipo de hook que usa: curiosidad, aversión a la pérdida, controversia suave...",
  },
  {
    num: "03",
    title: "Recibe el guion sección por sección",
    desc: "Hook, intro, desarrollo, picos de retención y CTA. Si una parte no te convence, regeneras solo esa, sin perder el resto.",
  },
];

const ideas = [
  { badge: "Curiosidad", title: "3 ingredientes que ya tienes y no sabías que servían para esto", score: 94 },
  { badge: "Aversión a la pérdida", title: "El error de 2€ que hace que gastes 40€ de más al mes", score: 81 },
];

const scriptRows = ["Intro", "Contenido", "Picos de retención"];

const publishPlatforms = [
  { label: "YouTube", glyph: "▶", color: "#FF0000" },
  { label: "TikTok", glyph: "♪", color: "#0D0D0D" },
  { label: "Instagram", glyph: "⬡", color: "#D6249F" },
  { label: "Facebook", glyph: "f", color: "#1877F2" },
  { label: "X", glyph: "𝕏", color: "#0D0D0D" },
  { label: "LinkedIn", glyph: "in", color: "#0A66C2" },
  { label: "Threads", glyph: "@", color: "#0D0D0D" },
];

function StepFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-card)] flex flex-col gap-2.5 min-h-[220px] justify-center">
      {children}
    </div>
  );
}

export function LandingHowItWorks() {
  return (
    <section className="py-24 px-6 border-t border-[var(--color-border)]">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)] mb-6">Cómo funciona</p>
        <h2
          className="text-4xl md:text-5xl font-normal mb-16 leading-tight"
          style={{ fontFamily: "var(--font-instrument-serif)", letterSpacing: "-0.02em" }}
        >
          Así piensa la IA<br />tu próximo vídeo viral.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {steps.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="flex flex-col gap-3"
            >
              <span className="text-sm font-semibold text-[var(--color-muted-foreground)]">{step.num}</span>
              <h3 className="text-lg font-semibold">{step.title}</h3>
              <p className="text-[var(--color-muted-foreground)] leading-relaxed text-sm">{step.desc}</p>

              {i === 0 && (
                <StepFrame>
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary-light)]">
                      YouTube
                    </span>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-[var(--color-border)] text-[var(--color-muted-foreground)]">
                      TikTok
                    </span>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-[var(--color-border)] text-[var(--color-muted-foreground)]">
                      Reels
                    </span>
                  </div>
                  <div className="flex items-end gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3">
                    <p className="flex-1 text-sm text-[var(--color-foreground)]">
                      recetas veganas para universitarios sin dinero
                    </p>
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--color-primary)] shrink-0">
                      <ArrowRight className="w-4 h-4 text-white" />
                    </span>
                  </div>
                </StepFrame>
              )}

              {i === 1 && (
                <StepFrame>
                  {ideas.map((idea) => (
                    <div key={idea.title} className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] p-3">
                      <div className="flex-1 min-w-0">
                        <Badge variant="purple" className="text-[10px] mb-1.5">{idea.badge}</Badge>
                        <p className="text-xs font-semibold leading-snug">{idea.title}</p>
                      </div>
                      <ViralScoreBadge score={idea.score} size="sm" />
                    </div>
                  ))}
                </StepFrame>
              )}

              {i === 2 && (
                <StepFrame>
                  <div className="rounded-xl bg-[var(--color-primary-light)] p-3 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-primary)]">Hook</span>
                      <RotateCcw className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                    </div>
                    <p className="text-xs leading-relaxed">"Tiré 40€ de comida vegana... hasta que descubrí esto."</p>
                  </div>
                  {scriptRows.map((label) => (
                    <div key={label} className="rounded-xl border border-[var(--color-border)] px-3 py-2.5 flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-muted-foreground)]">{label}</span>
                      <RotateCcw className="w-3.5 h-3.5 text-[var(--color-muted-foreground)]" />
                    </div>
                  ))}
                </StepFrame>
              )}
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-10 rounded-2xl border border-dashed border-[var(--color-border)] bg-white p-8 shadow-[var(--shadow-card)] grid grid-cols-1 md:grid-cols-[1fr_1.1fr] gap-8 md:items-center"
        >
          <div className="flex flex-col gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-primary-light)] bg-[var(--color-primary-light)] px-3 py-1 text-[11px] font-semibold text-[var(--color-primary)] w-fit">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-primary)] opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--color-primary)]" />
              </span>
              Próximamente
            </div>
            <span className="text-sm font-semibold text-[var(--color-muted-foreground)]">04</span>
            <h3 className="text-lg font-semibold">Publica en todas tus redes a la vez</h3>
            <p className="text-[var(--color-muted-foreground)] leading-relaxed text-sm">
              Un mismo vídeo, adaptado y programado para YouTube, TikTok, Instagram, Facebook, X, LinkedIn y Threads en un solo clic. Lo estamos construyendo — muy pronto no tendrás que subir nada a mano.
            </p>
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-2.5">
              <Film className="w-4 h-4 text-[var(--color-primary)]" />
              <span className="text-xs font-semibold">Tu guion, listo para grabar</span>
            </div>
            <Share2 className="w-4 h-4 text-[var(--color-muted-foreground)]" />
            <div className="flex flex-wrap items-center justify-center gap-2 max-w-sm">
              {publishPlatforms.map((p) => (
                <span
                  key={p.label}
                  className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-medium shadow-[var(--shadow-card)]"
                >
                  <span style={{ color: p.color }}>{p.glyph}</span>
                  {p.label}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
