"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Minus, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PublishPlatform } from "@/types";
import { PLATFORM_LABELS } from "./shared";
import { ASPECT_RATIOS, cropViewRect, renderCroppedImage } from "./image-utils";
import type { CropRect, CropState } from "./image-utils";

// Presets de aspecto por red, del más habitual al menos. Instagram limita el
// feed a 4:5–1.91:1; "Original" se ofrece igualmente porque es lo que se
// publica hoy sin recorte, y "Libre" permite dibujar el marco a mano.
const PLATFORM_ASPECTS: Record<string, string[]> = {
  instagram: ["1:1", "4:5", "1.91:1", "original", "libre"],
  facebook: ["1:1", "4:5", "16:9", "original", "libre"],
  tiktok: ["9:16", "3:4", "1:1", "original", "libre"],
  x: ["16:9", "1:1", "4:5", "original", "libre"],
  linkedin: ["1.91:1", "1:1", "4:5", "original", "libre"],
  threads: ["1:1", "4:5", "16:9", "original", "libre"],
};

const ASPECT_LABELS: Record<string, string> = {
  original: "Original",
  libre: "Libre",
  "1:1": "1:1",
  "4:5": "4:5",
  "3:4": "3:4",
  "9:16": "9:16",
  "16:9": "16:9",
  "1.91:1": "1.91:1",
};

const MAX_FRAME_HEIGHT = 300;
const MIN_RECT = 0.05;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

const HANDLES: Array<{ id: string; x: number; y: number; cursor: string }> = [
  { id: "nw", x: 0, y: 0, cursor: "nwse-resize" },
  { id: "n", x: 0.5, y: 0, cursor: "ns-resize" },
  { id: "ne", x: 1, y: 0, cursor: "nesw-resize" },
  { id: "e", x: 1, y: 0.5, cursor: "ew-resize" },
  { id: "se", x: 1, y: 1, cursor: "nwse-resize" },
  { id: "s", x: 0.5, y: 1, cursor: "ns-resize" },
  { id: "sw", x: 0, y: 1, cursor: "nesw-resize" },
  { id: "w", x: 0, y: 0.5, cursor: "ew-resize" },
];

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function resizeRect(r0: CropRect, handle: string, dnx: number, dny: number): CropRect {
  let { x, y, w, h } = r0;
  if (handle.includes("e")) w = clamp(r0.w + dnx, MIN_RECT, 1 - r0.x);
  if (handle.includes("s")) h = clamp(r0.h + dny, MIN_RECT, 1 - r0.y);
  if (handle.includes("w")) {
    const nx = clamp(r0.x + dnx, 0, r0.x + r0.w - MIN_RECT);
    w = r0.w - (nx - r0.x);
    x = nx;
  }
  if (handle.includes("n")) {
    const ny = clamp(r0.y + dny, 0, r0.y + r0.h - MIN_RECT);
    h = r0.h - (ny - r0.y);
    y = ny;
  }
  return { x, y, w, h };
}

type DragState =
  | { kind: "pan"; x: number; y: number; ox: number; oy: number }
  | { kind: "move"; x: number; y: number; rect0: CropRect }
  | { kind: "resize"; handle: string; x: number; y: number; rect0: CropRect };

interface Props {
  platform: PublishPlatform;
  imageUrl: string;
  fileName: string;
  initial: CropState | null;
  onApply: (file: File, crop: CropState) => void;
  onClose: () => void;
}

export function PhotoCrop({ platform, imageUrl, fileName, initial, onApply, onClose }: Props) {
  const aspects = PLATFORM_ASPECTS[platform] ?? ["1:1", "4:5", "16:9", "original", "libre"];
  const [aspect, setAspect] = useState(initial?.aspect ?? aspects[0]);
  const [zoom, setZoom] = useState(initial?.zoom ?? 1);
  const [offsetX, setOffsetX] = useState(initial?.offsetX ?? 0);
  const [offsetY, setOffsetY] = useState(initial?.offsetY ?? 0);
  const [freeRect, setFreeRect] = useState<CropRect | null>(initial?.rect ?? null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  // Callback ref + estado: el div vive dentro del portal de Radix, que monta
  // después del primer commit — un useRef con efecto [] lo vería null siempre
  const [boxEl, setBoxEl] = useState<HTMLDivElement | null>(null);
  const [boxW, setBoxW] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    if (!boxEl) return;
    const measure = () => setBoxW(boxEl.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(boxEl);
    return () => ro.disconnect();
  }, [boxEl]);

  // Modo libre sin marco aún (estado guardado incompleto): marco a toda la imagen
  useEffect(() => {
    if (aspect === "libre" && nat && !freeRect) setFreeRect({ x: 0, y: 0, w: 1, h: 1 });
  }, [aspect, nat, freeRect]);

  const isFree = aspect === "libre";

  // ── Geometría del modo preset (encuadre cover + zoom + paneo) ──
  const frameAspect = nat ? ASPECT_RATIOS[aspect] ?? nat.w / nat.h : 1;
  let frameW = boxW;
  let frameH = frameW / frameAspect;
  if (frameH > MAX_FRAME_HEIGHT) {
    frameH = MAX_FRAME_HEIGHT;
    frameW = frameH * frameAspect;
  }

  let imgStyle: React.CSSProperties = { display: "none" };
  let maxPanXpx = 0;
  let maxPanYpx = 0;
  if (nat && frameW > 0) {
    const scale = Math.max(frameW / nat.w, frameH / nat.h) * zoom;
    const dispW = nat.w * scale;
    const dispH = nat.h * scale;
    maxPanXpx = Math.max(0, (dispW - frameW) / 2);
    maxPanYpx = Math.max(0, (dispH - frameH) / 2);
    imgStyle = {
      position: "absolute",
      left: (frameW - dispW) / 2 - offsetX * maxPanXpx,
      top: (frameH - dispH) / 2 - offsetY * maxPanYpx,
      width: dispW,
      height: dispH,
      maxWidth: "none",
    };
  }

  // ── Geometría del modo libre (imagen entera encajada + marco manual) ──
  let fitW = 0;
  let fitH = 0;
  if (nat && boxW > 0) {
    const fitScale = Math.min(boxW / nat.w, MAX_FRAME_HEIGHT / nat.h);
    fitW = nat.w * fitScale;
    fitH = nat.h * fitScale;
  }

  function selectAspect(a: string) {
    // Al pasar a libre, el marco arranca en el encuadre que se estaba viendo
    if (a === "libre" && !freeRect && nat) {
      const { sx, sy, viewW, viewH } = cropViewRect(nat.w, nat.h, { aspect, zoom, offsetX, offsetY });
      setFreeRect({ x: sx / nat.w, y: sy / nat.h, w: viewW / nat.w, h: viewH / nat.h });
    }
    setAspect(a);
  }

  function changeZoom(delta: number) {
    setZoom((z) => clamp(z + delta, MIN_ZOOM, MAX_ZOOM));
  }

  function onPanDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { kind: "pan", x: e.clientX, y: e.clientY, ox: offsetX, oy: offsetY };
  }

  function onPanMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (d?.kind !== "pan") return;
    if (maxPanXpx > 0) setOffsetX(clamp(d.ox - (e.clientX - d.x) / maxPanXpx, -1, 1));
    if (maxPanYpx > 0) setOffsetY(clamp(d.oy - (e.clientY - d.y) / maxPanYpx, -1, 1));
  }

  function onRectDown(e: React.PointerEvent<HTMLElement>, handle?: string) {
    if (!freeRect) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = handle
      ? { kind: "resize", handle, x: e.clientX, y: e.clientY, rect0: freeRect }
      : { kind: "move", x: e.clientX, y: e.clientY, rect0: freeRect };
  }

  function onRectMove(e: React.PointerEvent<HTMLElement>) {
    const d = dragRef.current;
    if (!d || d.kind === "pan" || fitW === 0) return;
    const dnx = (e.clientX - d.x) / fitW;
    const dny = (e.clientY - d.y) / fitH;
    if (d.kind === "move") {
      setFreeRect({
        x: clamp(d.rect0.x + dnx, 0, 1 - d.rect0.w),
        y: clamp(d.rect0.y + dny, 0, 1 - d.rect0.h),
        w: d.rect0.w,
        h: d.rect0.h,
      });
    } else {
      setFreeRect(resizeRect(d.rect0, d.handle, dnx, dny));
    }
  }

  function endDrag() {
    dragRef.current = null;
  }

  async function apply() {
    setBusy(true);
    setError(null);
    const crop: CropState = {
      aspect, zoom, offsetX, offsetY,
      ...(isFree && freeRect ? { rect: freeRect } : {}),
    };
    try {
      const file = await renderCroppedImage(
        imageUrl,
        `${fileName.replace(/\.[^.]+$/, "")}-${platform}`,
        crop
      );
      onApply(file, crop);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo recortar la foto.");
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Ajustar foto para {PLATFORM_LABELS[platform]}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-1.5 flex-wrap">
          {aspects.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => selectAspect(a)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{
                backgroundColor: aspect === a ? "var(--color-primary)" : "var(--color-muted)",
                color: aspect === a ? "white" : "var(--color-muted-foreground)",
              }}
            >
              {ASPECT_LABELS[a] ?? a}
            </button>
          ))}
        </div>

        <div ref={setBoxEl} className="w-full flex justify-center">
          {isFree && nat && fitW > 0 ? (
            <div
              className="relative overflow-hidden rounded-xl select-none"
              style={{ width: fitW, height: fitH, backgroundColor: "#0D0D0D", touchAction: "none" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt=""
                draggable={false}
                style={{ position: "absolute", left: 0, top: 0, width: fitW, height: fitH, maxWidth: "none" }}
              />
              {freeRect && (
                <div
                  className="absolute border border-dashed border-white/90 cursor-move"
                  style={{
                    left: freeRect.x * fitW,
                    top: freeRect.y * fitH,
                    width: freeRect.w * fitW,
                    height: freeRect.h * fitH,
                    boxShadow: "0 0 0 999px rgba(0,0,0,0.55)",
                    touchAction: "none",
                  }}
                  onPointerDown={(e) => onRectDown(e)}
                  onPointerMove={onRectMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                >
                  {HANDLES.map((h) => (
                    <div
                      key={h.id}
                      className="absolute w-3 h-3 rounded-[3px] bg-white border"
                      style={{
                        left: `${h.x * 100}%`,
                        top: `${h.y * 100}%`,
                        transform: "translate(-50%, -50%)",
                        cursor: h.cursor,
                        borderColor: "var(--color-primary)",
                        touchAction: "none",
                      }}
                      onPointerDown={(e) => onRectDown(e, h.id)}
                      onPointerMove={onRectMove}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            frameW > 0 && (
              <div
                className="relative overflow-hidden rounded-xl cursor-grab active:cursor-grabbing select-none"
                style={{ width: frameW, height: frameH, backgroundColor: "#0D0D0D", touchAction: "none" }}
                onPointerDown={onPanDown}
                onPointerMove={onPanMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onWheel={(e) => changeZoom(-e.deltaY * 0.0015)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt=""
                  draggable={false}
                  style={imgStyle}
                  onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                />
                {/* Regla de los tercios */}
                <div className="absolute inset-0 pointer-events-none">
                  {[1, 2].map((i) => (
                    <div key={`v${i}`} className="absolute top-0 bottom-0 w-px bg-white/25" style={{ left: `${(i * 100) / 3}%` }} />
                  ))}
                  {[1, 2].map((i) => (
                    <div key={`h${i}`} className="absolute left-0 right-0 h-px bg-white/25" style={{ top: `${(i * 100) / 3}%` }} />
                  ))}
                </div>
              </div>
            )
          )}
        </div>

        {isFree ? (
          <div className="flex items-center gap-3">
            <p className="text-[11px] flex-1" style={{ color: "var(--color-muted-foreground)" }}>
              Arrastra el marco para moverlo, o sus esquinas y bordes para cambiar el recorte.
            </p>
            <button
              type="button"
              onClick={() => setFreeRect({ x: 0, y: 0, w: 1, h: 1 })}
              className="text-[11px] font-medium hover:underline flex-shrink-0"
              style={{ color: "var(--color-muted-foreground)" }}
            >
              Restablecer
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium flex-shrink-0" style={{ color: "var(--color-muted-foreground)" }}>
                Zoom
              </label>
              <button
                type="button"
                onClick={() => changeZoom(-0.25)}
                disabled={zoom <= MIN_ZOOM}
                aria-label="Reducir zoom"
                className="p-1 rounded-md border transition-colors hover:bg-[var(--color-muted)] disabled:opacity-40 flex-shrink-0"
                style={{ borderColor: "var(--color-border)" }}
              >
                <Minus size={11} />
              </button>
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1"
                style={{ accentColor: "var(--color-primary)" }}
              />
              <button
                type="button"
                onClick={() => changeZoom(0.25)}
                disabled={zoom >= MAX_ZOOM}
                aria-label="Aumentar zoom"
                className="p-1 rounded-md border transition-colors hover:bg-[var(--color-muted)] disabled:opacity-40 flex-shrink-0"
                style={{ borderColor: "var(--color-border)" }}
              >
                <Plus size={11} />
              </button>
              <button
                type="button"
                onClick={() => { setZoom(1); setOffsetX(0); setOffsetY(0); }}
                className="text-[11px] font-medium hover:underline flex-shrink-0"
                style={{ color: "var(--color-muted-foreground)" }}
              >
                Centrar
              </button>
            </div>
            <p className="text-[11px] -mt-2" style={{ color: "var(--color-muted-foreground)" }}>
              Arrastra la foto para encuadrarla y usa la rueda o los botones para el zoom.
              El recorte solo se aplica en {PLATFORM_LABELS[platform]}.
            </p>
          </>
        )}

        {error && (
          <p className="text-xs" style={{ color: "var(--color-destructive)" }}>{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 rounded-xl border text-sm font-medium transition-colors hover:bg-[var(--color-muted)] disabled:opacity-50"
            style={{ borderColor: "var(--color-border)" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={busy || !nat || (isFree && !freeRect)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-85 disabled:opacity-50"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Aplicar recorte
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
