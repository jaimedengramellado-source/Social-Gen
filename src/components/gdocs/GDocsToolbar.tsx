"use client";

import { useState, useEffect, useRef } from "react";
import type { Editor } from "@tiptap/react";
import {
  Undo2, Redo2, Printer, Minus, Plus, ChevronDown,
  Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, IndentDecrease, IndentIncrease,
  Link as LinkIcon, Image as ImageIcon,
} from "lucide-react";

interface GDocsToolbarProps {
  editor: Editor;
  zoom: number;
  onZoomChange: (z: number) => void;
}

const FONTS = ["Arial", "Times New Roman", "Courier New", "Georgia", "Verdana", "Trebuchet MS"];
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72];
const ZOOM_OPTS = [50, 75, 90, 100, 125, 150, 200];
const LINE_SPACINGS = [
  { label: "1.0", value: "1" },
  { label: "1.15", value: "1.15" },
  { label: "1.5", value: "1.5" },
  { label: "2.0", value: "2" },
];
const PARA_STYLES = [
  { label: "Texto normal", value: "paragraph" },
  { label: "Título 1", value: "h1" },
  { label: "Título 2", value: "h2" },
  { label: "Título 3", value: "h3" },
];

function Sep() {
  return <div style={{ width: "1px", height: "20px", backgroundColor: "#e0e0e0", margin: "0 4px", flexShrink: 0 }} />;
}

function TBtn({
  onClick, active = false, disabled = false, title, children, style,
}: {
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick?.(); }}
      disabled={disabled}
      title={title}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: "28px",
        height: "28px",
        padding: "0 4px",
        borderRadius: "4px",
        border: "none",
        backgroundColor: active ? "#e8f0fe" : "transparent",
        color: active ? "#1a73e8" : "#444746",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
        fontSize: "13px",
        fontFamily: "Arial, sans-serif",
        gap: "2px",
        ...style,
      }}
      onMouseEnter={e => { if (!disabled && !active) (e.currentTarget as HTMLElement).style.backgroundColor = "#f1f3f4"; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
    >
      {children}
    </button>
  );
}

function StyledSelect({ value, onChange, options, width = "auto" }: {
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
  width?: string | number;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      onMouseDown={e => e.stopPropagation()}
      style={{
        height: "28px",
        fontSize: "13px",
        fontFamily: "Arial, sans-serif",
        color: "#444746",
        border: "1px solid transparent",
        borderRadius: "4px",
        backgroundColor: "transparent",
        padding: "0 4px",
        cursor: "pointer",
        outline: "none",
        width,
        appearance: "none",
        WebkitAppearance: "none",
        paddingRight: "16px",
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%235f6368'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 4px center",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#dadce0"; (e.currentTarget as HTMLElement).style.backgroundColor = "#f1f3f4"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "transparent"; (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

export function GDocsToolbar({ editor, zoom, onZoomChange }: GDocsToolbarProps) {
  const [fontSizeInput, setFontSizeInput] = useState("11");
  const fontSizeRef = useRef("11");

  // Sync font size from editor selection
  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const raw = editor.getAttributes("textStyle").fontSize as string | undefined;
      const num = raw ? raw.replace(/[^0-9.]/g, "") : "11";
      setFontSizeInput(num);
      fontSizeRef.current = num;
    };
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    return () => { editor.off("selectionUpdate", update); editor.off("transaction", update); };
  }, [editor]);

  function getParagraphStyle() {
    if (editor.isActive("heading", { level: 1 })) return "h1";
    if (editor.isActive("heading", { level: 2 })) return "h2";
    if (editor.isActive("heading", { level: 3 })) return "h3";
    return "paragraph";
  }

  function applyParagraphStyle(v: string) {
    if (v === "paragraph") editor.chain().focus().setParagraph().run();
    else editor.chain().focus().setHeading({ level: parseInt(v.replace("h", "")) as 1 | 2 | 3 }).run();
  }

  const currentFont = (editor.getAttributes("textStyle").fontFamily as string | undefined) || "Arial";
  const currentColor = (editor.getAttributes("textStyle").color as string | undefined) || "#000000";
  const currentBg = (editor.getAttributes("textStyle").backgroundColor as string | undefined) || "transparent";

  function applyFontSize(val: string) {
    const n = parseFloat(val);
    if (!isNaN(n) && n > 0 && n <= 400) {
      editor.chain().focus().setFontSize(`${n}pt`).run();
    }
  }

  return (
    <div
      style={{
        height: "40px",
        backgroundColor: "white",
        borderBottom: "1px solid #e0e0e0",
        display: "flex",
        alignItems: "center",
        padding: "0 8px",
        gap: "2px",
        flexShrink: 0,
        overflowX: "auto",
        overflowY: "hidden",
      }}
      onMouseDown={e => e.preventDefault()}
    >
      {/* Print / Undo / Redo */}
      <TBtn onClick={() => window.print()} title="Imprimir (Ctrl+P)"><Printer size={16} /></TBtn>
      <TBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Deshacer (Ctrl+Z)">
        <Undo2 size={16} />
      </TBtn>
      <TBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Rehacer (Ctrl+Shift+Z)">
        <Redo2 size={16} />
      </TBtn>

      <Sep />

      {/* Zoom */}
      <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
        <TBtn onClick={() => onZoomChange(Math.max(25, zoom - 10))} title="Reducir zoom"><Minus size={13} /></TBtn>
        <div style={{ position: "relative" }}>
          <StyledSelect
            value={String(ZOOM_OPTS.includes(zoom) ? zoom : zoom)}
            onChange={v => onZoomChange(parseInt(v))}
            options={ZOOM_OPTS.map(z => ({ label: `${z}%`, value: String(z) }))}
            width="68px"
          />
        </div>
        <TBtn onClick={() => onZoomChange(Math.min(400, zoom + 10))} title="Aumentar zoom"><Plus size={13} /></TBtn>
      </div>

      <Sep />

      {/* Paragraph style */}
      <StyledSelect
        value={getParagraphStyle()}
        onChange={applyParagraphStyle}
        options={PARA_STYLES}
        width="130px"
      />

      <Sep />

      {/* Font family */}
      <select
        value={FONTS.includes(currentFont) ? currentFont : "Arial"}
        onChange={e => { e.stopPropagation(); editor.chain().focus().setFontFamily(e.target.value).run(); }}
        onMouseDown={e => e.stopPropagation()}
        style={{
          height: "28px",
          fontSize: "13px",
          fontFamily: currentFont + ", Arial, sans-serif",
          color: "#444746",
          border: "1px solid transparent",
          borderRadius: "4px",
          backgroundColor: "transparent",
          padding: "0 6px",
          outline: "none",
          width: "130px",
          cursor: "pointer",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#dadce0"; (e.currentTarget as HTMLElement).style.backgroundColor = "#f1f3f4"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "transparent"; (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
      >
        {FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
      </select>

      {/* Font size */}
      <div style={{ display: "flex", alignItems: "center", gap: "0" }}>
        <TBtn onClick={() => { const n = Math.max(1, parseFloat(fontSizeRef.current) - 1); const s = String(n); setFontSizeInput(s); fontSizeRef.current = s; applyFontSize(s); }} title="Reducir tamaño">
          <Minus size={12} />
        </TBtn>
        <input
          type="text"
          value={fontSizeInput}
          onChange={e => { setFontSizeInput(e.target.value); fontSizeRef.current = e.target.value; }}
          onBlur={() => applyFontSize(fontSizeInput)}
          onKeyDown={e => { if (e.key === "Enter") { applyFontSize(fontSizeInput); (e.currentTarget as HTMLInputElement).blur(); } }}
          onMouseDown={e => e.stopPropagation()}
          style={{
            width: "40px",
            height: "28px",
            textAlign: "center",
            fontSize: "13px",
            fontFamily: "Arial, sans-serif",
            border: "1px solid #dadce0",
            borderRadius: "4px",
            outline: "none",
            color: "#444746",
            backgroundColor: "white",
          }}
        />
        <TBtn onClick={() => { const n = parseFloat(fontSizeRef.current) + 1; const s = String(n); setFontSizeInput(s); fontSizeRef.current = s; applyFontSize(s); }} title="Aumentar tamaño">
          <Plus size={12} />
        </TBtn>
      </div>

      <Sep />

      {/* Bold / Italic / Underline / Strike */}
      <TBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Negrita (Ctrl+B)">
        <Bold size={16} />
      </TBtn>
      <TBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Cursiva (Ctrl+I)">
        <Italic size={16} />
      </TBtn>
      <TBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Subrayado (Ctrl+U)">
        <Underline size={16} />
      </TBtn>
      <TBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Tachado">
        <Strikethrough size={16} />
      </TBtn>

      <Sep />

      {/* Text color */}
      <label title="Color de texto" style={{ position: "relative", cursor: "pointer" }}>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", width: "28px", height: "28px",
          borderRadius: "4px", gap: "1px",
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "#f1f3f4"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
        >
          <span style={{ fontSize: "13px", fontWeight: 700, color: currentColor, lineHeight: 1 }}>A</span>
          <div style={{ width: "16px", height: "3px", backgroundColor: currentColor, borderRadius: "1px" }} />
        </div>
        <input
          type="color"
          value={currentColor === "#000000" || !currentColor.startsWith("#") ? "#000000" : currentColor}
          onChange={e => editor.chain().focus().setColor(e.target.value).run()}
          onMouseDown={e => e.stopPropagation()}
          style={{ position: "absolute", opacity: 0, width: "100%", height: "100%", top: 0, left: 0, cursor: "pointer" }}
        />
      </label>

      {/* Background / Highlight color */}
      <label title="Resaltado" style={{ position: "relative", cursor: "pointer" }}>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", width: "28px", height: "28px",
          borderRadius: "4px", gap: "1px",
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "#f1f3f4"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
        >
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#202124", lineHeight: 1,
            backgroundColor: currentBg === "transparent" ? "transparent" : currentBg, padding: "0 1px" }}>A</span>
          <div style={{ width: "16px", height: "3px", backgroundColor: currentBg === "transparent" ? "#fbbc04" : currentBg, borderRadius: "1px" }} />
        </div>
        <input
          type="color"
          value={currentBg === "transparent" ? "#fbbc04" : currentBg}
          onChange={e => editor.chain().focus().setBackgroundColor(e.target.value).run()}
          onMouseDown={e => e.stopPropagation()}
          style={{ position: "absolute", opacity: 0, width: "100%", height: "100%", top: 0, left: 0, cursor: "pointer" }}
        />
      </label>

      <Sep />

      {/* Link */}
      <TBtn
        onClick={() => {
          const url = window.prompt("URL del enlace:", editor.getAttributes("link").href as string || "https://");
          if (url) editor.chain().focus().setLink({ href: url }).run();
          else editor.chain().focus().unsetLink().run();
        }}
        active={editor.isActive("link")}
        title="Insertar enlace (Ctrl+K)"
      >
        <LinkIcon size={15} />
      </TBtn>

      <Sep />

      {/* Text alignment */}
      <TBtn onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Alinear izquierda">
        <AlignLeft size={16} />
      </TBtn>
      <TBtn onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Centrar">
        <AlignCenter size={16} />
      </TBtn>
      <TBtn onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Alinear derecha">
        <AlignRight size={16} />
      </TBtn>
      <TBtn onClick={() => editor.chain().focus().setTextAlign("justify").run()} active={editor.isActive({ textAlign: "justify" })} title="Justificar">
        <AlignJustify size={16} />
      </TBtn>

      <Sep />

      {/* Lists */}
      <TBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Lista con viñetas">
        <List size={16} />
      </TBtn>
      <TBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Lista numerada">
        <ListOrdered size={16} />
      </TBtn>
      <TBtn
        onClick={() => editor.chain().focus().liftListItem("listItem").run()}
        disabled={!editor.can().liftListItem("listItem")}
        title="Reducir sangría"
      >
        <IndentDecrease size={16} />
      </TBtn>
      <TBtn
        onClick={() => editor.chain().focus().sinkListItem("listItem").run()}
        disabled={!editor.can().sinkListItem("listItem")}
        title="Aumentar sangría"
      >
        <IndentIncrease size={16} />
      </TBtn>
    </div>
  );
}
