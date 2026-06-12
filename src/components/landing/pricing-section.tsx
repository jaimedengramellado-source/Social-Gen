"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import Link from "next/link";
import { PRICING_PLANS } from "@/types";

export function LandingPricing() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  return (
    <section className="py-24 px-6 border-t border-[var(--color-border)]" id="precios">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)] mb-6 text-center">
          Precios
        </p>
        <h2
          className="text-4xl md:text-5xl font-normal mb-4 text-center"
          style={{ fontFamily: "var(--font-instrument-serif)", letterSpacing: "-0.02em" }}
        >
          Un plan para cada creador.
        </h2>
        <p className="text-center text-[var(--color-muted-foreground)] mb-10">
          Empieza gratis. Actualiza cuando lo necesites.
        </p>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <button
            onClick={() => setBilling("monthly")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${billing === "monthly" ? "bg-[var(--color-foreground)] text-white" : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"}`}
          >
            Mensual
          </button>
          <button
            onClick={() => setBilling("annual")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${billing === "annual" ? "bg-[var(--color-foreground)] text-white" : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"}`}
          >
            Anual <span className="text-[var(--color-success)] text-xs font-semibold ml-1">−20%</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PRICING_PLANS.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.07 }}
              className={`relative rounded-2xl p-6 border transition-all duration-200 ${
                plan.highlighted
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-[var(--shadow-popup)]"
                  : "border-[var(--color-border)] bg-white hover:shadow-[var(--shadow-card-hover)]"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-[var(--color-warning)] text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Más popular
                  </span>
                </div>
              )}

              <h3 className={`text-sm font-semibold uppercase tracking-wide mb-1 ${plan.highlighted ? "text-white/70" : "text-[var(--color-muted-foreground)]"}`}>
                {plan.name}
              </h3>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-bold">
                  ${billing === "monthly" ? plan.price_monthly : plan.price_annual}
                </span>
                {plan.price_monthly > 0 && (
                  <span className={`text-sm mb-1 ${plan.highlighted ? "text-white/70" : "text-[var(--color-muted-foreground)]"}`}>/mes</span>
                )}
              </div>
              <p className={`text-xs mb-6 ${plan.highlighted ? "text-white/70" : "text-[var(--color-muted-foreground)]"}`}>
                {plan.credits} créditos/mes
              </p>

              <Link
                href="/signup"
                className={`block w-full text-center rounded-lg py-2.5 text-sm font-medium transition-all hover:-translate-y-px mb-6 ${
                  plan.highlighted
                    ? "bg-white text-[var(--color-primary)] hover:bg-zinc-50"
                    : plan.id === "free"
                    ? "bg-[var(--color-foreground)] text-white hover:bg-zinc-800"
                    : "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]"
                }`}
              >
                {plan.id === "free" ? "Empieza gratis" : "Elegir plan"}
              </Link>

              <ul className="space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className={`w-4 h-4 mt-0.5 shrink-0 ${plan.highlighted ? "text-white" : "text-[var(--color-success)]"}`} />
                    <span className={plan.highlighted ? "text-white/90" : "text-[var(--color-foreground)]"}>{f}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Credit packs */}
        <div className="mt-16 rounded-2xl border border-[var(--color-border)] bg-white p-8">
          <h3 className="text-lg font-semibold mb-2">Packs de créditos extra</h3>
          <p className="text-sm text-[var(--color-muted-foreground)] mb-6">Compra una vez, úsalos cuando quieras. No caducan.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { credits: 50, price: 9, popular: false },
              { credits: 150, price: 19, popular: true },
              { credits: 500, price: 49, popular: false },
            ].map((pack) => (
              <div key={pack.credits} className={`rounded-xl p-4 border text-center relative ${pack.popular ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]" : "border-[var(--color-border)]"}`}>
                {pack.popular && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs font-semibold bg-[var(--color-primary)] text-white px-2 py-0.5 rounded-full">
                    Mejor valor
                  </span>
                )}
                <p className="text-2xl font-bold">{pack.credits}</p>
                <p className="text-sm text-[var(--color-muted-foreground)] mb-2">créditos</p>
                <p className="text-lg font-semibold">${pack.price}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
