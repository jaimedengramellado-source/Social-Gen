"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import {
  TrafficData, Card, BreakdownBars, fmtNum,
  SOURCE_LABELS, PLAYBACK_LOCATION_LABELS, SHARING_SERVICE_LABELS,
} from "./shared";

export function TrafficTab({ period }: { period: string }) {
  const [data, setData] = useState<TrafficData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/estadisticas/traffic?period=${period}`)
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
        <p className="text-sm text-[var(--color-muted-foreground)] mb-4">No se pudieron cargar los datos de tráfico.</p>
        <button onClick={() => setLoading(true)} className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl border border-[var(--color-border)]">
          <RefreshCw size={13} /> Reintentar
        </button>
      </div>
    );
  }

  const maxSearchViews = data.searchTerms.reduce((m, t) => Math.max(m, t.views), 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <p className="text-xs font-semibold mb-4">Fuentes de tráfico</p>
        <BreakdownBars
          items={data.sources.map(s => ({ label: s.source, views: s.views, pct: s.pct }))}
          labelFor={s => SOURCE_LABELS[s] ?? s}
        />
      </Card>

      <Card>
        <p className="text-xs font-semibold mb-4">Ubicación de reproducción</p>
        <BreakdownBars
          items={data.playbackLocations.map(p => ({ label: p.location, views: p.views, pct: p.pct }))}
          labelFor={p => PLAYBACK_LOCATION_LABELS[p] ?? p}
        />
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Search size={14} style={{ color: "var(--color-primary)" }} />
          <p className="text-xs font-semibold">Términos de búsqueda en YouTube</p>
        </div>
        {data.searchTerms.length === 0 ? (
          <p className="text-xs text-[var(--color-muted-foreground)] py-4 text-center">Sin datos suficientes de búsqueda en este período.</p>
        ) : (
          <div className="space-y-3">
            {data.searchTerms.map(t => (
              <div key={t.term}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="truncate mr-2">{t.term}</span>
                  <span className="font-semibold flex-shrink-0">{fmtNum(t.views)} vistas</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--color-muted)] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${maxSearchViews > 0 ? (t.views / maxSearchViews) * 100 : 0}%`, backgroundColor: "var(--color-primary)" }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <p className="text-xs font-semibold mb-4">Compartido vía</p>
        {data.sharingServices.length === 0 ? (
          <p className="text-xs text-[var(--color-muted-foreground)] py-4 text-center">Aún no hay suficientes comparticiones registradas.</p>
        ) : (
          <BreakdownBars
            items={data.sharingServices.map(s => ({ label: s.service, views: s.views, pct: s.pct }))}
            labelFor={s => SHARING_SERVICE_LABELS[s] ?? s}
            unit="veces"
          />
        )}
      </Card>
    </div>
  );
}
