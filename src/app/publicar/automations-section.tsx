"use client";

import { useState } from "react";
import { Zap, Plus, Trash2, Loader2, Mail } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { PostAutomation } from "@/types";

const THRESHOLD_OPTIONS = [100, 500, 1000, 5000, 10000, 50000, 100000];

function fmt(n: number): string {
  return n.toLocaleString("es-ES");
}

interface Props {
  enabled: boolean;
  initialAutomations: PostAutomation[];
}

export function AutomationsSection({ enabled, initialAutomations }: Props) {
  const [automations, setAutomations] = useState<PostAutomation[]>(initialAutomations);
  const [showForm, setShowForm] = useState(false);
  const [threshold, setThreshold] = useState(1000);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threshold }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error ?? "Error al crear.");
        return;
      }
      setAutomations((prev) => [...prev, json].sort((a, b) => a.threshold - b.threshold));
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function toggle(automation: PostAutomation, active: boolean) {
    setAutomations((prev) => prev.map((a) => (a.id === automation.id ? { ...a, active } : a)));
    const res = await fetch(`/api/automations/${automation.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    if (!res.ok) {
      setAutomations((prev) => prev.map((a) => (a.id === automation.id ? { ...a, active: !active } : a)));
    }
  }

  async function remove(id: string) {
    setAutomations((prev) => prev.filter((a) => a.id !== id));
    await fetch(`/api/automations/${id}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <section className="mt-8">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--color-muted-foreground)" }}>
          Automatizaciones
        </h2>
        {!enabled && (
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ backgroundColor: "var(--color-primary-light)", color: "var(--color-primary)" }}
          >
            Próximamente
          </span>
        )}
      </div>
      <p className="text-xs mb-3" style={{ color: "var(--color-muted-foreground)" }}>
        Recibe un email cuando un vídeo reciente de tu canal supere un hito de visitas —
        el mejor momento para responder comentarios y aprovechar el impulso.
      </p>

      {!enabled ? (
        <div
          className="rounded-2xl border border-dashed px-5 py-6 text-center text-sm"
          style={{ borderColor: "var(--color-border)", color: "var(--color-muted-foreground)" }}
        >
          <Zap size={18} className="mx-auto mb-2" style={{ color: "var(--color-primary)" }} />
          Alertas de hitos, reposts automáticos y más. Lo estamos preparando.
        </div>
      ) : (
        <div className="space-y-2">
          {automations.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 bg-white rounded-2xl border px-4 py-3"
              style={{ borderColor: "var(--color-border)" }}
            >
              <Zap size={15} className="flex-shrink-0" style={{ color: a.active ? "var(--color-primary)" : "var(--color-muted-foreground)" }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  Vídeo supera {fmt(a.threshold)} visitas
                </p>
                <p className="text-[11px] flex items-center gap-1" style={{ color: "var(--color-muted-foreground)" }}>
                  <Mail size={10} /> Aviso por email · YouTube
                </p>
              </div>
              <Switch
                checked={a.active}
                onCheckedChange={(checked) => toggle(a, checked)}
                aria-label={`Activar alerta de ${fmt(a.threshold)} visitas`}
              />
              <button
                onClick={() => remove(a.id)}
                className="p-1.5 rounded-lg transition-colors hover:bg-[var(--destructive-muted)]"
                aria-label="Eliminar automatización"
              >
                <Trash2 size={13} style={{ color: "var(--color-destructive)" }} />
              </button>
            </div>
          ))}

          {showForm ? (
            <div
              className="flex items-center gap-2.5 rounded-2xl border px-4 py-3"
              style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-muted)" }}
            >
              <span className="text-sm">Avisarme cuando un vídeo supere</span>
              <select
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="text-sm border border-[var(--color-border)] rounded-lg px-2 py-1.5 outline-none bg-white"
              >
                {THRESHOLD_OPTIONS.map((t) => (
                  <option key={t} value={t}>{fmt(t)}</option>
                ))}
              </select>
              <span className="text-sm">visitas</span>
              <div className="flex-1" />
              <button
                onClick={create}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-50"
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : "Crear"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-3 py-1.5 rounded-lg text-xs border border-[var(--color-border)] hover:bg-white transition-colors"
              >
                Cancelar
              </button>
            </div>
          ) : (
            automations.length < 10 && (
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border border-dashed transition-colors hover:border-[var(--color-primary)]"
                style={{ borderColor: "var(--color-border)", color: "var(--color-primary)" }}
              >
                <Plus size={12} /> Nueva alerta de hito
              </button>
            )
          )}
          {err && <p className="text-xs" style={{ color: "var(--color-destructive)" }}>{err}</p>}
        </div>
      )}
    </section>
  );
}
