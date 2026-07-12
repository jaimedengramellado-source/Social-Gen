"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderOpen, Search, BarChart2, UserCircle2, CalendarDays, ListTodo, Image as ImageIcon, Send } from "lucide-react";
import type { Profile } from "@/types";

const BASE = 32;
const MAX = 64;
const SPREAD = 120;

interface DockItem {
  href: string;
  label: string;
  type: "icon" | "ia" | "avatar";
  Icon?: React.ElementType;
}

const ITEMS: DockItem[] = [
  { href: "/dashboard",  label: "Inicio",      type: "icon", Icon: LayoutDashboard },
  { href: "/crear",      label: "Crear",        type: "ia" },
  { href: "/imagenes",   label: "Imágenes",    type: "icon", Icon: ImageIcon },
  { href: "/documentos", label: "Documentos",   type: "icon", Icon: FolderOpen },
  { href: "/explorar",      label: "Explorar",       type: "icon", Icon: Search },
  { href: "/publicar",      label: "Publicar",       type: "icon", Icon: Send },
  { href: "/estadisticas",  label: "Estadísticas",   type: "icon", Icon: BarChart2 },
  { href: "/calendario",   label: "Calendario",     type: "icon", Icon: CalendarDays },
  { href: "/todos",        label: "To Do",          type: "icon", Icon: ListTodo },
  { href: "/ajustes",      label: "Mi cuenta",      type: "icon", Icon: UserCircle2 },
];

export function Dock({ profile }: { profile?: Profile | null }) {
  const [mouseX, setMouseX] = useState<number | null>(null);
  const [hovered, setHovered] = useState(false);
  const dockRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const pathname = usePathname();

  const getScale = (index: number): number => {
    if (mouseX === null) return 1;
    const el = itemRefs.current[index];
    if (!el) return 1;
    const rect = el.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    const dist = Math.abs(mouseX - center);
    const t = Math.max(0, 1 - dist / SPREAD);
    return 1 + (MAX / BASE - 1) * Math.pow(t, 1.8);
  };

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : profile?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="fixed bottom-5 left-0 right-0 flex justify-center z-50 pointer-events-none">
      <div
        ref={dockRef}
        onMouseMove={(e) => { setMouseX(e.clientX); }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setMouseX(null); setHovered(false); }}
        className="flex items-end gap-4 px-4 py-2.5 rounded-2xl pointer-events-auto"
        style={{
          background: hovered ? "rgba(13,13,13,0.88)" : "rgba(13,13,13,0.28)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: hovered ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0.04)",
          boxShadow: hovered
            ? "0 8px 40px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.18)"
            : "0 4px 16px rgba(0,0,0,0.10)",
          transition: "background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease",
        }}
      >
        {ITEMS.map((item, i) => {
          const scale = getScale(i);
          const active = isActive(item.href);
          const size = BASE;

          return (
            <div key={item.href} className="relative flex flex-col items-center group">
              {/* Tooltip */}
              <div
                className="absolute pointer-events-none"
                style={{ bottom: size * scale + 10, left: "50%", transform: "translateX(-50%)" }}
              >
                <span
                  className="whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity duration-100"
                  style={{
                    background: "rgba(13,13,13,0.85)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  {item.label}
                </span>
              </div>

              {/* Icon */}
              <Link
                href={item.href}
                ref={(el) => { itemRefs.current[i] = el; }}
                style={{
                  width: size,
                  height: size,
                  transform: `scale(${scale})`,
                  transformOrigin: "bottom center",
                  transition: mouseX === null
                    ? "transform 300ms cubic-bezier(0.34,1.56,0.64,1)"
                    : "transform 80ms ease-out",
                }}
                className="flex items-center justify-center rounded-xl relative text-white"
                aria-label={item.label}
              >
                {/* Background */}
                <span
                  className="absolute inset-0 rounded-xl"
                  style={{
                    background: active
                      ? item.type === "ia"
                        ? "var(--color-primary)"
                        : "rgba(255,255,255,0.18)"
                      : "rgba(255,255,255,0.07)",
                    boxShadow: active
                      ? item.type === "ia"
                        ? "0 2px 12px rgba(140,34,48,0.45)"
                        : "inset 0 1px 0 rgba(255,255,255,0.15)"
                      : undefined,
                  }}
                />

                {/* Content */}
                <span className="relative z-10 flex items-center justify-center">
                  {item.type === "ia" && (
                    <span
                      className="font-bold tracking-tight text-white select-none"
                      style={{ fontSize: 12, letterSpacing: "-0.02em" }}
                    >
                      IA
                    </span>
                  )}
                  {item.type === "icon" && item.Icon && (
                    <item.Icon size={16} strokeWidth={1.8} />
                  )}
                  {item.type === "avatar" && (
                    profile?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profile.avatar_url}
                        alt={profile.full_name ?? "avatar"}
                        className="w-full h-full object-cover rounded-xl"
                      />
                    ) : (
                      <span className="font-semibold text-sm select-none text-white">
                        {initials}
                      </span>
                    )
                  )}
                </span>
              </Link>

              {/* Active dot */}
              <span
                className="mt-1.5 h-1 rounded-full transition-all duration-200"
                style={{
                  width: active ? 16 : 4,
                  backgroundColor: active ? "rgba(255,255,255,0.6)" : "transparent",
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
