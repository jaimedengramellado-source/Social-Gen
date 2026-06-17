"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import Link from "next/link";
import { PRICING_PLANS } from "@/types";

export function LandingPricing() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

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
        <p className="text-center text-[var(--color-muted-foreground)] mb-12">
          Empieza gratis. Actualiza cuando lo necesites.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PRICING_PLANS.map((plan, i) => {
            const annualWeeklyEquiv = plan.price_annual_total > 0
              ? (plan.price_annual_total / 52).toFixed(2).replace(".", ",")
              : "0";
            const isPickingBilling = selectedPlan === plan.id;

            return (
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
                      Recomendado
                    </span>
                  </div>
                )}

                <h3 className={`text-sm font-semibold uppercase tracking-wide mb-1 ${plan.highlighted ? "text-white/70" : "text-[var(--color-muted-foreground)]"}`}>
                  {plan.name}
                </h3>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-4xl font-bold">
                    {plan.price_weekly > 0 ? `${plan.price_weekly.toFixed(2).replace(".", ",")}€` : "Gratis"}
                  </span>
                  {plan.price_weekly > 0 && (
                    <span className={`text-sm mb-1 ${plan.highlighted ? "text-white/70" : "text-[var(--color-muted-foreground)]"}`}>/sem</span>
                  )}
                </div>
                <p className={`text-xs mb-6 ${plan.highlighted ? "text-white/70" : "text-[var(--color-muted-foreground)]"}`}>
                  {plan.credits} créditos/semana
                </p>

                {plan.id === "free" ? (
                  <Link
                    href="/signup"
                    className="block w-full text-center rounded-lg py-2.5 text-sm font-medium transition-all hover:-translate-y-px mb-6 bg-[var(--color-foreground)] text-white hover:bg-zinc-800"
                  >
                    Empieza gratis
                  </Link>
                ) : !isPickingBilling ? (
                  <button
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`w-full block text-center rounded-lg py-2.5 text-sm font-medium transition-all hover:-translate-y-px mb-6 ${
                      plan.highlighted
                        ? "bg-white text-[var(--color-primary)] hover:bg-zinc-50"
                        : "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]"
                    }`}
                  >
                    Elegir plan
                  </button>
                ) : (
                  <div className="mb-6 space-y-2">
                    <p className={`text-xs font-semibold mb-2 ${plan.highlighted ? "text-white/70" : "text-[var(--color-muted-foreground)]"}`}>
                      ¿Cómo quieres pagar?
                    </p>
                    <Link
                      href={`/signup?plan=${plan.id}&billing=weekly`}
                      className={`flex flex-col items-center rounded-lg py-2.5 text-sm font-medium transition-all ${
                        plan.highlighted
                          ? "bg-white/15 text-white hover:bg-white/25"
                          : "border border-[var(--color-border)] text-[var(--color-foreground)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                      }`}
                    >
                      Semanal
                      <span className={`text-xs font-normal mt-0.5 ${plan.highlighted ? "text-white/60" : "text-[var(--color-muted-foreground)]"}`}>
                        {plan.price_weekly.toFixed(2).replace(".", ",")}€/semana
                      </span>
                    </Link>
                    <Link
                      href={`/signup?plan=${plan.id}&billing=annual`}
                      className={`flex flex-col items-center rounded-lg py-2.5 text-sm font-medium transition-all ${
                        plan.highlighted
                          ? "bg-white text-[var(--color-primary)] hover:bg-zinc-50"
                          : "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        Anual
                        <span className="text-xs font-semibold text-[var(--color-success)]">2 meses gratis</span>
                      </span>
                      <span className={`text-xs font-normal mt-0.5 ${plan.highlighted ? "text-[var(--color-primary)]/60" : "text-white/70"}`}>
                        {annualWeeklyEquiv}€/sem · {plan.price_annual_total.toFixed(2).replace(".", ",")}€/año
                      </span>
                    </Link>
                    <button
                      onClick={() => setSelectedPlan(null)}
                      className={`w-full text-center text-xs py-1 transition-colors ${
                        plan.highlighted ? "text-white/40 hover:text-white/60" : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                      }`}
                    >
                      Cancelar
                    </button>
                  </div>
                )}

                <ul className="space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className={`w-4 h-4 mt-0.5 shrink-0 ${plan.highlighted ? "text-white" : "text-[var(--color-success)]"}`} />
                      <span className={plan.highlighted ? "text-white/90" : "text-[var(--color-foreground)]"}>{f}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
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
                <p className="text-lg font-semibold">{pack.price}€</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
