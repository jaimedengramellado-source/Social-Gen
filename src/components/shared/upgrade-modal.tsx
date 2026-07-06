"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PRICING_PLANS } from "@/types";
import type { Plan } from "@/types";
import { getTopupCredits, getTopupTier, CREDIT_TIERS } from "@/lib/stripe";
import { Check, Clock, TrendingUp, Wallet, ChevronLeft } from "lucide-react";

const PLAN_ORDER: Plan[] = ["free", "starter", "pro", "agency"];
const TOPUP_PRESETS = [5, 10, 25, 50, 100];

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  creditsRemaining?: number;
  plan?: Plan;
}

export function UpgradeModal({ open, onClose, creditsRemaining = 0, plan = "free" }: UpgradeModalProps) {
  const [view, setView] = useState<"choice" | "plans" | "credits">("choice");
  const [loading, setLoading] = useState(false);
  const [billing, setBilling] = useState<"weekly" | "annual">("weekly");
  const [topupAmount, setTopupAmount] = useState("10");
  const [topupRecurring, setTopupRecurring] = useState(false);
  const [buyingCredits, setBuyingCredits] = useState(false);
  const [topupSuccess, setTopupSuccess] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setView("choice");
      setTopupSuccess(false);
    }
  }

  const currentTier = PLAN_ORDER.indexOf(plan);
  const upgradePlans = PRICING_PLANS.filter((p) => PLAN_ORDER.indexOf(p.id as Plan) > Math.max(currentTier, 0));
  const canUpgrade = upgradePlans.length > 0;

  const validTopupAmount = Math.max(5, Math.min(500, parseInt(topupAmount) || 5));
  const topupTier = getTopupTier(validTopupAmount);
  const topupCredits = getTopupCredits(validTopupAmount);
  const nextTopupTier = CREDIT_TIERS.find((t) => t.min > validTopupAmount) ?? null;

  async function handleUpgrade(planId: string) {
    setLoading(true);
    const res = await fetch("/api/stripe/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: planId, billing }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
    setLoading(false);
  }

  async function handleBuyCredits() {
    setBuyingCredits(true);

    // Intento 1: cobro instantáneo con la tarjeta guardada del cliente (sin salir del popup).
    const instantRes = await fetch("/api/stripe/charge-topup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: validTopupAmount, recurring: topupRecurring }),
    });
    const instantData = await instantRes.json();
    if (instantData.instant) {
      setTopupSuccess(true);
      setBuyingCredits(false);
      setTimeout(onClose, 1800);
      return;
    }

    // Fallback: sin tarjeta guardada, requiere 3DS, o fue rechazada — Checkout hospedado.
    const res = await fetch("/api/stripe/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topup: { amount: validTopupAmount, recurring: topupRecurring } }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
    setBuyingCredits(false);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        {view === "choice" ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">Te has quedado sin créditos</DialogTitle>
              <DialogDescription>
                Has usado tus {creditsRemaining === 0 ? "" : `${creditsRemaining} `}créditos disponibles. Elige cómo quieres seguir creando contenido.
              </DialogDescription>
            </DialogHeader>

            <div className={`grid grid-cols-1 ${canUpgrade ? "sm:grid-cols-2" : ""} gap-3 my-2`}>
              {canUpgrade && (
                <div className="flex flex-col rounded-xl border border-[var(--color-border)] bg-white p-5">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center mb-3"
                    style={{ backgroundColor: "var(--color-primary)" }}
                  >
                    <TrendingUp className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-sm font-semibold mb-1">Actualizar plan</p>
                  <p className="text-xs text-[var(--color-muted-foreground)] mb-4 flex-1">
                    Más créditos cada semana y funciones exclusivas.
                  </p>
                  <Button size="sm" className="w-full" onClick={() => setView("plans")}>
                    Ver planes
                  </Button>
                </div>
              )}

              <div className="flex flex-col rounded-xl border border-[var(--color-border)] bg-white p-5">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center mb-3"
                  style={{ backgroundColor: "var(--color-muted)" }}
                >
                  <Wallet className="w-4 h-4" style={{ color: "var(--color-muted-foreground)" }} />
                </div>
                <p className="text-sm font-semibold mb-1">Comprar créditos</p>
                <p className="text-xs text-[var(--color-muted-foreground)] mb-4 flex-1">
                  Añade créditos puntuales sin cambiar de plan.
                </p>
                <Button size="sm" variant="outline" className="w-full" onClick={() => setView("credits")}>
                  Comprar
                </Button>
              </div>
            </div>

            <button
              onClick={onClose}
              className="flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] mx-auto mt-1 transition-colors"
            >
              <Clock className="w-3.5 h-3.5" />
              Esperar a que se recarguen mis créditos
            </button>
          </>
        ) : view === "credits" ? topupSuccess ? (
          <div className="flex flex-col items-center py-8">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: "var(--color-success)" }}
            >
              <Check className="w-6 h-6 text-white" />
            </div>
            <p className="text-base font-semibold mb-1">¡Créditos añadidos!</p>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {topupCredits} créditos ya están en tu cuenta.
            </p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <button
                onClick={() => setView("choice")}
                className="flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] mb-1 w-fit"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Volver
              </button>
              <DialogTitle className="text-xl font-semibold">Comprar créditos</DialogTitle>
              <DialogDescription>Añade créditos puntuales a tu cuenta, sin cambiar de plan.</DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center my-2">
              <div className="flex items-start justify-center">
                <span className="text-2xl font-medium mt-2 mr-1 select-none" style={{ color: "var(--color-muted-foreground)" }}>
                  €
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value.replace(/[^0-9]/g, ""))}
                  onBlur={() => setTopupAmount(String(validTopupAmount))}
                  className="bg-transparent border-none outline-none text-center tabular-nums leading-none font-semibold"
                  style={{
                    fontSize: "3rem",
                    letterSpacing: "-0.04em",
                    width: `${Math.max(1.5, (topupAmount || "0").length + 0.5)}ch`,
                  }}
                />
              </div>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm font-medium text-[var(--color-muted-foreground)]">{topupCredits} créditos</p>
                {topupTier.bonus > 0 && (
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: "var(--color-primary-light)", color: "var(--color-primary)" }}
                  >
                    +{topupTier.bonus}%
                  </span>
                )}
              </div>
              {nextTopupTier && (
                <p className="text-xs mt-1" style={{ color: "var(--color-muted-foreground)" }}>
                  Desde {nextTopupTier.min}€, {nextTopupTier.rate} créditos/€
                  {topupTier.bonus === 0
                    ? ` (+${nextTopupTier.bonus}% más)`
                    : ` (+${nextTopupTier.bonus - topupTier.bonus}% adicional)`}
                </p>
              )}
            </div>

            <div className="flex gap-2 flex-wrap justify-center my-2">
              {TOPUP_PRESETS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setTopupAmount(String(amt))}
                  className="px-4 py-1.5 rounded-full text-sm font-medium border transition-all"
                  style={
                    validTopupAmount === amt
                      ? { backgroundColor: "var(--color-foreground)", color: "#fff", borderColor: "var(--color-foreground)" }
                      : { borderColor: "var(--color-border)", color: "var(--color-muted-foreground)", backgroundColor: "transparent" }
                  }
                >
                  {amt}€
                </button>
              ))}
            </div>

            <div className="flex rounded-xl overflow-hidden border my-2" style={{ borderColor: "var(--color-border)" }}>
              <button
                onClick={() => setTopupRecurring(false)}
                className="flex-1 py-2.5 text-sm font-medium transition-all"
                style={
                  !topupRecurring
                    ? { backgroundColor: "var(--color-foreground)", color: "#fff" }
                    : { color: "var(--color-muted-foreground)" }
                }
              >
                Pago único
              </button>
              <button
                onClick={() => setTopupRecurring(true)}
                className="flex-1 py-2.5 text-sm font-medium transition-all border-l"
                style={
                  topupRecurring
                    ? { backgroundColor: "var(--color-foreground)", color: "#fff", borderColor: "var(--color-border)" }
                    : { color: "var(--color-muted-foreground)", borderColor: "var(--color-border)" }
                }
              >
                Mensual
              </button>
            </div>

            <Button className="w-full h-11" onClick={handleBuyCredits} disabled={buyingCredits}>
              {buyingCredits
                ? "Procesando..."
                : topupRecurring
                ? `Añadir ${topupCredits} créditos/mes — ${validTopupAmount},00€/mes`
                : `Comprar ${topupCredits} créditos — ${validTopupAmount},00€`}
            </Button>
            {topupRecurring && (
              <p className="text-xs text-center mt-2" style={{ color: "var(--color-muted-foreground)" }}>
                Se cobra {validTopupAmount},00€ cada mes. Cancela cuando quieras.
              </p>
            )}
          </>
        ) : (
          <>
            <DialogHeader>
              <button
                onClick={() => setView("choice")}
                className="flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] mb-1 w-fit"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Volver
              </button>
              <DialogTitle className="text-xl font-semibold">Mejora tu plan</DialogTitle>
              <DialogDescription>Desbloquea más créditos y funciones exclusivas.</DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={() => setBilling("weekly")}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${billing === "weekly" ? "bg-[var(--color-foreground)] text-white" : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"}`}
              >
                Semanal
              </button>
              <button
                onClick={() => setBilling("annual")}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${billing === "annual" ? "bg-[var(--color-foreground)] text-white" : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"}`}
              >
                Anual <span className="text-[var(--color-success)] text-xs font-semibold ml-1">2 meses gratis</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-2">
              {upgradePlans.map((p) => {
                const displayPrice = billing === "weekly"
                  ? p.price_weekly.toFixed(2).replace(".", ",")
                  : (p.price_annual_total / 52).toFixed(2).replace(".", ",");

                return (
                  <div
                    key={p.id}
                    className={`rounded-xl p-5 border ${
                      p.highlighted
                        ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]"
                        : "border-[var(--color-border)] bg-white"
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)] mb-1">
                      {p.name}
                    </p>
                    <p className="text-2xl font-bold mb-0.5">
                      {displayPrice}€<span className="text-sm font-normal text-[var(--color-muted-foreground)]">/sem</span>
                    </p>
                    {billing === "annual" && (
                      <p className="text-xs text-[var(--color-muted-foreground)] mb-1">
                        {p.price_annual_total.toFixed(2).replace(".", ",")}€/año
                      </p>
                    )}
                    <p className="text-xs text-[var(--color-muted-foreground)] mb-4">{p.credits} créditos/semana</p>
                    <ul className="space-y-1 mb-4">
                      {p.features.slice(0, 3).map((f) => (
                        <li key={f} className="flex items-center gap-1.5 text-xs">
                          <Check className="w-3 h-3 text-[var(--color-success)]" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Button
                      size="sm"
                      className="w-full"
                      variant={p.highlighted ? "default" : "outline"}
                      onClick={() => handleUpgrade(p.id)}
                      disabled={loading}
                    >
                      Elegir {p.name}
                    </Button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
