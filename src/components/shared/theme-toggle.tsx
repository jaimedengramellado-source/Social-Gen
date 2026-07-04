"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const DARK: Record<string, string> = {
  "--color-background": "#0F0F13",
  "--color-foreground": "#F0EFE9",
  "--color-card": "#1A1A22",
  "--color-card-foreground": "#F0EFE9",
  "--color-popover": "#1A1A22",
  "--color-popover-foreground": "#F0EFE9",
  "--color-muted": "#1E1E28",
  "--color-muted-foreground": "#8A8A9A",
  "--color-border": "#2A2A38",
  "--color-input": "#2A2A38",
  "--color-secondary": "#1E1E28",
  "--color-secondary-foreground": "#F0EFE9",
  "--color-primary-light": "#43191F",
  "--color-accent": "#43191F",
  "--color-accent-foreground": "#D77582",
  "--cal-line-main": "rgba(255,255,255,0.07)",
  "--cal-line-dashed": "rgba(255,255,255,0.04)",
  "--cal-weekend-tint": "rgba(255,255,255,0.025)",
  "--destructive-muted": "rgba(220,38,38,0.15)",
  "--destructive-muted-border": "rgba(220,38,38,0.30)",
};

export function applyTheme(dark: boolean) {
  const root = document.documentElement;
  if (dark) {
    for (const [k, v] of Object.entries(DARK)) root.style.setProperty(k, v);
    root.classList.add("dark");
  } else {
    for (const k of Object.keys(DARK)) root.style.removeProperty(k);
    root.classList.remove("dark");
  }
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme") === "dark";
    setDark(saved);
    applyTheme(saved);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    applyTheme(next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className="p-2 rounded-full text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)] transition-colors"
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
