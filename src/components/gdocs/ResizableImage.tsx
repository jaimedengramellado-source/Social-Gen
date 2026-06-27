"use client";

import { useRef } from "react";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import Image from "@tiptap/extension-image";

const CORNER_SIZE = 10;
const CORNERS = [
  { dir: "nw", style: { top: -CORNER_SIZE / 2, left: -CORNER_SIZE / 2, cursor: "nw-resize" } },
  { dir: "ne", style: { top: -CORNER_SIZE / 2, right: -CORNER_SIZE / 2, cursor: "ne-resize" } },
  { dir: "sw", style: { bottom: -CORNER_SIZE / 2, left: -CORNER_SIZE / 2, cursor: "sw-resize" } },
  { dir: "se", style: { bottom: -CORNER_SIZE / 2, right: -CORNER_SIZE / 2, cursor: "se-resize" } },
] as const;

function ImageNodeView({ node, selected, updateAttributes }: NodeViewProps) {
  const { src, alt, width } = node.attrs as {
    src: string;
    alt?: string;
    width?: number;
    height?: number;
  };

  const imgRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ x0: number; w0: number; ratio: number; isLeft: boolean } | null>(null);

  function startResize(dir: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation(); // don't let ProseMirror steal focus during resize

    const img = imgRef.current;
    if (!img) return;
    const w0 = img.offsetWidth || img.naturalWidth || 300;
    const h0 = img.offsetHeight || img.naturalHeight || 200;
    drag.current = { x0: e.clientX, w0, ratio: w0 / h0, isLeft: dir.startsWith("n") ? false : dir === "nw" || dir === "sw" };

    // Recompute: left-side handles (nw, sw) shrink width when moving right
    const isLeft = dir === "nw" || dir === "sw";
    drag.current = { x0: e.clientX, w0, ratio: w0 / h0, isLeft };

    function onMove(ev: MouseEvent) {
      const d = drag.current;
      if (!d) return;
      const dx = ev.clientX - d.x0;
      const newW = Math.max(48, d.w0 + (d.isLeft ? -dx : dx));
      const newH = Math.round(newW / d.ratio);
      updateAttributes({ width: Math.round(newW), height: newH });
    }

    function onUp() {
      drag.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <NodeViewWrapper as="div" style={{ display: "block", lineHeight: 0, margin: "4px 0" }}>
      {/* Drag handle — plain div so ProseMirror can drag this node */}
      <div
        data-drag-handle
        title="Arrastra para mover"
        style={{
          height: selected ? 22 : 0,
          overflow: "hidden",
          backgroundColor: "#e8f0fe",
          borderTop: selected ? "1px solid #1a73e8" : "none",
          borderLeft: selected ? "1px solid #1a73e8" : "none",
          borderRight: selected ? "1px solid #1a73e8" : "none",
          borderRadius: "4px 4px 0 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          cursor: "grab",
          userSelect: "none",
          transition: "height 0.1s",
          maxWidth: width ? `${width}px` : "100%",
        }}
      >
        {/* Grip dots */}
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            style={{
              display: "inline-block",
              width: 3,
              height: 3,
              borderRadius: "50%",
              backgroundColor: "#4285f4",
            }}
          />
        ))}
      </div>

      {/* Image + corner handles */}
      <div
        style={{
          position: "relative",
          display: "inline-block",
          lineHeight: 0,
          maxWidth: "100%",
        }}
      >
        <img
          ref={imgRef}
          src={src}
          alt={alt ?? ""}
          draggable={false}
          style={{
            display: "block",
            maxWidth: "100%",
            width: width ? `${width}px` : undefined,
            outline: selected ? "2px solid #1a73e8" : "none",
            outlineOffset: "1px",
            userSelect: "none",
            borderRadius: selected ? "0 0 2px 2px" : "2px",
          }}
        />

        {selected && CORNERS.map(c => {
          const { cursor, ...pos } = c.style;
          return (
            <div
              key={c.dir}
              onMouseDown={e => startResize(c.dir, e)}
              style={{
                position: "absolute",
                width: CORNER_SIZE,
                height: CORNER_SIZE,
                backgroundColor: "#fff",
                border: "2px solid #1a73e8",
                borderRadius: "2px",
                boxSizing: "border-box",
                zIndex: 10,
                cursor,
                ...pos,
              }}
            />
          );
        })}
      </div>
    </NodeViewWrapper>
  );
}

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: el => {
          const w = el.getAttribute("width");
          return w ? parseInt(w) : null;
        },
        renderHTML: attrs => (attrs.width ? { width: attrs.width } : {}),
      },
      height: {
        default: null,
        parseHTML: el => {
          const h = el.getAttribute("height");
          return h ? parseInt(h) : null;
        },
        renderHTML: attrs => (attrs.height ? { height: attrs.height } : {}),
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});
