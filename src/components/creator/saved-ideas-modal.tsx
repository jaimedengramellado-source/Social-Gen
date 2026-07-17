"use client";

import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { ViralScoreBadge } from "@/components/creator/viral-score-badge";
import { Bookmark, Folder, Trash2 } from "lucide-react";

interface SavedIdea {
  id: string;
  title: string;
  description: string | null;
  viral_score: number | null;
  hook_type: string | null;
  content_style: string | null;
  project_id: string | null;
  created_at: string;
  project: { name: string } | null;
}

interface SavedIdeasModalProps {
  open: boolean;
  onClose: () => void;
  onDeleted?: () => void;
}

export function SavedIdeasModal({ open, onClose, onDeleted }: SavedIdeasModalProps) {
  const [ideas, setIdeas] = useState<SavedIdea[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/ideas")
      .then(r => r.json())
      .then(d => { if (d.ideas) setIdeas(d.ideas); })
      .finally(() => setLoading(false));
  }, [open]);

  async function handleDelete(id: string) {
    const prev = ideas;
    setIdeas(ideas.filter(i => i.id !== id));
    const res = await fetch(`/api/ideas/${id}`, { method: "DELETE" });
    if (!res.ok) { setIdeas(prev); return; }
    onDeleted?.();
  }

  const groups: { id: string; name: string; ideas: SavedIdea[] }[] = [];
  const groupIndex = new Map<string, number>();
  const unfiled: SavedIdea[] = [];

  for (const idea of ideas) {
    if (idea.project_id) {
      let idx = groupIndex.get(idea.project_id);
      if (idx === undefined) {
        idx = groups.length;
        groupIndex.set(idea.project_id, idx);
        groups.push({ id: idea.project_id, name: idea.project?.name || "Carpeta", ideas: [] });
      }
      groups[idx].ideas.push(idea);
    } else {
      unfiled.push(idea);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <Bookmark size={18} style={{ color: "var(--color-primary)" }} />
            Ideas guardadas
          </DialogTitle>
          <DialogDescription>
            Todas las ideas que has guardado desde el chat de IA.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-[var(--color-muted-foreground)] py-8 text-center">Cargando…</p>
        ) : ideas.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-3xl mb-2">🔖</p>
            <p className="text-sm font-medium mb-1">Aún no has guardado ninguna idea</p>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              Pulsa &quot;Guardar&quot; en las ideas que la IA te proponga en el chat.
            </p>
          </div>
        ) : (
          <div className="space-y-5 mt-1">
            {groups.map(group => (
              <div key={group.id}>
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-2">
                  <Folder size={11} /> {group.name}
                </p>
                <div className="space-y-2">
                  {group.ideas.map(idea => <SavedIdeaRow key={idea.id} idea={idea} onDelete={handleDelete} />)}
                </div>
              </div>
            ))}
            {unfiled.length > 0 && (
              <div>
                {groups.length > 0 && (
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-muted-foreground)] mb-2">
                    Sin carpeta
                  </p>
                )}
                <div className="space-y-2">
                  {unfiled.map(idea => <SavedIdeaRow key={idea.id} idea={idea} onDelete={handleDelete} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SavedIdeaRow({ idea, onDelete }: { idea: SavedIdea; onDelete: (id: string) => void }) {
  return (
    <div className="p-3 rounded-xl border border-[var(--color-border)] flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug">{idea.title}</p>
        {idea.description && (
          <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5 leading-relaxed line-clamp-2">
            {idea.description}
          </p>
        )}
        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
          {idea.hook_type && (
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "var(--color-primary-light)", color: "var(--color-primary)" }}
            >
              {idea.hook_type}
            </span>
          )}
          {idea.content_style && (
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "var(--color-muted)", color: "var(--color-muted-foreground)" }}
            >
              {idea.content_style}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {idea.viral_score != null && <ViralScoreBadge score={idea.viral_score} size="sm" />}
        <button
          onClick={() => onDelete(idea.id)}
          className="p-1.5 rounded-lg hover:bg-red-50 text-[var(--color-muted-foreground)] hover:text-red-500 transition-colors"
          title="Eliminar idea"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
