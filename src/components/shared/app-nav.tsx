"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderOpen, Search, BarChart2, UserCircle2, CalendarDays, ListTodo } from "lucide-react";

const ITEMS = [
  { href: "/dashboard",    label: "Inicio",       Icon: LayoutDashboard },
  { href: "/biblioteca",   label: "Biblioteca",   Icon: FolderOpen },
  { href: "/explorar",     label: "Explorar",     Icon: Search },
  { href: "/estadisticas", label: "Estadísticas", Icon: BarChart2 },
  { href: "/calendario",   label: "Calendario",   Icon: CalendarDays },
  { href: "/todos",        label: "To Do",        Icon: ListTodo },
  { href: "/ajustes",      label: "Mi cuenta",    Icon: UserCircle2 },
];

export function AppNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));

  return (
    <nav className="flex items-center gap-1">
      <Link
        href="/crear"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 hover:scale-105"
        style={{
          backgroundColor: "var(--color-primary)",
          color: "white",
          boxShadow: pathname.startsWith("/crear") ? "0 2px 10px rgba(124,58,237,0.4)" : undefined,
        }}
      >
        <span style={{ fontSize: 11, letterSpacing: "-0.02em" }}>IA</span>
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
