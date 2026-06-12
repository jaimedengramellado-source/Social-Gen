"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import type { HookVariants } from "@/types";

interface HookComparatorProps {
  variants: HookVariants;
  onSelect: (hook: string, type: string) => void;
}

const hookTypes = [
  { key: "aggressive" as const, label: "Agresivo / Shock", color: "border-red-300 bg-red-50", labelColor: "text-red-700 bg-red-100", emoji: "⚡" },
  { key: "curious" as const, label: "Curioso / Intriga", color: "border-amber-300 bg-amber-50", labelColor: "text-amber-700 bg-amber-100", emoji: "🔍" },
  { key: "emotional" as const, label: "Emocional / Conexión", color: "border-purple-300 bg-purple-50", labelColor: "text-purple-700 bg-purple-100", emoji: "❤️" },
];

export function HookComparator({ variants, onSelect }: HookComparatorProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold mb-1">Hook Comparator</h3>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Elige el hook que más te gusta. El guion final lo usará.
        </p>
      </div>
      <div className="grid gap-3">
        {hookTypes.map(({ key, label, color, labelColor, emoji }, i) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, delay: i * 0.08 }}
            className={`rounded-xl border p-4 ${color} hover:shadow-sm transition-all`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mb-2 ${labelColor}`}>
                  {emoji} {label}
                </span>
                <p className="text-sm font-medium leading-snug">"{variants[key]}"</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSelect(variants[key], key)}
                className="shrink-0"
              >
                Usar este
              </Button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
