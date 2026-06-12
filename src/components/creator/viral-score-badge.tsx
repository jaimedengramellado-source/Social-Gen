"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ViralScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  animate?: boolean;
}

export function ViralScoreBadge({ score, size = "md", animate = false }: ViralScoreBadgeProps) {
  const [displayed, setDisplayed] = useState(animate ? 0 : score);

  useEffect(() => {
    if (!animate) return;
    let current = 0;
    const step = Math.ceil(score / 20);
    const timer = setInterval(() => {
      current = Math.min(current + step, score);
      setDisplayed(current);
      if (current >= score) clearInterval(timer);
    }, 50);
    return () => clearInterval(timer);
  }, [score, animate]);

  const borderColor =
    score >= 90
      ? "border-emerald-500"
      : score >= 70
      ? "border-green-500"
      : score >= 40
      ? "border-amber-500"
      : "border-red-500";

  const bg =
    score >= 90
      ? "bg-emerald-50 text-emerald-700"
      : score >= 70
      ? "bg-green-50 text-green-700"
      : score >= 40
      ? "bg-amber-50 text-amber-700"
      : "bg-red-50 text-red-700";

  const sizeClasses = {
    sm: "w-10 h-10 text-xs border-2",
    md: "w-12 h-12 text-sm border-2",
    lg: "w-16 h-16 text-lg border-[3px]",
  };

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-bold shrink-0",
        borderColor,
        bg,
        sizeClasses[size]
      )}
    >
      {displayed}
    </div>
  );
}
