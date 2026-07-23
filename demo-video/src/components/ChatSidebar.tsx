import React from "react";
import { useCurrentFrame } from "remotion";
import {
  Search,
  Plus,
  Folder,
  FileText,
  MessageSquare,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { fadeUp } from "./reveal";
import { colors } from "../theme";
import { fontFamilySans } from "../fonts";

const HISTORY: {
  group: string;
  items: { icon: typeof FileText; title: string; time: string }[];
}[] = [
  {
    group: "Hoy",
    items: [
      { icon: FileText, title: "Guion sobre rutina matutina", time: "ahora" },
    ],
  },
  {
    group: "Esta semana",
    items: [
      { icon: Sparkles, title: "3 ideas virales para fitness", time: "hace 2d" },
      { icon: MessageSquare, title: "Hook para vídeo de cocina", time: "hace 3d" },
      { icon: FileText, title: "Guion guiado: viaje low-cost", time: "hace 4d" },
      { icon: MessageSquare, title: "Estrategia semanal de contenido", time: "hace 5d" },
    ],
  },
];

export const ChatSidebar: React.FC<{ startFrame?: number; active?: boolean }> = ({
  startFrame = 4,
  active = true,
}) => {
  const frame = useCurrentFrame();
  const style = fadeUp(frame, startFrame, 10);

  return (
    <div
      style={{
        width: 200,
        flexShrink: 0,
        borderRight: `1px solid ${colors.border}`,
        backgroundColor: "#FCFBF9",
        display: "flex",
        flexDirection: "column",
        padding: "14px 10px",
        gap: 2,
        ...style,
      }}
    >
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            border: `1px solid ${colors.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: colors.mutedForeground,
          }}
        >
          <Search size={13} />
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            backgroundColor: colors.accent,
            color: colors.accentForeground,
            borderRadius: 8,
            fontFamily: fontFamilySans,
            fontWeight: 700,
            fontSize: 12,
          }}
        >
          <Plus size={13} /> Nuevo
        </div>
      </div>

      <div
        style={{
          fontFamily: fontFamilySans,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: colors.mutedForeground,
          padding: "4px 6px",
        }}
      >
        Proyectos
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 6px",
          borderRadius: 8,
          marginBottom: 8,
        }}
      >
        <Folder size={14} color={colors.primary} fill={colors.primaryLight} />
        <div
          style={{
            fontFamily: fontFamilySans,
            fontSize: 12.5,
            fontWeight: 600,
            color: colors.foreground,
            flex: 1,
          }}
        >
          Fitness
        </div>
        <ChevronRight size={12} color={colors.mutedForeground} />
      </div>

      {HISTORY.map((group) => (
        <React.Fragment key={group.group}>
          <div
            style={{
              fontFamily: fontFamilySans,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: colors.mutedForeground,
              padding: "6px 6px 2px",
            }}
          >
            {group.group}
          </div>
          {group.items.map((item, i) => {
            const isNew = active && group.group === "Hoy" && i === 0;
            return (
              <div
                key={item.title}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 6px",
                  borderRadius: 8,
                  backgroundColor: isNew ? "#EAF1FB" : "transparent",
                }}
              >
                <item.icon size={13} color={colors.mutedForeground} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: fontFamilySans,
                      fontSize: 12,
                      fontWeight: 500,
                      color: colors.foreground,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.title}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      fontFamily: fontFamilySans,
                      fontSize: 10.5,
                      color: colors.mutedForeground,
                    }}
                  >
                    {isNew && (
                      <span
                        style={{
                          backgroundColor: colors.textInfo,
                          color: "#fff",
                          borderRadius: 999,
                          padding: "1px 6px",
                          fontSize: 9,
                          fontWeight: 700,
                        }}
                      >
                        Nuevo
                      </span>
                    )}
                    {item.time}
                  </div>
                </div>
              </div>
            );
          })}
        </React.Fragment>
      ))}

      <div style={{ flex: 1 }} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 6px",
          borderTop: `1px solid ${colors.border}`,
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 999,
            backgroundColor: colors.foreground,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: fontFamilySans,
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          J
        </div>
        <div>
          <div
            style={{
              fontFamily: fontFamilySans,
              fontSize: 12,
              fontWeight: 600,
              color: colors.foreground,
            }}
          >
            Jaime
          </div>
          <div
            style={{
              fontFamily: fontFamilySans,
              fontSize: 10.5,
              color: colors.mutedForeground,
            }}
          >
            Plan Gratuito
          </div>
        </div>
      </div>
    </div>
  );
};
