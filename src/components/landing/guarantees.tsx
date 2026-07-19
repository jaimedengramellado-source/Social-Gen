"use client";

import { motion } from "framer-motion";
import { Gift, RotateCcw, ShieldCheck, Infinity as InfinityIcon } from "lucide-react";

const guarantees = [
  {
    icon: Gift,
    title: "Sin tarjeta para empezar",
    desc: "Genera tus primeras ideas y un guion completo gratis. Solo pedimos tarjeta si decides quedarte.",
  },
  {
    icon: RotateCcw,
    title: "Cancela cuando quieras",
    desc: "Un clic en tu portal de facturación. Sin llamadas, sin letra pequeña, conservas lo pagado hasta el final del periodo.",
  },
  {
    icon: ShieldCheck,
    title: "Tus redes, bajo tu control",
    desc: "Conectamos YouTube, TikTok o Instagram solo para lo que tú autorizas. Desconecta cuando quieras y revocamos el acceso al instante.",
  },
  {
    icon: InfinityIcon,
    title: "Los créditos comprados no caducan",
    desc: "Los de tu plan se renuevan cada semana; los de los packs extra son tuyos para siempre.",
  },
];

export function LandingGuarantees() {
  return (
    <section className="py-24 px-6 border-t border-[var(--color-border)]">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)] mb-6">
          Garantías
        </p>
        <h2
          className="text-4xl md:text-5xl font-normal mb-16 leading-tight"
          style={{ fontFamily: "var(--font-instrument-serif)", letterSpacing: "-0.02em" }}
        >
          Así protegemos tu tiempo<br />y tus datos.
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {guarantees.map((g, i) => {
            const Icon = g.icon;
            return (
              <motion.div
                key={g.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="flex flex-col gap-3"
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-[var(--color-primary-light)]">
                  <Icon className="w-5 h-5 text-[var(--color-primary)]" />
                </div>
                <h3 className="text-base font-semibold">{g.title}</h3>
                <p className="text-sm text-[var(--color-muted-foreground)] leading-relaxed">{g.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
