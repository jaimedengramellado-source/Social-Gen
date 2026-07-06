"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Sparkles, Library, Telescope, Settings, LogOut, Image as ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { CreditsDisplay } from "@/components/shared/credits-display";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Profile } from "@/types";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/crear", icon: Sparkles, label: "Crear" },
  { href: "/imagenes", icon: ImageIcon, label: "Imágenes" },
  { href: "/documentos", icon: Library, label: "Documentos" },
  { href: "/explorar", icon: Telescope, label: "Explorar" },
  { href: "/ajustes", icon: Settings, label: "Ajustes" },
];

export function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  const initials = profile.full_name
    ? profile.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : profile.email?.slice(0, 2).toUpperCase() || "SG";

  return (
    <aside className="hidden md:flex flex-col w-60 min-h-screen border-r border-[var(--color-border)] bg-white px-4 py-6 fixed left-0 top-0">
      {/* Logo */}
      <Link
        href="/dashboard"
        className="flex items-center gap-2 px-2 mb-8"
      >
        <span
          className="text-xl font-normal"
          style={{ fontFamily: "var(--font-instrument-serif)" }}
        >
          Social Flamingo
        </span>
      </Link>

      {/* Nav */}
      <nav className="flex-1 space-y-1">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                active
                  ? "bg-[var(--color-primary-light)] text-[var(--color-primary)]"
                  : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)]"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Credits */}
      <div className="mt-4 mb-4">
        <CreditsDisplay profile={profile} />
      </div>

      {/* User */}
      <div className="border-t border-[var(--color-border)] pt-4">
        <div className="flex items-center gap-3 mb-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile.avatar_url || ""} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile.full_name || "Usuario"}</p>
            <p className="text-xs text-[var(--color-muted-foreground)] truncate">{profile.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)] transition-all"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
