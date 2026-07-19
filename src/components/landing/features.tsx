"use client";

import { motion } from "framer-motion";
import { AtSign, Zap, BookOpen, Anchor, Search, Shuffle, Users, Eye } from "lucide-react";
import { ViralScoreBadge } from "@/components/creator/viral-score-badge";

const features = [
  {
    id: "guiones",
    icon: BookOpen,
    title: "Generador de guiones virales",
    desc: "Hook, Intro, Contenido, Picos de retención y CTA. Sección por sección, con regeneración individual.",
    size: "large",
    color: "bg-[var(--color-primary-light)]",
    iconColor: "text-[var(--color-primary)]",
  },
  {
    id: "motor-ideas",
    icon: Zap,
    title: "Motor de ideas con Viral Score",
    desc: "10 ideas con puntuación 0-100 basada en patrones virales reales.",
    size: "medium",
    color: "bg-amber-50",
    iconColor: "text-amber-600",
  },
  {
    id: "estilo-creador",
    icon: AtSign,
    title: "Escribe con el estilo de creadores reales",
    desc: "Menciona a @mrbeast, @stevejobs o a quien admires con una @ en el chat, y la IA adapta el guion a su tono, ritmo y estructura.",
    size: "full",
    color: "bg-white",
    iconColor: "text-[var(--color-primary)]",
  },
  {
    id: "hook-comparator",
    icon: Anchor,
    title: "Hook Comparator",
    desc: "3 versiones del hook: agresivo, curioso y emocional. Tú eliges el que dispara.",
    size: "medium",
    color: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },
  {
    id: "explorar",
    icon: Search,
    title: "Explorar competidores",
    desc: "Analiza canales rivales y extrae estrategias.",
    size: "small",
    color: "bg-sky-50",
    iconColor: "text-sky-600",
  },
  {
    id: "sorprendeme",
    icon: Shuffle,
    title: "Modo Sorpréndeme",
    desc: "5 ideas virales en 1 clic, sin formulario. Basadas en tu perfil.",
    size: "full",
    color: "bg-[var(--color-foreground)]",
    iconColor: "text-white",
    dark: true,
  },
];

const scriptTimeline = [
  { label: "Hook", width: "10%", opacity: "opacity-100" },
  { label: "Intro", width: "16%", opacity: "opacity-80" },
  { label: "Contenido", width: "42%", opacity: "opacity-50" },
  { label: "Pico", width: "14%", opacity: "opacity-80" },
  { label: "CTA", width: "18%", opacity: "opacity-100" },
];

const ideaScores = [
  { label: "Curiosidad", score: 96 },
  { label: "Shock", score: 84 },
  { label: "Emocional", score: 71 },
];

const miniHooks = [
  { label: "Agresivo", emoji: "⚡", color: "border-red-300 bg-red-50", labelColor: "text-red-700 bg-red-100", sample: "Esto te va a doler..." },
  { label: "Curioso", emoji: "🔍", color: "border-amber-300 bg-amber-50", labelColor: "text-amber-700 bg-amber-100", sample: "Nadie te ha contado esto..." },
  { label: "Emocional", emoji: "❤️", color: "border-purple-300 bg-purple-50", labelColor: "text-purple-700 bg-purple-100", sample: "La razón por la que lloré grabando esto..." },
];

const surpriseScores = [88, 95, 79, 91, 84];

// Mismos creadores reales que ofrece el autocompletado "@" en /crear (src/app/crear/chat-interface.tsx)
const mentionCreators = [
  { handle: "@mrbeast", name: "MrBeast", desc: "Retos extremos · Stakes altos · Producción masiva", photo: "/creators/mrbeast.png", selected: true },
  { handle: "@stevejobs", name: "Steve Jobs", desc: "Minimalismo · El porqué antes que el cómo", photo: "/creators/stevejobs.jpg" },
  { handle: "@traxnyc", name: "TraxNYC", desc: "Joyería · Lujo urbano · NYC Diamond District", photo: "/creators/traxnyc.webp" },
  { handle: "@collinskey", name: "Collins Key", desc: "Formato corto viral · Trend-jacking en TikTok/Reels", photo: "/creators/collinskey.jpg" },
];

export function LandingFeatures() {
  return (
    <section className="py-24 px-6 border-t border-[var(--color-border)]" id="features">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)] mb-6">
          Funciones
        </p>
        <h2
          className="text-4xl md:text-5xl font-normal mb-16"
          style={{ fontFamily: "var(--font-instrument-serif)", letterSpacing: "-0.02em" }}
        >
          Todo lo que necesitas<br />para dominar el algoritmo.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {features.map((f, i) => {
            const Icon = f.icon;
            const colSpan =
              f.size === "full" ? "md:col-span-12" :
              f.size === "large" ? "md:col-span-7" :
              f.size === "medium" ? "md:col-span-5" : "md:col-span-4";
            const sideBySide = f.size === "full";

            return (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className={`${colSpan} rounded-2xl p-8 ${f.color} border border-[var(--color-border)] hover:shadow-[var(--shadow-card-hover)] transition-all duration-200 hover:scale-[1.01] flex flex-col ${sideBySide ? "md:flex-row md:items-center md:gap-10" : ""}`}
              >
                <div className={sideBySide ? "flex-1 flex flex-col" : "contents"}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${f.dark ? "bg-white/10" : "bg-white/80"}`}>
                    <Icon className={`w-5 h-5 ${f.iconColor}`} />
                  </div>
                  <h3 className={`text-lg font-semibold mb-2 ${f.dark ? "text-white" : "text-[var(--color-foreground)]"}`}>
                    {f.title}
                  </h3>
                  <p className={`text-sm leading-relaxed ${f.dark ? "text-white/70" : "text-[var(--color-muted-foreground)]"} ${sideBySide ? "max-w-sm" : ""}`}>
                    {f.desc}
                  </p>
                </div>

                {/* Generador de guiones — línea de tiempo del guion */}
                {f.id === "guiones" && (
                  <div className="mt-6 rounded-xl bg-white/70 border border-[var(--color-border)] p-5 flex-1 flex flex-col justify-center gap-4">
                    <div>
                      <div className="flex h-2.5 rounded-full overflow-hidden mb-2.5">
                        {scriptTimeline.map((seg) => (
                          <div key={seg.label} className={`bg-[var(--color-primary)] ${seg.opacity}`} style={{ width: seg.width }} />
                        ))}
                      </div>
                      <div className="flex justify-between">
                        {scriptTimeline.map((seg) => (
                          <span key={seg.label} className="text-[9px] font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                            {seg.label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed text-[var(--color-foreground)]/80 italic">
                      "Tiré 40€ de comida vegana... hasta que descubrí esto." <span className="not-italic text-[var(--color-muted-foreground)]">— Hook, 0-3s</span>
                    </p>
                  </div>
                )}

                {/* Motor de ideas — ranking de scores */}
                {f.id === "motor-ideas" && (
                  <div className="mt-6 flex flex-col gap-2">
                    {ideaScores.map((idea) => (
                      <div key={idea.label} className="flex items-center gap-2.5 rounded-lg bg-white/80 border border-[var(--color-border)] px-3 py-2">
                        <ViralScoreBadge score={idea.score} size="sm" />
                        <span className="text-xs font-medium">{idea.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Estilo de creador — autocompletado real de @mención */}
                {f.id === "estilo-creador" && (
                  <div className="mt-6 md:mt-0 flex-1 max-w-md w-full mx-auto md:mx-0">
                    <div className="rounded-2xl border border-[var(--color-border)] bg-white overflow-hidden" style={{ boxShadow: "var(--shadow-popup)" }}>
                      <div className="flex items-center gap-1 px-4 py-3 border-b border-[var(--color-border)]">
                        <span className="text-sm text-[var(--color-foreground)]">
                          Hazme un guion como{" "}
                          <span className="font-semibold text-[var(--color-primary)]">@mr</span>
                          <span className="inline-block w-[2px] h-4 bg-[var(--color-primary)] align-middle animate-pulse" />
                        </span>
                      </div>
                      <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted-foreground)]">
                        Estilo de creador
                      </p>
                      <div className="pb-2">
                        {mentionCreators.map((c) => (
                          <div
                            key={c.handle}
                            className={`flex items-center gap-3 px-4 py-2.5 ${c.selected ? "bg-[var(--color-primary-light)]" : ""}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={c.photo} alt={c.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold leading-tight">
                                {c.handle}
                                <span className="ml-1.5 text-xs font-normal text-[var(--color-muted-foreground)]">{c.name}</span>
                              </p>
                              <p className="text-xs mt-0.5 truncate text-[var(--color-muted-foreground)]">{c.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Hook Comparator — 3 variantes reales */}
                {f.id === "hook-comparator" && (
                  <div className="mt-6 flex flex-col gap-2">
                    {miniHooks.map((h) => (
                      <div key={h.label} className={`rounded-lg border px-3 py-2 ${h.color}`}>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full mb-1 ${h.labelColor}`}>
                          {h.emoji} {h.label}
                        </span>
                        <p className="text-xs font-medium leading-snug truncate">"{h.sample}"</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Viral Score — badge grande */}
                {f.id === "viral-score" && (
                  <div className="mt-6 flex items-center justify-center flex-1">
                    <ViralScoreBadge score={92} size="lg" animate />
                  </div>
                )}

                {/* Explorar competidores — mini tarjeta de canal */}
                {f.id === "explorar" && (
                  <div className="mt-6 rounded-lg bg-white/80 border border-[var(--color-border)] p-3 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full shrink-0" style={{ backgroundColor: "var(--color-muted)" }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">Canal Rival TV</p>
                      <div className="flex gap-2.5 mt-0.5">
                        <span className="text-[10px] text-[var(--color-muted-foreground)] flex items-center gap-0.5">
                          <Users size={10} /> 320K
                        </span>
                        <span className="text-[10px] text-[var(--color-muted-foreground)] flex items-center gap-0.5">
                          <Eye size={10} /> 12M
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Modo Sorpréndeme — 5 ideas al instante */}
                {f.id === "sorprendeme" && (
                  <div className="mt-6 md:mt-0 flex-1 flex flex-col items-center gap-3">
                    <div className="flex items-center gap-3">
                      {surpriseScores.map((score, idx) => (
                        <div
                          key={idx}
                          className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-sm font-bold text-white"
                        >
                          {score}
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-white/50">5 ideas nuevas, un clic, sin formulario.</p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
