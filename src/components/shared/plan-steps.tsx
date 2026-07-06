"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

const STEPS = ["Crea tu cuenta", "Pago", "Configura tu IA"];

export function PlanSteps({ current }: { current: 1 | 2 | 3 }) {
  const fillPct = ((current - 1) / (STEPS.length - 1)) * 100;
  const prevFillPct = (Math.max(current - 2, 0) / (STEPS.length - 1)) * 100;

  return (
    <div className="mb-8 mx-auto w-full max-w-xs">
      <div className="relative">
        {/* Barra que conecta los centros de los 3 círculos */}
        <div
          className="absolute top-3 h-0.5 -translate-y-1/2 rounded-full"
          style={{
            left: `calc(100% / ${STEPS.length * 2})`,
            right: `calc(100% / ${STEPS.length * 2})`,
            backgroundColor: "var(--color-border)",
          }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: "var(--color-primary)" }}
            initial={{ width: `${prevFillPct}%` }}
            animate={{ width: `${fillPct}%` }}
            transition={{ duration: 0.6, ease: "easeInOut", delay: 0.2 }}
          />
        </div>

        <div className="relative flex">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const done = n < current;
            const active = n === current;
            return (
              <div key={label} className="flex-1 flex flex-col items-center gap-1.5">
                <span
                  className="relative w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold"
                  style={
                    done
                      ? { backgroundColor: "var(--color-primary)", color: "white" }
                      : {
                          backgroundColor: "var(--color-background)",
                          color: "var(--color-muted-foreground)",
                          border: "1px solid var(--color-border)",
                        }
                  }
                >
                  {done ? <Check className="w-3.5 h-3.5" /> : n}
                  {active && (
                    <motion.span
                      className="absolute -inset-px rounded-full flex items-center justify-center"
                      style={{ backgroundColor: "var(--color-primary)", color: "white" }}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, ease: "easeOut", delay: 0.75 }}
                    >
                      {n}
                    </motion.span>
                  )}
                </span>
                <span
                  className="text-[11px] font-medium text-center leading-tight"
                  style={{ color: done || active ? "var(--color-foreground)" : "var(--color-muted-foreground)" }}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
