"use client";

import { motion } from "framer-motion";
import { Zap, BookOpen, Anchor, Star, Search, Shuffle } from "lucide-react";

const features = [
  {
    icon: BookOpen,
    title: "Generador de guiones virales",
    desc: "Hook, Intro, Contenido, Picos de retención y CTA. Sección por sección, con regeneración individual.",
    size: "large",
    color: "bg-[var(--color-primary-light)]",
    iconColor: "text-[var(--color-primary)]",
  },
  {
    icon: Zap,
    title: "Motor de ideas con Viral Score",
    desc: "10 ideas con puntuación 0-100 basada en patrones virales reales.",
    size: "medium",
    color: "bg-amber-50",
    iconColor: "text-amber-600",
  },
  {
    icon: Anchor,
    title: "Hook Comparator",
    desc: "3 versiones del hook: agresivo, curioso y emocional. Tú eliges el que dispara.",
    size: "medium",
    color: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },
  {
    icon: Star,
    title: "Viral Score 0-100",
    desc: "Cada idea puntuada por potencial viral.",
    size: "small",
    color: "bg-rose-50",
    iconColor: "text-rose-600",
  },
  {
    icon: Search,
    title: "Explorar competidores",
    desc: "Analiza canales rivales y extrae estrategias.",
    size: "small",
    color: "bg-sky-50",
    iconColor: "text-sky-600",
  },
  {
    icon: Shuffle,
    title: "Modo Sorpréndeme",
    desc: "5 ideas virales en 1 clic, sin formulario. Basadas en tu perfil.",
    size: "large",
    color: "bg-[var(--color-foreground)]",
    iconColor: "text-white",
    dark: true,
  },
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
              f.size === "large" ? "md:col-span-7" : f.size === "medium" ? "md:col-span-5" : "md:col-span-4";

            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className={`${colSpan} rounded-2xl p-8 ${f.color} border border-[var(--color-border)] hover:shadow-[var(--shadow-card-hover)] transition-all duration-200 hover:scale-[1.01]`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${f.dark ? "bg-white/10" : "bg-white/80"}`}>
                  <Icon className={`w-5 h-5 ${f.iconColor}`} />
                </div>
                <h3 className={`text-lg font-semibold mb-2 ${f.dark ? "text-white" : "text-[var(--color-foreground)]"}`}>
                  {f.title}
                </h3>
                <p className={`text-sm leading-relaxed ${f.dark ? "text-white/70" : "text-[var(--color-muted-foreground)]"}`}>
                  {f.desc}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
