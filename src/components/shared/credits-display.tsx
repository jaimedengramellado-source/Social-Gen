"use client";

import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/types";

export function CreditsDisplay({ profile }: { profile: Profile }) {
  const { credits_remaining, credits_total, plan } = profile;
  const unlimited = credits_remaining === -1;
  const pct = unlimited ? 100 : credits_total > 0 ? (credits_remaining / credits_total) * 100 : 0;
  const isLow = !unlimited && pct < 20 && pct > 5;
  const isCritical = !unlimited && pct <= 5;

  return (
    <div className={`rounded-xl p-4 border ${
      isCritical
        ? "border-[var(--color-destructive)]/30 bg-red-50"
        : isLow
        ? "border-[var(--color-warning)]/30 bg-amber-50"
        : "border-[var(--color-border)] bg-white"
    }`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          Créditos
        </span>
        <span className={`text-xs font-medium ${
          isCritical ? "text-[var(--color-destructive)]" : isLow ? "text-[var(--color-warning)]" : "text-[var(--color-muted-foreground)]"
        }`}>
          {isCritical ? "¡Pocos!" : isLow ? "Pocos créditos" : plan.charAt(0).toUpperCase() + plan.slice(1)}
        </span>
      </div>

      <div className="flex items-end gap-1 mb-2">
        <span className="text-xl font-bold tabular-nums">{unlimited ? "∞" : credits_remaining}</span>
        {!unlimited && <span className="text-xs text-[var(--color-muted-foreground)] mb-0.5">/ {credits_total}</span>}
      </div>

      <Progress value={pct} className={`h-1.5 mb-3 ${isCritical ? "[&>*]:bg-[var(--color-destructive)]" : isLow ? "[&>*]:bg-[var(--color-warning)]" : ""}`} />

      {isCritical && (
        <Button asChild size="sm" className="w-full" variant="destructive">
          <Link href="/pricing">Comprar créditos</Link>
        </Button>
      )}
      {isLow && !isCritical && (
        <Button asChild size="sm" className="w-full" variant="outline">
          <Link href="/pricing">Comprar más</Link>
        </Button>
      )}
    </div>
  );
}
