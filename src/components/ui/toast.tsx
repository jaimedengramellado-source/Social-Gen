"use client";

import { createContext, useContext, useState, useCallback } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

type ToastAction = { label: string; href?: string; onClick?: () => void; primary?: boolean };

type ToastItem = {
  id: string;
  title: string;
  description?: string;
  actions?: ToastAction[];
  duration?: number;
};

type ToastContextType = {
  toast: (opts: Omit<ToastItem, "id">) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((opts: Omit<ToastItem, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, ...opts }]);
    setTimeout(() => dismiss(id), opts.duration ?? 8000);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none" aria-live="polite">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 48, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 48, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="pointer-events-auto rounded-2xl px-4 py-3.5 shadow-xl min-w-[300px] max-w-sm"
              style={{ backgroundColor: "var(--color-foreground)", color: "white" }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-snug">{t.title}</p>
                  {t.description && (
                    <p className="text-xs mt-0.5 leading-snug" style={{ color: "rgba(255,255,255,0.65)" }}>
                      {t.description}
                    </p>
                  )}
                  {t.actions && t.actions.length > 0 && (
                    <div className="flex items-center gap-2 mt-3">
                      {t.actions.map((action, i) =>
                        action.href ? (
                          <Link
                            key={i}
                            href={action.href}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                            style={{
                              backgroundColor: action.primary !== false && i === 0
                                ? "var(--color-primary)"
                                : "rgba(255,255,255,0.15)",
                            }}
                            onClick={() => dismiss(t.id)}
                          >
                            {action.label}
                          </Link>
                        ) : (
                          <button
                            key={i}
                            onClick={() => { action.onClick?.(); dismiss(t.id); }}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                            style={{
                              backgroundColor: action.primary !== false && i === 0
                                ? "var(--color-primary)"
                                : "rgba(255,255,255,0.15)",
                            }}
                          >
                            {action.label}
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => dismiss(t.id)}
                  className="flex-shrink-0 mt-0.5 transition-opacity hover:opacity-60"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                  aria-label="Cerrar"
                >
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
