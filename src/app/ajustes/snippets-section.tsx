"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Snippet } from "@/types";
import { PenLine, Plus, Trash2, Pencil, Check, X, Loader2 } from "lucide-react";

const EXAMPLE_PLACEHOLDERS = {
  name: "Ej: CTA seguirme, Hashtags fitness, Cierre de vídeo...",
  content:
    "Ej: Sígueme para más consejos de fitness 💪 #fitness #gymespaña #vidasana",
};

export function SnippetsSection() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formContent, setFormContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/snippets")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSnippets(data);
      })
      .finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setEditingId(null);
    setFormName("");
    setFormContent("");
    setErr(null);
    setShowForm(true);
  }

  function openEdit(s: Snippet) {
    setEditingId(s.id);
    setFormName(s.name);
    setFormContent(s.content);
    setErr(null);
    setShowForm(true);
  }

  async function save() {
    if (!formName.trim() || !formContent.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      const url = editingId ? `/api/snippets/${editingId}` : "/api/snippets";
      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName, content: formContent }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setErr(json.error ?? "Error al guardar.");
        return;
      }
      setSnippets((prev) =>
        editingId ? prev.map((s) => (s.id === editingId ? json : s)) : [...prev, json]
      );
      setShowForm(false);
    } catch {
      setErr("Error de conexión.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/snippets/${id}`, { method: "DELETE" });
      setSnippets((prev) => prev.filter((s) => s.id !== id));
      if (editingId === id) setShowForm(false);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="bg-white rounded-2xl border p-6 mt-6" style={{ borderColor: "var(--color-border)" }}>
      <div className="flex items-center gap-2 mb-1">
        <PenLine className="w-5 h-5" style={{ color: "var(--color-primary)" }} />
        <h2 className="text-base font-semibold">Firmas y CTAs</h2>
      </div>
      <p className="text-sm mb-5" style={{ color: "var(--color-muted-foreground)" }}>
        Bloques de texto reutilizables (llamadas a la acción, hashtags, cierres). Los insertas
        con un clic desde el chat de Crear.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--color-muted-foreground)" }}>
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
        </div>
      ) : (
        <div className="space-y-2.5">
          {snippets.length === 0 && !showForm && (
            <p className="text-sm py-2" style={{ color: "var(--color-muted-foreground)" }}>
              Aún no tienes firmas guardadas.
            </p>
          )}

          {snippets.map((s) => (
            <div
              key={s.id}
              className="flex items-start gap-3 rounded-xl border px-4 py-3"
              style={{ borderColor: "var(--color-border)" }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{s.name}</p>
                <p className="text-xs mt-0.5 line-clamp-2 whitespace-pre-line" style={{ color: "var(--color-muted-foreground)" }}>
                  {s.content}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => openEdit(s)}
                  className="p-1.5 rounded-lg hover:bg-[var(--color-muted)] transition-colors"
                  aria-label={`Editar ${s.name}`}
                >
                  <Pencil size={13} style={{ color: "var(--color-muted-foreground)" }} />
                </button>
                <button
                  onClick={() => remove(s.id)}
                  disabled={deletingId === s.id}
                  className="p-1.5 rounded-lg transition-colors hover:bg-[var(--destructive-muted)]"
                  aria-label={`Eliminar ${s.name}`}
                >
                  {deletingId === s.id ? (
                    <Loader2 size={13} className="animate-spin" style={{ color: "var(--color-destructive)" }} />
                  ) : (
                    <Trash2 size={13} style={{ color: "var(--color-destructive)" }} />
                  )}
                </button>
              </div>
            </div>
          ))}

          {showForm ? (
            <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-muted)" }}>
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={EXAMPLE_PLACEHOLDERS.name}
                  maxLength={60}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label>Contenido</Label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder={EXAMPLE_PLACEHOLDERS.content}
                  className="w-full rounded-lg border px-3 py-2 text-sm resize-none outline-none bg-white"
                  style={{ borderColor: "var(--color-border)" }}
                />
              </div>
              {err && (
                <p className="text-sm" style={{ color: "var(--color-destructive)" }}>{err}</p>
              )}
              <div className="flex items-center gap-2">
                <Button onClick={save} disabled={saving || !formName.trim() || !formContent.trim()} size="sm">
                  {saving ? (
                    <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Guardando...</>
                  ) : (
                    <><Check className="w-4 h-4 mr-1" />{editingId ? "Guardar cambios" : "Crear firma"}</>
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowForm(false)} disabled={saving}>
                  <X className="w-4 h-4 mr-1" />Cancelar
                </Button>
              </div>
            </div>
          ) : (
            snippets.length < 20 && (
              <Button variant="outline" size="sm" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-1" />Nueva firma
              </Button>
            )
          )}
        </div>
      )}
    </section>
  );
}
