"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PRICING_PLANS } from "@/types";
import { Check } from "lucide-react";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  creditsRemaining?: number;
}

export function UpgradeModal({ open, onClose, creditsRemaining = 0 }: UpgradeModalProps) {
  const [loading, setLoading] = useState(false);
  const plans = PRICING_PLANS.filter((p) => p.id !== "free");

  async function handleUpgrade(planId: string) {
    setLoading(true);
    const res = await fetch("/api/stripe/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: planId, billing: "monthly" }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {creditsRemaining === 0 ? "Sin créditos" : "Mejora tu plan"}
          </DialogTitle>
          <DialogDescription>
            {creditsRemaining === 0
              ? "Has usado todos tus créditos. Actualiza para seguir generando contenido viral."
              : "Desbloquea más créditos y funciones exclusivas."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-2">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-xl p-5 border ${
                plan.highlighted
                  ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]"
                  : "border-[var(--color-border)] bg-white"
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)] mb-1">
                {plan.name}
              </p>
              <p className="text-2xl font-bold mb-1">${plan.price_monthly}<span className="text-sm font-normal text-[var(--color-muted-foreground)]">/mes</span></p>
              <p className="text-xs text-[var(--color-muted-foreground)] mb-4">{plan.credits} créditos/mes</p>
              <ul className="space-y-1 mb-4">
                {plan.features.slice(0, 3).map((f) => (
                  <li key={f} className="flex items-center gap-1.5 text-xs">
                    <Check className="w-3 h-3 text-[var(--color-success)]" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                size="sm"
                className="w-full"
                variant={plan.highlighted ? "default" : "outline"}
                onClick={() => handleUpgrade(plan.id)}
                disabled={loading}
              >
                Elegir {plan.name}
              </Button>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} size="sm">
            Ahora no
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
