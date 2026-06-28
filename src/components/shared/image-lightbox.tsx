"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { X, Download, PenLine, Eraser, Send, Loader2 } from "lucide-react";
import { useLasso } from "@/hooks/use-lasso";
import { downloadImageFromUrl } from "@/lib/utils";
import type { GeneratedImage } from "@/types";

interface LightboxImage {
  url: string;
  id: string;
  prompt?: string;
  aspectRatio?: string;
}

interface Props {
  image: LightboxImage;
  onClose: () => void;
  onUseAsBase?: () => void;
  onEditDone?: (newImage: GeneratedImage) => void;
}

export function ImageLightbox({ image, onClose, onUseAsBase, onEditDone }: Props) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const lastPinchDist = useRef<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lasso = useLasso(canvasRef);

  const [editPrompt, setEditPrompt] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Sync canvas size with container
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const sync = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };
    sync();

    const ro = new ResizeObserver(sync);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // ESC to close + lock body scroll
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const doZoom = useCallback((factor: number, originX: number, originY: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mouseX = originX - rect.left - rect.width / 2;
    const mouseY = originY - rect.top - rect.height / 2;

    setScale((prev) => {
      const next = Math.max(1, Math.min(6, prev * factor));
      if (next === 1) {
        setTranslate({ x: 0, y: 0 });
        return 1;
      }
      setTranslate((t) => {
        const maxTx = (next - 1) * rect.width / 2;
        const maxTy = (next - 1) * rect.height / 2;
        const rawTx = mouseX + (t.x - mouseX) * (next / prev);
        const rawTy = mouseY + (t.y - mouseY) * (next / prev);
        return {
          x: Math.max(-maxTx, Math.min(maxTx, rawTx)),
          y: Math.max(-maxTy, Math.min(maxTy, rawTy)),
        };
      });
      return next;
    });
  }, []);

  // Wheel zoom (passive: false to prevent page scroll)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      doZoom(e.deltaY < 0 ? 1.15 : 0.87, e.clientX, e.clientY);
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [doZoom]);

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (lasso.lassoActive) return;
    if (scale > 1) {
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, tx: translate.x, ty: translate.y };
      e.preventDefault();
    }
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (lasso.lassoActive || !isDragging) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const maxTx = (scale - 1) * rect.width / 2;
    const maxTy = (scale - 1) * rect.height / 2;
    setTranslate({
      x: Math.max(-maxTx, Math.min(maxTx, dragStart.current.tx + (e.clientX - dragStart.current.x))),
      y: Math.max(-maxTy, Math.min(maxTy, dragStart.current.ty + (e.clientY - dragStart.current.y))),
    });
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist.current = Math.sqrt(dx * dx + dy * dy);
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (e.touches.length !== 2 || lastPinchDist.current === null) return;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    doZoom(dist / lastPinchDist.current, midX, midY);
    lastPinchDist.current = dist;
  }

  function handleTouchEnd() {
    lastPinchDist.current = null;
  }

  async function handleZoneEdit() {
    if (!editPrompt.trim() || !lasso.hasSelection) return;
    const maskBase64 = lasso.getMask();
    if (!maskBase64) return;

    setEditLoading(true);
    setEditError(null);

    try {
      const res = await fetch("/api/ai/edit-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editPrompt,
          sourceImageId: image.id,
          maskBase64,
          aspectRatio: image.aspectRatio ?? "1:1",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(
          data.error === "NO_CREDITS"
            ? "Sin créditos. Consigue más en Ajustes."
            : "Error al editar. Inténtalo de nuevo.",
        );
        return;
      }
      onEditDone?.(data.image);
      onClose();
    } catch {
      setEditError("Error inesperado. Inténtalo de nuevo.");
    } finally {
      setEditLoading(false);
    }
  }

  const cursor = lasso.lassoActive
    ? "crosshair"
    : isDragging
    ? "grabbing"
    : scale > 1
    ? "grab"
    : "zoom-in";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: "rgba(0,0,0,0.93)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onClose}
            className="flex-shrink-0 p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
          {image.prompt && (
            <p className="text-white/45 text-sm truncate">{image.prompt}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {onUseAsBase && (
            <button
              onClick={() => { onUseAsBase(); onClose(); }}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-white/20 text-white/80 hover:text-white hover:border-white/40 transition-colors"
            >
              Usar como base
            </button>
          )}
          <button
            onClick={() => downloadImageFromUrl(image.url)}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="Descargar"
          >
            <Download size={18} />
          </button>
        </div>
      </div>

      {/* Image + canvas */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden select-none min-h-0"
        style={{ cursor }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: "center center",
            willChange: "transform",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.url}
            alt={image.prompt ?? "imagen"}
            className="w-full h-full object-contain"
            draggable={false}
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ pointerEvents: lasso.lassoActive ? "auto" : "none" }}
            {...lasso.handlers}
          />
        </div>
      </div>

      {/* Bottom controls */}
      <div
        className="flex-shrink-0 space-y-2.5 px-4 py-3 border-t"
        style={{
          borderColor: "rgba(255,255,255,0.08)",
          backgroundColor: "rgba(8,8,8,0.85)",
        }}
      >
        {/* Toolbar */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (lasso.lassoActive) lasso.clearLasso();
              lasso.setLassoActive((v) => !v);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: lasso.lassoActive
                ? "var(--color-primary)"
                : "rgba(255,255,255,0.1)",
              color: "white",
            }}
          >
            <PenLine size={14} />
            {lasso.lassoActive ? "Dibujando..." : "Seleccionar zona"}
          </button>

          {lasso.hasSelection && (
            <button
              onClick={lasso.clearLasso}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Eraser size={14} />
              Limpiar
            </button>
          )}

          <span className="ml-auto text-xs text-white/25">
            {scale > 1 ? `${Math.round(scale * 100)}%` : "Scroll para zoom"}
          </span>
        </div>

        {/* Zone edit input */}
        {lasso.hasSelection && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <div
                className="flex-1 rounded-lg border transition-colors focus-within:border-purple-500"
                style={{
                  borderColor: "rgba(255,255,255,0.15)",
                  backgroundColor: "rgba(255,255,255,0.06)",
                }}
              >
                <input
                  type="text"
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleZoneEdit(); }}
                  placeholder="Describe qué cambiar en la zona seleccionada..."
                  className="w-full px-3 py-2 text-sm bg-transparent outline-none text-white placeholder:text-white/30"
                  autoFocus
                />
              </div>
              <button
                onClick={handleZoneEdit}
                disabled={!editPrompt.trim() || editLoading}
                className="px-3 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-1.5 transition-colors disabled:opacity-50 flex-shrink-0"
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                {editLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                Editar zona
              </button>
            </div>
            {editError && (
              <p className="text-xs" style={{ color: "#f87171" }}>
                {editError}
              </p>
            )}
          </div>
        )}

        {lasso.lassoActive && !lasso.hasSelection && (
          <p className="text-xs text-white/30">
            Haz clic y arrastra para rodear la zona que quieres editar
          </p>
        )}
      </div>
    </div>
  );
}
