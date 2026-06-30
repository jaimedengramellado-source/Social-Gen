"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderOpen, Search, BarChart2, UserCircle2, CalendarDays, ListTodo, Image as ImageIcon, Sparkles } from "lucide-react";

const ITEMS = [
  { href: "/dashboard",    label: "Inicio",       Icon: LayoutDashboard },
  { href: "/imagenes",     label: "Imágenes",     Icon: ImageIcon },
  { href: "/documentos",   label: "Documentos",   Icon: FolderOpen },
  { href: "/explorar",     label: "Explorar",     Icon: Search },
  { href: "/estadisticas", label: "Estadísticas", Icon: BarChart2 },
  { href: "/calendario",   label: "Calendario",   Icon: CalendarDays },
  { href: "/todos",        label: "Tareas",       Icon: ListTodo },
  { href: "/ajustes",      label: "Mi cuenta",    Icon: UserCircle2 },
];

export function AppNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));

  const crearActive = pathname.startsWith("/crear");

  return (
    <nav className="flex items-center gap-1">
      <Link
        href="/crear"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 hover:scale-105"
        style={{
          backgroundColor: crearActive ? "var(--color-primary)" : "transparent",
          color: crearActive ? "white" : "var(--color-primary)",
          boxShadow: crearActive ? "0 2px 10px rgba(124,58,237,0.4)" : undefined,
        }}
      >
        <Sparkles size={14} strokeWidth={1.8} />
        Crear
      </Link>

      {ITEMS.map(({ href, label, Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 hover:scale-105"
            style={{
              backgroundColor: active ? "var(--color-muted)" : "transparent",
              color: active ? "var(--color-foreground)" : "var(--color-muted-foreground)",
            }}
          >
            <Icon size={14} strokeWidth={1.8} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
