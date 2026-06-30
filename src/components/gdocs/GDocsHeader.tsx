"use client";

import { useRef, useState, useEffect } from "react";
import {
  Share2, Star, Folder, Cloud, Loader2, CheckCircle, AlertCircle,
  FileText, Download, Printer, Copy, ChevronDown,
} from "lucide-react";
import type { SaveState } from "./GDocsEditor";
import type { Editor } from "@tiptap/react";

interface GDocsHeaderProps {
  title: string;
  onTitleChange: (v: string) => void;
  saveState: SaveState;
  scriptId: string;
  editor: Editor | null;
}

export function GDocsHeader({ title, onTitleChange, saveState, editor }: GDocsHeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharePos, setSharePos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!shareOpen) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-gdocs-share]")) {
        setShareOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [shareOpen]);

  function openShare(e: React.MouseEvent<HTMLButtonElement>) {
    if (shareOpen) { setShareOpen(false); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setSharePos({ top: rect.bottom + 4, left: rect.right - 200 });
    setShareOpen(true);
  }

  function exportPDF() {
    setShareOpen(false);
    window.print();
  }

  function exportHTML() {
    if (!editor) return;
    setShareOpen(false);
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 48px 60px; font-size: 11pt; line-height: 1.5; color: #000; }
  h1 { font-size: 20pt; font-weight: 400; margin: 16px 0 4px; }
  h2 { font-size: 16pt; font-weight: 400; margin: 14px 0 4px; }
  h3 { font-size: 13pt; font-weight: 700; margin: 12px 0 4px; }
  p { margin: 0 0 8px; }
  ul { padding-left: 24px; list-style: disc; margin: 4px 0; }
  ol { padding-left: 24px; list-style: decimal; margin: 4px 0; }
  a { color: #1155cc; text-decoration: underline; }
  strong { font-weight: 700; }
  em { font-style: italic; }
  u { text-decoration: underline; }
  s { text-decoration: line-through; }
  hr { border: none; border-top: 1px solid #ccc; margin: 16px 0; }
</style>
</head>
<body>
<h1>${escHtml(title)}</h1>
${editor.getHTML()}
</body>
</html>`;
    downloadBlob(html, `${sanitizeFilename(title)}.html`, "text/html");
  }

  function exportText() {
    if (!editor) return;
    setShareOpen(false);
    const text = editor.state.doc.textContent;
    downloadBlob(text, `${sanitizeFilename(title)}.txt`, "text/plain");
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
    setShareOpen(false);
  }

  return (
    <header
      style={{
        height: "56px",
        borderBottom: "1px solid var(--color-border)",
        backgroundColor: "var(--color-card)",
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
        gap: "8px",
        flexShrink: 0,
      }}
    >
      {/* Doc icon */}
      <div style={{ flexShrink: 0 }}>
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <rect x="8" y="4" width="18" height="24" rx="1" fill="#4285F4" />
          <rect x="11" y="9" width="12" height="1.5" rx="0.75" fill="white" opacity="0.8" />
          <rect x="11" y="13" width="12" height="1.5" rx="0.75" fill="white" opacity="0.8" />
          <rect x="11" y="17" width="8" height="1.5" rx="0.75" fill="white" opacity="0.8" />
          <rect x="22" y="4" width="4" height="4" rx="0" fill="#1669d6" opacity="0.7" />
        </svg>
      </div>

      {/* Title + metadata icons */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: 1, minWidth: 0 }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={e => onTitleChange(e.target.value)}
            placeholder="Sin título"
            style={{
              fontSize: "18px",
              fontWeight: 400,
              fontFamily: "Arial, sans-serif",
              border: "1px solid transparent",
              borderRadius: "4px",
              padding: "4px 6px",
              outline: "none",
              backgroundColor: "transparent",
              color: "var(--color-foreground)",
              minWidth: "40px",
              maxWidth: "400px",
              width: `${Math.max(120, (title || "Sin título").length * 11)}px`,
              transition: "border-color 0.15s, background-color 0.15s",
            }}
            onMouseEnter={e => { (e.target as HTMLInputElement).style.borderColor = "var(--color-border)"; }}
            onMouseLeave={e => { if (document.activeElement !== e.target) (e.target as HTMLInputElement).style.borderColor = "transparent"; }}
            onFocus={e => { e.target.style.borderColor = "var(--color-primary)"; e.target.style.backgroundColor = "var(--color-muted)"; }}
            onBlur={e => { e.target.style.borderColor = "transparent"; e.target.style.backgroundColor = "transparent"; }}
          />
        </div>

        <div className="hidden md:flex items-center gap-0.5">
          <button title="Destacar" style={iconBtnStyle}><Star size={16} color="var(--color-muted-foreground)" /></button>
          <button title="Mover" style={iconBtnStyle}><Folder size={16} color="var(--color-muted-foreground)" /></button>
        </div>

        <div className="hidden md:flex" style={{ alignItems: "center", gap: "4px" }}>
          {saveState === "saving" && (
            <><Loader2 size={14} color="var(--color-muted-foreground)" style={{ animation: "spin 1s linear infinite" }} /><span style={saveTextStyle}>Guardando…</span></>
          )}
          {saveState === "saved" && (
            <><CheckCircle size={14} color="var(--color-primary)" /><span style={saveTextStyle}>Guardado</span></>
          )}
          {saveState === "idle" && (
            <><Cloud size={14} color="var(--color-muted-foreground)" /><span style={{ ...saveTextStyle, color: "var(--color-muted-foreground)" }}>Guardado</span></>
          )}
          {saveState === "error" && (
            <><AlertCircle size={14} color="var(--color-destructive)" /><span style={{ ...saveTextStyle, color: "var(--color-destructive)" }}>Error al guardar</span></>
          )}
        </div>
      </div>

      {/* Right zone */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, position: "relative" }}>
        <button
          data-gdocs-share
          onClick={openShare}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "7px 14px",
            borderRadius: "4px",
            border: "1px solid var(--color-border)",
            backgroundColor: shareOpen ? "var(--color-muted)" : "var(--color-card)",
            fontSize: "14px",
            fontWeight: 500,
            color: "var(--color-foreground)",
            cursor: "pointer",
            fontFamily: "Arial, sans-serif",
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-muted)")}
          onMouseLeave={e => { if (!shareOpen) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-card)"; }}
        >
          <Share2 size={15} />
          {copied ? "¡Copiado!" : "Compartir"}
          <ChevronDown size={13} style={{ transform: shareOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }} />
        </button>

        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            backgroundColor: "var(--color-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
          title="Cuenta"
        >
          <FileText size={14} color="white" />
        </div>
      </div>

      {/* Share/export dropdown */}
      {shareOpen && (
        <div
          data-gdocs-share
          style={{
            position: "fixed",
            top: sharePos.top,
            left: sharePos.left,
            backgroundColor: "var(--color-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            minWidth: "220px",
            padding: "8px 0",
            zIndex: 9999,
          }}
        >
          <div style={{ padding: "4px 16px 8px", borderBottom: "1px solid var(--color-border)", marginBottom: "4px" }}>
            <p style={{ fontSize: "11px", color: "var(--color-muted-foreground)", fontFamily: "Arial, sans-serif", margin: 0 }}>
              Exportar documento
            </p>
          </div>

          <ExportItem icon={<Printer size={15} />} label="PDF / Imprimir" description="Ctrl+P" onClick={exportPDF} />
          <ExportItem icon={<Download size={15} />} label="Página web (.html)" onClick={exportHTML} />
          <ExportItem icon={<FileText size={15} />} label="Texto sin formato (.txt)" onClick={exportText} />

          <div style={{ height: "1px", backgroundColor: "var(--color-border)", margin: "4px 0" }} />

          <ExportItem icon={<Copy size={15} />} label="Copiar enlace" onClick={copyLink} />
        </div>
      )}
    </header>
  );
}

function ExportItem({
  icon, label, description, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        width: "100%",
        padding: "7px 16px",
        fontSize: "13px",
        fontFamily: "Arial, sans-serif",
        color: "var(--color-foreground)",
        backgroundColor: "transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-muted)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
    >
      <span style={{ color: "var(--color-muted-foreground)", display: "flex", flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {description && <span style={{ fontSize: "12px", color: "var(--color-muted-foreground)" }}>{description}</span>}
    </button>
  );
}

function escHtml(str: string) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function sanitizeFilename(name: string) {
  return (name || "documento").replace(/[/\\?%*:|"<>]/g, "-").slice(0, 80);
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const iconBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "28px",
  height: "28px",
  borderRadius: "50%",
  border: "none",
  backgroundColor: "transparent",
  cursor: "pointer",
};

const saveTextStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--color-primary)",
  fontFamily: "Arial, sans-serif",
  whiteSpace: "nowrap",
};
