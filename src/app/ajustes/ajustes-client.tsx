"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { createClient } from "@/lib/supabase/client";
import { PRICING_PLANS, PLAN_CREDITS } from "@/types";
import type { Profile } from "@/types";
import { Check, CreditCard, User, Zap } from "lucide-react";

export function AjustesClient({ profile }: { profile: Profile }) {
  const [name, setName] = useState(profile.full_name || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const pct = profile.credits_total > 0 ? (profile.credits_remaining / profile.credits_total) * 100 : 0;
  const currentPlan = PRICING_PLANS.find((p) => p.id === profile.plan);

  async function handleSaveName() {
    setSaving(true);
    const supabase = createClient();
    await supabase.from("profiles").update({ full_name: name }).eq("id", profile.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleManageBilling() {
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const { url, error } = await res.json();
    if (error === "NO_CUSTOMER") {
      alert("No tienes una suscripción activa.");
      return;
    }
    if (url) window.location.href = url;
  }

  async function handleUpgrade(planId: string) {
    const res = await fetch("/api/stripe/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: planId, billing: "monthly" }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
  }

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-8">Ajustes</h1>

      {/* Profile */}
      <section className="bg-white rounded-2xl border border-[var(--color-border)] p-6 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <User className="w-5 h-5 text-[var(--color-muted-foreground)]" />
          <h2 className="text-base font-semibold">Perfil</h2>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={profile.email || ""} disabled className="opacity-60" />
          </div>
          <Button onClick={handleSaveName} disabled={saving || saved} size="sm">
            {saved ? <><Check className="w-4 h-4" /> Guardado</> : saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </section>

      {/* Credits */}
      <section className="bg-white rounded-2xl border border-[var(--color-border)] p-6 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <Zap className="w-5 h-5 text-[var(--color-muted-foreground)]" />
          <h2 className="text-base font-semibold">Créditos</h2>
        </div>
        <div className="flex items-end gap-2 mb-2">
          <span className="text-3xl font-bold">{profile.credits_remaining === -1 ? "∞" : profile.credits_remaining}</span>
          {profile.credits_remaining !== -1 && <span className="text-[var(--color-muted-foreground)] mb-1">/ {profile.credits_total} créditos</span>}
        </div>
        <Progress value={profile.credits_remaining === -1 ? 100 : pct} className="mb-4" />
        <div className="grid grid-cols-3 gap-3">
          {[
            { credits: 50, price: 9, packId: "pack_50" },
            { credits: 150, price: 19, packId: "pack_150" },
            { credits: 500, price: 49, packId: "pack_500" },
          ].map((pack) => (
            <button
              key={pack.packId}
              onClick={async () => {
                const res = await fetch("/api/stripe/create-checkout", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ packId: pack.packId }),
                });
                const { url } = await res.json();
                if (url) window.location.href = url;
              }}
              className="rounded-xl border border-[var(--color-border)] p-3 text-center hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-all"
            >
              <p className="text-lg font-bold">+{pack.credits}</p>
              <p className="text-xs text-[var(--color-muted-foreground)]">créditos</p>
              <p className="text-sm font-semibold mt-1">${pack.price}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Plan */}
      <section className="bg-white rounded-2xl border border-[var(--color-border)] p-6">
        <div className="flex items-center gap-2 mb-5">
          <CreditCard className="w-5 h-5 text-[var(--color-muted-foreground)]" />
          <h2 className="text-base font-semibold">Plan actual</h2>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-lg capitalize">{profile.plan}</span>
              <Badge variant={profile.plan === "free" ? "secondary" : "purple"}>
                {profile.plan === "free" ? "Gratuito" : "Activo"}
              </Badge>
            </div>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {PLAN_CREDITS[profile.plan]} créditos/mes
            </p>
          </div>
          {profile.stripe_subscription_id && (
            <Button variant="outline" size="sm" onClick={handleManageBilling}>
              Gestionar suscripción
            </Button>
          )}
        </div>

        {profile.plan === "free" && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Actualizar a:</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {PRICING_PLANS.filter((p) => p.id !== "free").map((plan) => (
                <div
                  key={plan.id}
                  className={`rounded-xl border p-4 ${plan.highlighted ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]" : "border-[var(--color-border)]"}`}
                >
                  <p className="font-semibold text-sm mb-0.5">{plan.name}</p>
                  <p className="text-lg font-bold mb-1">${plan.price_monthly}<span className="text-xs font-normal text-[var(--color-muted-foreground)]">/mes</span></p>
                  <p className="text-xs text-[var(--color-muted-foreground)] mb-3">{plan.credits} créditos/mes</p>
                  <Button
                    size="sm"
                    className="w-full"
                    variant={plan.highlighted ? "default" : "outline"}
                    onClick={() => handleUpgrade(plan.id)}
                  >
                    Elegir
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
