"use client";

import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import type { Editor } from "@tiptap/react";
import type { ScriptListItem, TocItem } from "./GDocsEditor";
import { timeAgo } from "@/lib/utils";

interface GDocsSidebarProps {
  scripts: ScriptListItem[];
  currentScriptId: string;
  tocItems: TocItem[];
  editor: Editor;
}

export function GDocsSidebar({ scripts, currentScriptId, tocItems, editor }: GDocsSidebarProps) {
  function scrollToHeading(pos: number) {
    // Use tiptap to set cursor at that position, which causes the view to scroll to it
    editor.chain().focus().setTextSelection(pos).run();
    // After setting cursor, scroll the DOM
    setTimeout(() => {
      const domPos = editor.view.domAtPos(pos + 1);
      const el = domPos.node instanceof Element ? domPos.node : domPos.node.parentElement;
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  return (
    <aside
      className="hidden md:flex"
      style={{
        width: "240px",
        flexShrink: 0,
        backgroundColor: "white",
        borderRight: "1px solid #e0e0e0",
        flexDirection: "column",
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      {/* New document button */}
      <div style={{ padding: "12px 12px 8px" }}>
        <Link
          href="/documentos"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 12px",
            borderRadius: "4px",
            border: "1px solid #dadce0",
            backgroundColor: "white",
            color: "#444746",
            fontSize: "13px",
            fontFamily: "Arial, sans-serif",
            fontWeight: 500,
            textDecoration: "none",
            transition: "box-shadow 0.15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.15)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
        >
          <Plus size={16} />
          Nuevo documento
        </Link>
      </div>

      {/* TOC — headings in current document */}
      {tocItems.length > 0 && (
        <div style={{ padding: "8px 0" }}>
          <p style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "#5f6368",
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
                color: "#444746",
                fontFamily: "Arial, sans-serif",
                border: "none",
                backgroundColor: "transparent",
                cursor: "pointer",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={item.text}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "#f1f3f4"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
            >
              {item.text || "(Sin título)"}
            </button>
          ))}
        </div>
      )}

      {/* Divider */}
      <div style={{ height: "1px", backgroundColor: "#e0e0e0", margin: "4px 0" }} />

      {/* Document list */}
      <div style={{ padding: "8px 0", flex: 1 }}>
        <p style={{
          fontSize: "11px",
          fontWeight: 600,
          color: "#5f6368",
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
                backgroundColor: isActive ? "#e8f0fe" : "transparent",
                borderLeft: isActive ? "3px solid #1a73e8" : "3px solid transparent",
                transition: "background-color 0.1s",
              }}
              onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "#f1f3f4"; }}
              onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
            >
              <div style={{
                width: "28px",
                height: "36px",
                flexShrink: 0,
                backgroundColor: isActive ? "#c5d9fa" : "#e8eaf6",
                borderRadius: "2px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <FileText size={14} color={isActive ? "#1a73e8" : "#5f6368"} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{
                  fontSize: "13px",
                  fontFamily: "Arial, sans-serif",
                  color: isActive ? "#1a73e8" : "#202124",
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
                  color: "#5f6368",
                  margin: 0,
                }}>
                  {timeAgo(script.created_at)}
                </p>
              </div>
            </Link>
          );
        })}
        {scripts.length === 0 && (
          <p style={{ padding: "12px 16px", fontSize: "13px", color: "#5f6368", fontFamily: "Arial, sans-serif" }}>
            Sin documentos aún
          </p>
        )}
      </div>
    </aside>
  );
}
