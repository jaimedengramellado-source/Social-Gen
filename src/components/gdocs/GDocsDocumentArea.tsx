"use client";

import { useEffect, useState } from "react";
import { EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/react";

interface GDocsDocumentAreaProps {
  editor: Editor;
  zoom: number;
}

export function GDocsDocumentArea({ editor, zoom }: GDocsDocumentAreaProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const scale = zoom / 100;
  const pageW = 816;
  const pagePad = 96;
  const pageMinH = 1056;

  // En móvil la metáfora de "página" de ancho fijo deja el texto cortado:
  // se renderiza fluida a ancho completo, ignorando el zoom.
  if (isMobile) {
    return (
      <div
        className="pt-3 pb-24"
        style={{
          flex: 1,
          overflowY: "auto",
          backgroundColor: "var(--color-background)",
        }}
      >
        <div
          className="gdocs-page"
          style={{
            width: "100%",
            minHeight: "70vh",
            backgroundColor: "var(--color-card)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
            padding: "24px 20px",
            boxSizing: "border-box",
          }}
          onClick={() => editor.commands.focus()}
        >
          <EditorContent editor={editor} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="pt-5 pb-20 md:pb-5"
      style={{
        flex: 1,
        overflowY: "auto",
        overflowX: "auto",
        backgroundColor: "var(--color-background)",
      }}
    >
      <div
        style={{
          margin: "0 auto",
          width: `${pageW * scale}px`,
          minHeight: `${pageMinH * scale}px`,
          position: "relative",
        }}
      >
        {/* Scaled page */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: `${pageW}px`,
            minHeight: `${pageMinH}px`,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            backgroundColor: "var(--color-card)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
            padding: `${pagePad}px`,
            boxSizing: "border-box",
          }}
          className="gdocs-page"
          onClick={() => editor.commands.focus()}
        >
          <EditorContent editor={editor} />
        </div>
      </div>
      <div style={{ height: `${pageMinH * scale + 40}px`, width: "1px", display: "block", margin: "0 auto" }} />
    </div>
  );
}
