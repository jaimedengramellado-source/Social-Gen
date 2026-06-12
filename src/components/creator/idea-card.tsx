"use client";

import { motion } from "framer-motion";
import { ViralScoreBadge } from "./viral-score-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookmarkPlus, Zap } from "lucide-react";
import type { Idea } from "@/types";

interface IdeaCardProps {
  idea: Idea;
  index: number;
  onSelect: (idea: Idea) => void;
  onSave: (id: string) => void;
}

export function IdeaCard({ idea, index, onSelect, onSave }: IdeaCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="bg-white rounded-xl border border-[var(--color-border)] p-5 hover:shadow-[var(--shadow-card-hover)] hover:scale-[1.01] transition-all duration-200 group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-semibold text-sm leading-snug flex-1">{idea.title}</h3>
        <ViralScoreBadge score={idea.viral_score} animate />
      </div>

      <p className="text-xs text-[var(--color-muted-foreground)] mb-3 leading-relaxed">
        {idea.description}
      </p>

      {idea.why_viral && (
        <p className="text-xs text-[var(--color-primary)] bg-[var(--color-primary-light)] rounded-lg px-2.5 py-1.5 mb-3">
          💡 {idea.why_viral}
        </p>
      )}

      <div className="flex items-center gap-2 mb-4">
        <Badge variant="purple" className="text-xs">{idea.hook_type}</Badge>
        <Badge variant="secondary" className="text-xs">{idea.content_style}</Badge>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="flex-1"
          onClick={() => onSelect(idea)}
        >
          <Zap className="w-3.5 h-3.5" />
          Generar guion
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onSave(idea.id)}
          className={idea.is_saved ? "text-[var(--color-primary)]" : ""}
        >
          <BookmarkPlus className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}
