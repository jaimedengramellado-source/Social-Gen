"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, Loader2, Plus } from "lucide-react";
import type { Editor } from "@tiptap/react";
import type { ScriptListItem, TocItem } from "./GDocsEditor";
import { timeAgo } from "@/lib/utils";

interface GDocsSidebarProps {
  scripts: ScriptListItem[];
  currentScriptId: string;
  tocItems: TocItem[];
  editor: Editor;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function GDocsSidebar({ scripts, currentScriptId, tocItems, editor, mobileOpen = false, onMobileClose }: GDocsSidebarProps) {
  const [creating, setCreating] = useState(false);

  function scrollToHeading(pos: number) {
    editor.chain().focus().setTextSelection(pos).run();
    setTimeout(() => {
      const domPos = editor.view.domAtPos(pos + 1);
      const el = domPos.node instanceof Element ? domPos.node : domPos.node.parentElement;
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  async function handleNewDoc() {
    setCreating(true);
    try {
      const res = await fetch("/api/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Sin título" }),
      });
      const data = await res.json();
      if (data.script) {
        window.location.href = `/documentos/${data.script.id}`;
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
    {mobileOpen && (
      <div
        className="md:hidden fixed inset-0 z-50 bg-black/30"
        onClick={onMobileClose}
      />
    )}
    <aside
      className={`${mobileOpen ? "flex fixed inset-y-0 left-0 z-[60] shadow-2xl" : "hidden"} md:flex md:static md:inset-auto md:z-auto md:shadow-none`}
      style={{
        width: "240px",
        flexShrink: 0,
        backgroundColor: "var(--color-card)",
        borderRight: "1px solid var(--color-border)",
        flexDirection: "column",
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      {/* New document button */}
      <div style={{ padding: "12px 12px 8px" }}>
        <button
          onClick={handleNewDoc}
          disabled={creating}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 12px",
            borderRadius: "4px",
            border: "1px solid var(--color-border)",
            backgroundColor: "var(--color-card)",
            color: "var(--color-foreground)",
            fontSize: "13px",
            fontFamily: "Arial, sans-serif",
            fontWeight: 500,
            cursor: creating ? "default" : "pointer",
            opacity: creating ? 0.6 : 1,
            transition: "box-shadow 0.15s",
            width: "100%",
          }}
          onMouseEnter={e => { if (!creating) (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.15)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
        >
          {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          {creating ? "Creando…" : "Nuevo documento"}
        </button>
      </div>

      {/* TOC — headings in current document */}
      {tocItems.length > 0 && (
        <div style={{ padding: "8px 0" }}>
          <p style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "var(--color-muted-foreground)",
            fontFamily: "Arial, sans-serif",
            padding: "4px 16px",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}>
            Esquema
          </p>
          {tocItems.map((item, i) => (
            <button
              key={i}
              onClick={() => scrollToHeading(item.pos)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: `4px ${8 + (item.level - 1) * 12}px 4px 16px`,
                fontSize: item.level === 1 ? "13px" : "12px",
                fontWeight: item.level === 1 ? 500 : 400,
                color: "var(--color-foreground)",
                fontFamily: "Arial, sans-serif",
                border: "none",
                backgroundColor: "transparent",
                cursor: "pointer",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={item.text}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-muted)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
            >
              {item.text || "(Sin título)"}
            </button>
          ))}
        </div>
      )}

      {/* Divider */}
      <div style={{ height: "1px", backgroundColor: "var(--color-border)", margin: "4px 0" }} />

      {/* Document list */}
      <div style={{ padding: "8px 0", flex: 1 }}>
        <p style={{
          fontSize: "11px",
          fontWeight: 600,
          color: "var(--color-muted-foreground)",
          fontFamily: "Arial, sans-serif",
          padding: "4px 16px",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}>
          Documentos recientes
        </p>
        {scripts.map(script => {
          const isActive = script.id === currentScriptId;
          return (
            <Link
              key={script.id}
              href={`/documentos/${script.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "6px 16px",
                textDecoration: "none",
                backgroundColor: isActive ? "var(--color-primary-light)" : "transparent",
                borderLeft: isActive ? "3px solid var(--color-primary)" : "3px solid transparent",
                transition: "background-color 0.1s",
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-muted)"; }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
            >
              <div style={{
                width: "28px",
                height: "36px",
                flexShrink: 0,
                backgroundColor: isActive ? "var(--color-primary-light)" : "var(--color-muted)",
                borderRadius: "2px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <FileText size={14} color={isActive ? "var(--color-primary)" : "var(--color-muted-foreground)"} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{
                  fontSize: "13px",
                  fontFamily: "Arial, sans-serif",
                  color: isActive ? "var(--color-primary)" : "var(--color-foreground)",
                  fontWeight: isActive ? 500 : 400,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  margin: 0,
                }}>
                  {script.title || "Sin título"}
                </p>
                <p style={{
                  fontSize: "11px",
                  fontFamily: "Arial, sans-serif",
                  color: "var(--color-muted-foreground)",
                  margin: 0,
                }}>
                  {timeAgo(script.created_at)}
                </p>
              </div>
            </Link>
          );
        })}
        {scripts.length === 0 && (
          <p style={{ padding: "12px 16px", fontSize: "13px", color: "var(--color-muted-foreground)", fontFamily: "Arial, sans-serif" }}>
            Sin documentos aún
          </p>
        )}
      </div>
    </aside>
    </>
  );
}
