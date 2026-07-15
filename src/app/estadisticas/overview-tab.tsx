"use client";

import { Eye, Clock, TrendingUp, UserPlus, UserMinus, ThumbsUp, MessageSquare, Share2, MousePointerClick } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { AnalyticsData, MetricCard, Card, ReachBadge, PRIMARY, YT_RED, fmtNum, fmtPct, fmtDateShort } from "./shared";

function TooltipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[var(--color-border)] rounded-xl p-3 shadow-lg">
      {children}
    </div>
  );
}

export function OverviewTab({ data }: { data: AnalyticsData }) {
  const { overview } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={Eye} label="Vistas" value={fmtNum(overview.views)} sub="totales" />
        <MetricCard icon={Clock} label="Horas vistas" value={fmtNum(overview.watchTimeHours)} sub="tiempo de visualización" />
        <MetricCard icon={TrendingUp} label="Retención media" value={overview.avgViewPercentage > 0 ? fmtPct(overview.avgViewPercentage) : "—"} />
        <MetricCard
          icon={MousePointerClick}
          label="CTR medio"
          value={overview.hasReachData ? fmtPct(overview.ctr * 100) : "—"}
          sub={<ReachBadge hasReachData={overview.hasReachData} reachSyncedUntil={data.reachSyncedUntil} />}
        />
        <MetricCard icon={UserPlus} label="Suscriptores ganados" value={`+${fmtNum(overview.subscribersGained)}`} color="#16a34a" />
        <MetricCard icon={UserMinus} label="Suscriptores perdidos" value={`-${fmtNum(overview.subscribersLost)}`} color="#DC2626" />
        <MetricCard icon={ThumbsUp} label="Me gusta" value={fmtNum(overview.likes)} />
        <MetricCard icon={MessageSquare} label="Comentarios" value={fmtNum(overview.comments)} />
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold">Vistas por día <span className="font-normal text-[var(--color-muted-foreground)]">· últimos {data.trendDays} días</span></p>
          <span className="text-[10px] text-[var(--color-muted-foreground)]">{fmtNum(data.viewsTrend.reduce((s, d) => s + d.views, 0))} vistas en el período</span>
        </div>
        {data.viewsTrend.length === 0 ? (
          <p className="text-xs text-[var(--color-muted-foreground)] text-center py-8">Sin datos recientes.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.viewsTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={PRIMARY} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={fmtDateShort} tick={{ fontSize: 10, fill: "#6B6B6B" }} axisLine={false} tickLine={false} minTickGap={30} />
              <YAxis tickFormatter={fmtNum} tick={{ fontSize: 10, fill: "#6B6B6B" }} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const d = payload[0].payload;
                return (
                  <TooltipBox>
                    <p className="text-[10px] text-[var(--color-muted-foreground)] mb-1">{fmtDateShort(d.date)}</p>
                    <p className="text-sm font-semibold">{fmtNum(d.views)} vistas</p>
                  </TooltipBox>
                );
              }} />
              <Area type="monotone" dataKey="views" stroke={PRIMARY} strokeWidth={2} fill="url(#viewsGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card>
        <p className="text-xs font-semibold mb-4">Suscriptores ganados y perdidos por día <span className="font-normal text-[var(--color-muted-foreground)]">· últimos {data.trendDays} días</span></p>
        {data.subscribersTrend.length === 0 ? (
          <p className="text-xs text-[var(--color-muted-foreground)] text-center py-8">Sin datos recientes.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.subscribersTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={fmtDateShort} tick={{ fontSize: 10, fill: "#6B6B6B" }} axisLine={false} tickLine={false} minTickGap={30} />
              <YAxis tick={{ fontSize: 10, fill: "#6B6B6B" }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const d = payload[0].payload;
                return (
                  <TooltipBox>
                    <p className="text-[10px] text-[var(--color-muted-foreground)] mb-1">{fmtDateShort(d.date)}</p>
                    <p className="text-xs"><span className="font-semibold" style={{ color: "#16a34a" }}>+{d.gained}</span> ganados</p>
                    <p className="text-xs"><span className="font-semibold" style={{ color: YT_RED }}>-{d.lost}</span> perdidos</p>
                  </TooltipBox>
                );
              }} />
              <Bar dataKey="gained" fill="#16a34a" radius={[3, 3, 0, 0]} />
              <Bar dataKey="lost" fill={YT_RED} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <MetricCard icon={Share2} label="Compartidos" value={fmtNum(overview.shares)} />
    </div>
  );
}
