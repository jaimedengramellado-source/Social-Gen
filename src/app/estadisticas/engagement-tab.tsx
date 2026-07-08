"use client";

import { ThumbsUp, MessageSquare, Share2, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { AnalyticsData, MetricCard, Card, fmtNum, fmtPct, fmtDateShort } from "./shared";

export function EngagementTab({ data }: { data: AnalyticsData }) {
  const { overview } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard icon={ThumbsUp} label="Me gusta" value={fmtNum(overview.likes)} color="#16a34a" />
        <MetricCard icon={MessageSquare} label="Comentarios" value={fmtNum(overview.comments)} color="#2563eb" />
        <MetricCard icon={Share2} label="Compartidos" value={fmtNum(overview.shares)} />
        <MetricCard icon={TrendingUp} label="Retención media" value={overview.avgViewPercentage > 0 ? fmtPct(overview.avgViewPercentage) : "—"} />
      </div>

      <Card>
        <p className="text-xs font-semibold mb-4">Interacción por día</p>
        {data.viewsTrend.length === 0 ? (
          <p className="text-xs text-[var(--color-muted-foreground)] text-center py-8">Sin datos en este período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.viewsTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={fmtDateShort} tick={{ fontSize: 10, fill: "#6B6B6B" }} axisLine={false} tickLine={false} minTickGap={30} />
              <YAxis tick={{ fontSize: 10, fill: "#6B6B6B" }} axisLine={false} tickLine={false} width={30} />
              <Tooltip
                labelFormatter={(v) => fmtDateShort(String(v))}
                contentStyle={{ borderRadius: 12, border: "1px solid var(--color-border)", fontSize: 11 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="likes" name="Me gusta" stroke="#16a34a" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="comments" name="Comentarios" stroke="#2563eb" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="shares" name="Compartidos" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
