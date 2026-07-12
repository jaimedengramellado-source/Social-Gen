"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Sparkles, Library, Telescope,
  MoreHorizontal, X, Settings, BarChart2, CalendarDays, ListTodo, Image as ImageIcon, Video, LogOut, Send,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LogoutOverlay } from "./logout-overlay";

const primaryItems = [
  { href: "/dashboard",  icon: LayoutDashboard, label: "Inicio" },
  { href: "/crear",      icon: Sparkles,        label: "Crear" },
  { href: "/documentos", icon: Library,          label: "Docs" },
  { href: "/explorar",   icon: Telescope,        label: "Explorar" },
];

const moreItems = [
  { href: "/imagenes",     icon: ImageIcon,     label: "Imágenes" },
  { href: "/video",        icon: Video,         label: "Vídeo" },
  { href: "/publicar",     icon: Send,          label: "Publicar" },
  { href: "/estadisticas", icon: BarChart2,    label: "Estadísticas" },
  { href: "/calendario",   icon: CalendarDays,  label: "Calendario" },
  { href: "/todos",        icon: ListTodo,      label: "To Do" },
  { href: "/ajustes",      icon: Settings,      label: "Mi cuenta" },
];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  const moreActive = moreItems.some(item => isActive(item.href));

  async function handleLogout() {
    setOpen(false);
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    setTimeout(() => router.push("/"), 900);
  }

  return (
    <>
      <LogoutOverlay show={loggingOut} />
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        {/* "Más" drawer — slides up from above the nav bar */}
        <div
          className={`absolute bottom-full left-0 right-0 transition-all duration-200 ease-out ${
            open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
          }`}
        >
          <div className="mx-3 mb-2 bg-white rounded-2xl border border-[var(--color-border)] shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <span className="text-sm font-semibold">Menú</span>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1 p-2">
              {moreItems.map(({ href, icon: Icon, label }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                      active
                        ? "bg-[var(--color-primary-light)] text-[var(--color-primary)]"
                        : "text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
                    }`}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                    <span className="text-sm font-medium">{label}</span>
                  </Link>
                );
              })}
            </div>
            <div className="border-t border-[var(--color-border)] p-2">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] transition-colors"
              >
                <LogOut size={18} strokeWidth={1.8} />
                <span className="text-sm font-medium">Cerrar sesión</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="bg-white border-t border-[var(--color-border)]">
          <div className="flex items-center justify-around px-2 py-2">
            {primaryItems.map(({ href, icon: Icon, label }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
                    active
                      ? "text-[var(--color-primary)]"
                      : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{label}</span>
                </Link>
              );
            })}

            <button
              onClick={() => setOpen(prev => !prev)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
                moreActive || open
                  ? "text-[var(--color-primary)]"
                  : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
              }`}
            >
              <MoreHorizontal className="w-5 h-5" />
              <span className="text-xs font-medium">Más</span>
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
