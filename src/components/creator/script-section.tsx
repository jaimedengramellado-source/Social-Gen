"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScriptSectionProps {
  label: string;
  content: string;
  onRegenerate?: () => Promise<void>;
  borderColor?: string;
  bgColor?: string;
  loading?: boolean;
}

export function ScriptSection({
  label,
  content,
  onRegenerate,
  borderColor = "border-purple-400",
  bgColor = "bg-purple-50/30",
  loading = false,
}: ScriptSectionProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [currentContent, setCurrentContent] = useState(content);

  async function handleRegenerate() {
    if (!onRegenerate) return;
    setIsRegenerating(true);
    await onRegenerate();
    setIsRegenerating(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border-l-4 p-5 relative group",
        borderColor,
        bgColor,
        "border border-[var(--color-border)]"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-muted-foreground)]">
          {label}
        </span>
        {onRegenerate && (
          <button
            onClick={handleRegenerate}
            disabled={isRegenerating || loading}
            className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-all px-2 py-1 rounded-md hover:bg-white/80"
          >
            <RotateCcw className={cn("w-3 h-3", (isRegenerating || loading) && "animate-spin")} />
            ↺ regenerar
          </button>
        )}
      </div>

      {(isRegenerating || loading) ? (
        <div className="space-y-2">
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-4/5" />
          <div className="skeleton h-4 w-3/5" />
        </div>
      ) : (
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{currentContent}</p>
      )}
    </motion.div>
  );
}
