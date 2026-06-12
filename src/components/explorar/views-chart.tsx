"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { formatCount } from "@/lib/youtube";
import type { YTVideo } from "@/lib/youtube";

const YT_RED = "#FF0000";

interface Props {
  videos: YTVideo[];
  avgViews: number;
  outlierIds?: string[];
}

export function ViewsChart({ videos, avgViews, outlierIds }: Props) {
  const data = [...videos].reverse().map((v, i) => ({
    name: `V${i + 1}`,
    views: v.views,
    title: v.title.length > 40 ? v.title.slice(0, 40) + "…" : v.title,
    isOutlier: outlierIds ? outlierIds.includes(v.id) : v.views > avgViews * 2,
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: "#6B6B6B" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => formatCount(v)}
          tick={{ fontSize: 10, fill: "#6B6B6B" }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.[0]) return null;
            const d = payload[0].payload;
            return (
              <div className="bg-white border border-[var(--color-border)] rounded-xl p-3 shadow-lg max-w-48">
                <p className="text-[10px] text-[var(--color-muted-foreground)] mb-1 leading-snug">{d.title}</p>
                <p className="text-sm font-semibold">{formatCount(d.views)} vistas</p>
                {d.isOutlier && (
                  <p className="text-[10px] font-medium mt-1" style={{ color: YT_RED }}>⚡ Outlier</p>
                )}
              </div>
            );
          }}
        />
        <ReferenceLine
          y={avgViews}
          stroke={YT_RED}
          strokeDasharray="4 2"
          strokeWidth={1}
          label={{ value: "Prom.", position: "insideTopRight", fontSize: 9, fill: YT_RED }}
        />
        <Bar dataKey="views" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.isOutlier ? YT_RED : "#E5E5E5"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
