"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { X, Pencil, Trash2, Clock, AlignLeft } from "lucide-react";
import { formatTime, getEventTag } from "./types";
import { useCalSettings } from "./CalendarContext";
import type { CalendarEvent } from "./types";

const POPOVER_W = 288;

interface Props {
  event: CalendarEvent;
  anchorRect: DOMRect;
  onClose: () => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
}

export function EventPopover({ event, anchorRect, onClose, onEdit, onDelete }: Props) {
  const { settings } = useCalSettings();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  let left = anchorRect.right + 10;
  let top = anchorRect.top;

  if (typeof window !== "undefined") {
    if (left + POPOVER_W > window.innerWidth - 8) {
      left = anchorRect.left - POPOVER_W - 10;
    }
    if (left < 8) left = 8;
    const maxTop = window.innerHeight - 220;
    if (top > maxTop) top = maxTop;
    if (top < 8) top = 8;
  }

  const color = event.color ?? "#1a73e8";
  const endIso =
    event.end_time ??
    new Date(new Date(event.start_time).getTime() + 3_600_000).toISOString();

  if (!mounted) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[50]" onClick={onClose} />
      <div
        className="fixed z-[51] bg-white rounded-2xl overflow-hidden"
        style={{
          left,
          top,
          width: POPOVER_W,
          boxShadow: "0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)",
          border: "1px solid var(--color-border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-2" style={{ backgroundColor: color }} />

        <div className="px-4 py-3">
          <div className="flex items-start justify-between gap-2 mb-3">
            <h3 className="font-bold text-sm leading-snug flex-1">{event.title}</h3>
            <div className="flex items-center gap-0.5 flex-shrink-0 -mr-1">
              <button
                onClick={onEdit}
                className="p-1.5 rounded-lg hover:bg-[var(--color-muted)] transition-colors"
                title="Editar"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => onDelete(event.id)}
                className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                title="Eliminar"
              >
                <Trash2 size={13} />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-[var(--color-muted)] transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-[var(--color-muted-foreground)] mb-2">
            <Clock size={12} className="flex-shrink-0" />
            <span>
              {formatTime(event.start_time, settings.timeFormat)} – {formatTime(endIso, settings.timeFormat)}
            </span>
            {getEventTag(event.tag) && (
              <span
                className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{ backgroundColor: "var(--color-primary-light)", color: "var(--color-primary)" }}
              >
                <span aria-hidden>{getEventTag(event.tag)!.emoji}</span> {getEventTag(event.tag)!.label}
              </span>
            )}
          </div>

          {event.description && (
            <div className="flex items-start gap-2 text-xs text-[var(--color-muted-foreground)]">
              <AlignLeft size={12} className="mt-0.5 flex-shrink-0" />
              <p className="line-clamp-4 leading-relaxed">{event.description}</p>
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
