"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const SHOW_DELAY_MS = 150; // evita el flash en navegaciones rápidas
const TRICKLE_MS = 200;
const MAX_DURATION_MS = 8000; // red de seguridad si algo no dispara "finish"
const HIDE_DELAY_MS = 200;

export function RouteProgress() {
  const pathname = usePathname();
  const prevPathname = useRef(pathname);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  const showTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const trickleTimer = useRef<ReturnType<typeof setInterval>>(undefined);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const maxTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const clearAll = () => {
    clearTimeout(showTimer.current);
    clearInterval(trickleTimer.current);
    clearTimeout(hideTimer.current);
    clearTimeout(maxTimer.current);
  };

  const finish = useCallback(() => {
    clearAll();
    setProgress(1);
    hideTimer.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, HIDE_DELAY_MS);
  }, []);

  const start = useCallback(() => {
    clearAll();
    setProgress(0);
    showTimer.current = setTimeout(() => {
      setVisible(true);
      setProgress(0.08);
      trickleTimer.current = setInterval(() => {
        setProgress((p) => (p < 0.9 ? p + (0.9 - p) * 0.15 : p));
      }, TRICKLE_MS);
    }, SHOW_DELAY_MS);
    maxTimer.current = setTimeout(finish, MAX_DURATION_MS);
  }, [finish]);

  // La navegación terminó en cuanto cambia el pathname
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      finish();
    }
  }, [pathname, finish]);

  // Detecta el click en un <a> interno para arrancar la animación al instante
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement)?.closest?.("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || anchor.hasAttribute("download") || anchor.target === "_blank") return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === pathname && url.search === window.location.search) return;

      start();
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [pathname, start]);

  useEffect(() => clearAll, []);

  if (!visible) return null;

  return (
    <div
      data-testid="route-progress"
      className="fixed top-0 left-0 right-0 z-[200] h-[3px] pointer-events-none overflow-hidden"
    >
      <div
        className="h-full transition-[width] duration-300 ease-out"
        style={{
          width: `${progress * 100}%`,
          backgroundColor: "var(--color-primary)",
          boxShadow: "0 0 8px var(--color-primary), 0 0 4px var(--color-primary)",
        }}
      />
    </div>
  );
}
