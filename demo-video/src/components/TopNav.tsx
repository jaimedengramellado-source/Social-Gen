import React from "react";
import {
  Sparkles,
  LayoutGrid,
  Compass,
  Send,
  BarChart3,
  CalendarDays,
  Moon,
} from "lucide-react";
import { Logo } from "./Logo";
import { colors } from "../theme";
import { fontFamilySans } from "../fonts";

const NAV_ITEMS = [
  { key: "crear", label: "Crear", icon: Sparkles },
  { key: "inicio", label: "Inicio", icon: LayoutGrid },
  { key: "explorar", label: "Explorar", icon: Compass },
  { key: "publicar", label: "Publicar", icon: Send },
  { key: "estadisticas", label: "Estadísticas", icon: BarChart3 },
  { key: "calendario", label: "Calendario", icon: CalendarDays },
];

export const TopNav: React.FC<{ active: string }> = ({ active }) => {
  return (
    <div
      style={{
        height: 54,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        gap: 22,
        borderBottom: `1px solid ${colors.border}`,
        backgroundColor: colors.card,
      }}
    >
      <div style={{ transform: "scale(0.72)", transformOrigin: "left center" }}>
        <Logo size={26} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.key === active;
          return (
            <div
              key={item.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 999,
                fontFamily: fontFamilySans,
                fontSize: 12.5,
                fontWeight: 600,
                color: isActive ? "#fff" : colors.navForeground,
                backgroundColor: isActive ? colors.primary : "transparent",
              }}
            >
              <item.icon size={13} />
              {item.label}
            </div>
          );
        })}
      </div>
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: colors.navForeground,
        }}
      >
        <Moon size={14} />
      </div>
    </div>
  );
};
