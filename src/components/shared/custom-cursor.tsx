"use client";

import { useEffect, useRef } from "react";

interface TrailPoint {
  x: number;
  y: number;
  t: number;
  marks: Array<{ dx: number; dy: number; r: number; alpha: number }>;
}

const TRAIL_MS = 200;
const MARKS_PER_POINT = 3;

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const dot = dotRef.current;
    const canvas = canvasRef.current;
    if (!dot || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const trail: TrailPoint[] = [];
    let raf: number;
    let lastX = -1000;
    let lastY = -1000;

    const makeMarks = () =>
      Array.from({ length: MARKS_PER_POINT }, () => ({
        dx: (Math.random() - 0.5) * 12,
        dy: (Math.random() - 0.5) * 12,
        r: Math.random() * 1.0 + 0.3,
        alpha: Math.random() * 0.12 + 0.03,
      }));

    const addPoint = (x: number, y: number, t: number) => {
      trail.push({ x, y, t, marks: makeMarks() });
    };

    const onMove = (e: MouseEvent) => {
      const { clientX: x, clientY: y } = e;
      dot.style.transform = `translate(${x - 5}px, ${y - 5}px)`;
      dot.style.opacity = "1";

      // Interpolate intermediate points so the trail is continuous
      const dx = x - lastX;
      const dy = y - lastY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const step = 10; // px between interpolated points
      const now = performance.now();

      if (dist > step && lastX !== -1000) {
        const steps = Math.floor(dist / step);
        for (let i = 1; i < steps; i++) {
          const t = i / steps;
          addPoint(lastX + dx * t, lastY + dy * t, now);
        }
      }

      addPoint(x, y, now);
      lastX = x;
      lastY = y;
    };

    const onLeave = () => { dot.style.opacity = "0"; };
    const onEnter = () => { dot.style.opacity = "1"; };

    const INTERACTIVE = "a, button, [role='button'], input, select, textarea, label, summary";

    const onHoverIn = () => {
      dot.style.borderRadius = "2px";
      dot.style.backgroundColor = "#FFFFFF";
      dot.style.border = "2.5px solid #0D0D0D";
    };
    const onHoverOut = () => {
      dot.style.borderRadius = "50%";
      dot.style.backgroundColor = "#0D0D0D";
      dot.style.border = "1.5px solid rgba(255,255,255,0.7)";
    };

    document.querySelectorAll<HTMLElement>(INTERACTIVE).forEach(el => {
      el.addEventListener("mouseenter", onHoverIn);
      el.addEventListener("mouseleave", onHoverOut);
    });

    // Watch for new elements added to the DOM
    const observer = new MutationObserver(() => {
      document.querySelectorAll<HTMLElement>(INTERACTIVE).forEach(el => {
        el.removeEventListener("mouseenter", onHoverIn);
        el.removeEventListener("mouseleave", onHoverOut);
        el.addEventListener("mouseenter", onHoverIn);
        el.addEventListener("mouseleave", onHoverOut);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const tick = (now: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let i = 0;
      while (i < trail.length && now - trail[i].t > TRAIL_MS) i++;
      if (i > 0) trail.splice(0, i);

      for (const p of trail) {
        const age = now - p.t;
        const life = 1 - age / TRAIL_MS;
        const eased = life * life;

        for (const m of p.marks) {
          ctx.beginPath();
          ctx.arc(p.x + m.dx, p.y + m.dy, m.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(26,20,14,${m.alpha * eased})`;
          ctx.fill();
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("mouseenter", onEnter);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mouseenter", onEnter);
      document.querySelectorAll<HTMLElement>(INTERACTIVE).forEach(el => {
        el.removeEventListener("mouseenter", onHoverIn);
        el.removeEventListener("mouseleave", onHoverOut);
      });
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          pointerEvents: "none",
          zIndex: 9998,
        }}
      />
      <div
        ref={dotRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 10,
          height: 10,
          borderRadius: "50%",
          backgroundColor: "#0D0D0D",
          border: "1.5px solid rgba(255,255,255,0.7)",
          pointerEvents: "none",
          zIndex: 9999,
          opacity: 0,
          transition: "border-radius 150ms ease, background-color 150ms ease, border 150ms ease",
        }}
      />
    </>
  );
}
