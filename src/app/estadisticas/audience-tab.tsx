"use client";

import { useEffect, useState } from "react";
import { Users, RefreshCw } from "lucide-react";
import {
  AudienceData, Card, BreakdownBars, fmtAgeGroup, countryName,
  DEVICE_LABELS, GENDER_LABELS, SUB_STATUS_LABELS,
} from "./shared";

export function AudienceTab({ period }: { period: string }) {
  const [data, setData] = useState<AudienceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/estadisticas/audience?period=${period}`)
      .then(r => r.json())
      .then(d => { if (d.error) { setError(true); } else setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [period]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-64 rounded-2xl bg-[var(--color-muted)] animate-pulse" />)}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-[var(--color-muted-foreground)] mb-4">No se pudieron cargar los datos de audiencia.</p>
        <button onClick={() => setLoading(true)} className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl border border-[var(--color-border)]">
          <RefreshCw size={13} /> Reintentar
        </button>
      </div>
    );
  }

  const genderTotals: Record<string, number> = {};
  for (const d of data.demographics) genderTotals[d.gender] = (genderTotals[d.gender] ?? 0) + d.viewerPercentage;

  const ageTotals: Record<string, number> = {};
  for (const d of data.demographics) ageTotals[d.ageGroup] = (ageTotals[d.ageGroup] ?? 0) + d.viewerPercentage;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <p className="text-xs font-semibold mb-4">Edad de la audiencia</p>
        {Object.keys(ageTotals).length === 0 ? (
          <p className="text-xs text-[var(--color-muted-foreground)] py-4 text-center">Aún no hay datos suficientes.</p>
        ) : (
          <BreakdownBars
            items={Object.entries(ageTotals).sort((a, b) => a[0].localeCompare(b[0])).map(([ageGroup, pct]) => ({ label: ageGroup, views: 0, pct: Math.round(pct) }))}
            labelFor={fmtAgeGroup}
          />
        )}
      </Card>

      <Card>
        <p className="text-xs font-semibold mb-4">Género de la audiencia</p>
        {Object.keys(genderTotals).length === 0 ? (
          <p className="text-xs text-[var(--color-muted-foreground)] py-4 text-center">Aún no hay datos suficientes.</p>
        ) : (
          <BreakdownBars
            items={Object.entries(genderTotals).map(([gender, pct]) => ({ label: gender, views: 0, pct: Math.round(pct) }))}
            labelFor={g => GENDER_LABELS[g] ?? g}
          />
        )}
      </Card>

      <Card>
        <p className="text-xs font-semibold mb-4">Principales países</p>
        <BreakdownBars
          items={data.geography.map(g => ({ label: g.country, views: g.views, pct: g.pct }))}
          labelFor={countryName}
        />
      </Card>

      <Card>
        <p className="text-xs font-semibold mb-4">Dispositivos</p>
        <BreakdownBars
          items={data.devices.map(d => ({ label: d.device, views: d.views, pct: d.pct }))}
          labelFor={d => DEVICE_LABELS[d] ?? d}
        />
      </Card>

      <Card className="md:col-span-2">
        <div className="flex items-center gap-2 mb-4">
          <Users size={14} style={{ color: "var(--color-primary)" }} />
          <p className="text-xs font-semibold">Suscriptores vs. no suscriptores</p>
        </div>
        <BreakdownBars
          items={data.subscribedStatus.map(s => ({ label: s.status, views: s.views, pct: s.pct }))}
          labelFor={s => SUB_STATUS_LABELS[s] ?? s}
        />
      </Card>
    </div>
  );
}
