"use client";

import { useRef, useState, useCallback } from "react";

export function useLasso(canvasRef: { current: HTMLCanvasElement | null }) {
  const [lassoActive, setLassoActive] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const isDrawing = useRef(false);
  const points = useRef<{ x: number; y: number }[]>([]);

  const getCoords = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height),
      };
    },
    [canvasRef],
  );

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [canvasRef]);

  const redrawPath = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const pts = points.current;
    if (pts.length < 2) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = "rgba(140,34,48,0.85)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(140,34,48,0.9)";
    ctx.fill();
  }, [canvasRef]);

  const fillSelection = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const pts = points.current;
    if (pts.length < 3) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fillStyle = "rgba(140,34,48,0.22)";
    ctx.fill();
    ctx.strokeStyle = "rgba(140,34,48,0.9)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [canvasRef]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!lassoActive) return;
      e.preventDefault();
      e.stopPropagation();
      const { x, y } = getCoords(e);
      points.current = [{ x, y }];
      isDrawing.current = true;
      setHasSelection(false);
      clearCanvas();
    },
    [lassoActive, getCoords, clearCanvas],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!lassoActive || !isDrawing.current) return;
      const { x, y } = getCoords(e);
      points.current.push({ x, y });
      redrawPath();
    },
    [lassoActive, getCoords, redrawPath],
  );

  const onMouseUp = useCallback(() => {
    if (!lassoActive || !isDrawing.current) return;
    isDrawing.current = false;
    if (points.current.length < 3) {
      clearCanvas();
      points.current = [];
      return;
    }
    setHasSelection(true);
    fillSelection();
  }, [lassoActive, clearCanvas, fillSelection]);

  const onMouseLeave = useCallback(() => {
    if (isDrawing.current) onMouseUp();
  }, [onMouseUp]);

  const clearLasso = useCallback(() => {
    clearCanvas();
    points.current = [];
    setHasSelection(false);
  }, [clearCanvas]);

  const getMask = useCallback((): string | null => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSelection || points.current.length < 3) return null;

    const mask = document.createElement("canvas");
    mask.width = canvas.width;
    mask.height = canvas.height;
    const ctx = mask.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, mask.width, mask.height);
    ctx.beginPath();
    const pts = points.current;
    ctx.moveTo(pts[0].x, pts[0].y);
    pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fillStyle = "white";
    ctx.fill();

    return mask.toDataURL("image/png").split(",")[1];
  }, [canvasRef, hasSelection]);

  return {
    lassoActive,
    setLassoActive,
    hasSelection,
    clearLasso,
    getMask,
    handlers: { onMouseDown, onMouseMove, onMouseUp, onMouseLeave },
  };
}
