"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, X, Image as ImageIcon, Link2 } from "lucide-react";
import type { Editor } from "@tiptap/react";
import type { Selection } from "@tiptap/pm/state";

interface GDocsMenuBarProps {
  editor: Editor;
}

interface MenuItem {
  label: string;
  action?: () => void;
  shortcut?: string;
  divider?: boolean;
  disabled?: boolean;
}

interface MenuDef {
  name: string;
  items: MenuItem[];
}

type ImageTab = "url" | "upload";

export function GDocsMenuBar({ editor }: GDocsMenuBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const [imageOpen, setImageOpen] = useState(false);
  const [imageTab, setImageTab] = useState<ImageTab>("url");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [hasFile, setHasFile] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedSelection = useRef<Selection | null>(null);

  useEffect(() => {
    if (!openMenu) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-gdocs-menubar]")) setOpenMenu(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenu]);

  function openDropdown(menuName: string, e: React.MouseEvent<HTMLButtonElement>) {
    if (openMenu === menuName) { setOpenMenu(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 2, left: rect.left });
    setOpenMenu(menuName);
  }

  function openImageDialog() {
    savedSelection.current = editor.state.selection;
    setOpenMenu(null);
    setImageUrl("");
    setUploadPreview(null);
    setUploadError("");
    setHasFile(false);
    setImageTab("url");
    setImageOpen(true);
  }

  function closeImageDialog() {
    setImageOpen(false);
    if (uploadPreview) URL.revokeObjectURL(uploadPreview);
    setUploadPreview(null);
    setHasFile(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function restoreSelectionAndInsert(fn: () => void) {
    if (savedSelection.current) {
      try {
        const tr = editor.state.tr.setSelection(savedSelection.current);
        editor.view.dispatch(tr);
      } catch { /* selection might be stale */ }
    }
    editor.view.focus();
    fn();
  }

  function insertImageFromUrl() {
    const url = imageUrl.trim();
    if (!url) return;
    closeImageDialog();
    restoreSelectionAndInsert(() => { editor.commands.setImage({ src: url }); });
  }

  async function uploadAndInsert() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/chat-image", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text() || "Error al subir");
      const { url } = await res.json() as { url: string };
      closeImageDialog();
      restoreSelectionAndInsert(() => { editor.commands.setImage({ src: url }); });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Error al subir");
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setHasFile(!!file);
    setUploadError("");
    if (!file) { setUploadPreview(null); return; }
    if (uploadPreview) URL.revokeObjectURL(uploadPreview);
    setUploadPreview(URL.createObjectURL(file));
  }

  function insertEscaletaTable() {
    setOpenMenu(null);
    const emptyCell = () => ({ type: "tableCell", content: [{ type: "paragraph" }] });
    editor.chain().focus().insertContent({
      type: "table",
      content: [
        {
          type: "tableRow",
          content: ["Tiempo", "Descripción", "Diálogo"].map(text => ({
            type: "tableHeader",
            content: [{ type: "paragraph", content: [{ type: "text", text }] }],
          })),
        },
        { type: "tableRow", content: [emptyCell(), emptyCell(), emptyCell()] },
        { type: "tableRow", content: [emptyCell(), emptyCell(), emptyCell()] },
        { type: "tableRow", content: [emptyCell(), emptyCell(), emptyCell()] },
      ],
    }).run();
  }

  const menus: MenuDef[] = [
    {
      name: "Archivo",
      items: [
        { label: "Nuevo documento", action: () => { window.open("/documentos", "_blank"); setOpenMenu(null); } },
        { divider: true, label: "" },
        { label: "Imprimir", shortcut: "Ctrl+P", action: () => { setOpenMenu(null); window.print(); } },
      ],
    },
    {
      name: "Editar",
      items: [
        { label: "Deshacer", shortcut: "Ctrl+Z", action: () => { editor.chain().focus().undo().run(); setOpenMenu(null); }, disabled: !editor.can().undo() },
        { label: "Rehacer", shortcut: "Ctrl+Shift+Z", action: () => { editor.chain().focus().redo().run(); setOpenMenu(null); }, disabled: !editor.can().redo() },
        { divider: true, label: "" },
        { label: "Seleccionar todo", shortcut: "Ctrl+A", action: () => { editor.chain().focus().selectAll().run(); setOpenMenu(null); } },
      ],
    },
    {
      name: "Ver",
      items: [
        { label: "Pantalla completa", action: () => { document.documentElement.requestFullscreen?.(); setOpenMenu(null); } },
        { label: "Salir de pantalla completa", action: () => { document.exitFullscreen?.(); setOpenMenu(null); } },
      ],
    },
    {
      name: "Insertar",
      items: [
        { label: "Imagen…", action: openImageDialog },
        {
          label: "Enlace…", shortcut: "Ctrl+K",
          action: () => {
            setOpenMenu(null);
            const existing = editor.getAttributes("link").href as string | undefined;
            const url = window.prompt("URL del enlace:", existing || "https://");
            if (url) editor.chain().focus().setLink({ href: url }).run();
            else editor.chain().focus().unsetLink().run();
          },
        },
        { label: "Tabla de escaleta (Tiempo / Descripción / Diálogo)", action: insertEscaletaTable },
        { divider: true, label: "" },
        { label: "Salto de línea", action: () => { editor.chain().focus().setHardBreak().run(); setOpenMenu(null); } },
        { label: "Línea horizontal", action: () => { editor.chain().focus().setHorizontalRule().run(); setOpenMenu(null); } },
      ],
    },
    {
      name: "Tabla",
      items: [
        { label: "Insertar tabla de escaleta", action: insertEscaletaTable },
        { divider: true, label: "" },
        { label: "Insertar fila arriba", action: () => { editor.chain().focus().addRowBefore().run(); setOpenMenu(null); }, disabled: !editor.isActive("table") },
        { label: "Insertar fila abajo", action: () => { editor.chain().focus().addRowAfter().run(); setOpenMenu(null); }, disabled: !editor.isActive("table") },
        { label: "Eliminar fila", action: () => { editor.chain().focus().deleteRow().run(); setOpenMenu(null); }, disabled: !editor.isActive("table") },
        { divider: true, label: "" },
        { label: "Insertar columna izquierda", action: () => { editor.chain().focus().addColumnBefore().run(); setOpenMenu(null); }, disabled: !editor.isActive("table") },
        { label: "Insertar columna derecha", action: () => { editor.chain().focus().addColumnAfter().run(); setOpenMenu(null); }, disabled: !editor.isActive("table") },
        { label: "Eliminar columna", action: () => { editor.chain().focus().deleteColumn().run(); setOpenMenu(null); }, disabled: !editor.isActive("table") },
        { divider: true, label: "" },
        { label: "Combinar celdas", action: () => { editor.chain().focus().mergeCells().run(); setOpenMenu(null); }, disabled: !editor.can().mergeCells() },
        { label: "Dividir celda", action: () => { editor.chain().focus().splitCell().run(); setOpenMenu(null); }, disabled: !editor.can().splitCell() },
        { divider: true, label: "" },
        { label: "Eliminar tabla", action: () => { editor.chain().focus().deleteTable().run(); setOpenMenu(null); }, disabled: !editor.isActive("table") },
      ],
    },
    {
      name: "Formato",
      items: [
        { label: "Negrita", shortcut: "Ctrl+B", action: () => { editor.chain().focus().toggleBold().run(); setOpenMenu(null); } },
        { label: "Cursiva", shortcut: "Ctrl+I", action: () => { editor.chain().focus().toggleItalic().run(); setOpenMenu(null); } },
        { label: "Subrayado", shortcut: "Ctrl+U", action: () => { editor.chain().focus().toggleUnderline().run(); setOpenMenu(null); } },
        { label: "Tachado", action: () => { editor.chain().focus().toggleStrike().run(); setOpenMenu(null); } },
        { divider: true, label: "" },
        { label: "Texto normal", action: () => { editor.chain().focus().setParagraph().run(); setOpenMenu(null); } },
        { label: "Título 1", action: () => { editor.chain().focus().toggleHeading({ level: 1 }).run(); setOpenMenu(null); } },
        { label: "Título 2", action: () => { editor.chain().focus().toggleHeading({ level: 2 }).run(); setOpenMenu(null); } },
        { label: "Título 3", action: () => { editor.chain().focus().toggleHeading({ level: 3 }).run(); setOpenMenu(null); } },
      ],
    },
    {
      name: "Herramientas",
      items: [
        {
          label: "Contar palabras",
          action: () => {
            const text = editor.state.doc.textContent;
            const words = text.trim().split(/\s+/).filter(Boolean).length;
            alert(`Palabras: ${words}\nCaracteres: ${text.length}`);
            setOpenMenu(null);
          },
        },
      ],
    },
  ];

  const activeMenuDef = menus.find(m => m.name === openMenu);
  const insertBtnDisabled = uploading || (imageTab === "url" ? !imageUrl.trim() : !hasFile);

  return (
    <>
      <div
        data-gdocs-menubar
        style={{
          height: "36px",
          backgroundColor: "var(--color-card)",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          padding: "0 4px",
          flexShrink: 0,
          zIndex: 50,
        }}
      >
        {menus.map(menu => (
          <button
            key={menu.name}
            data-gdocs-menubar
            onClick={e => openDropdown(menu.name, e)}
            style={{
              padding: "4px 12px",
              fontSize: "13px",
              fontFamily: "Arial, sans-serif",
              color: "var(--color-foreground)",
              backgroundColor: openMenu === menu.name ? "var(--color-muted)" : "transparent",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              height: "28px",
              display: "flex",
              alignItems: "center",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-muted)"; }}
            onMouseLeave={e => { if (openMenu !== menu.name) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
          >
            {menu.name}
          </button>
        ))}
      </div>

      {/* Dropdown */}
      {activeMenuDef && (
        <div
          data-gdocs-menubar
          style={{
            position: "fixed",
            top: dropdownPos.top,
            left: dropdownPos.left,
            backgroundColor: "var(--color-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "4px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            minWidth: "220px",
            padding: "6px 0",
            zIndex: 9999,
          }}
        >
          {activeMenuDef.items.map((item, i) =>
            item.divider ? (
              <div key={i} style={{ height: "1px", backgroundColor: "var(--color-border)", margin: "4px 0" }} />
            ) : (
              <button
                key={i}
                onClick={item.action}
                disabled={item.disabled}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  width: "100%",
                  padding: "6px 24px 6px 16px",
                  fontSize: "13px",
                  fontFamily: "Arial, sans-serif",
                  color: item.disabled ? "var(--color-muted-foreground)" : "var(--color-foreground)",
                  backgroundColor: "transparent",
                  border: "none",
                  cursor: item.disabled ? "default" : "pointer",
                  textAlign: "left",
                }}
                onMouseEnter={e => { if (!item.disabled) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-muted)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
              >
                <span>{item.label}</span>
                {item.shortcut && (
                  <span style={{ fontSize: "12px", color: "var(--color-muted-foreground)", marginLeft: "24px" }}>{item.shortcut}</span>
                )}
              </button>
            )
          )}
        </div>
      )}

      {/* Image insertion dialog */}
      {imageOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
          onMouseDown={e => { if (e.target === e.currentTarget) closeImageDialog(); }}
        >
          <div
            style={{
              backgroundColor: "var(--color-card)",
              borderRadius: "8px",
              border: "1px solid var(--color-border)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
              width: "440px",
              maxWidth: "calc(100vw - 32px)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 12px", borderBottom: "1px solid var(--color-border)" }}>
              <span style={{ fontSize: "15px", fontWeight: 500, fontFamily: "Arial, sans-serif", color: "var(--color-foreground)" }}>
                Insertar imagen
              </span>
              <button
                onClick={closeImageDialog}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px", borderRadius: "50%", border: "none", backgroundColor: "transparent", cursor: "pointer", color: "var(--color-muted-foreground)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-muted)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid var(--color-border)" }}>
              {([
                ["url", "Desde URL", <Link2 size={14} key="l" />],
                ["upload", "Subir imagen", <ImageIcon size={14} key="i" />],
              ] as [ImageTab, string, React.ReactNode][]).map(([tab, label, icon]) => (
                <button
                  key={tab}
                  onClick={() => { setImageTab(tab); setUploadError(""); }}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "10px",
                    fontSize: "13px",
                    fontFamily: "Arial, sans-serif",
                    color: imageTab === tab ? "var(--color-primary)" : "var(--color-muted-foreground)",
                    backgroundColor: "transparent",
                    border: "none",
                    borderBottom: imageTab === tab ? "2px solid var(--color-primary)" : "2px solid transparent",
                    cursor: "pointer",
                    fontWeight: imageTab === tab ? 500 : 400,
                  }}
                >
                  {icon}{label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div style={{ padding: "20px" }}>
              {imageTab === "url" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={e => setImageUrl(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && imageUrl.trim()) insertImageFromUrl(); }}
                    placeholder="https://ejemplo.com/imagen.jpg"
                    autoFocus
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      fontSize: "13px",
                      fontFamily: "Arial, sans-serif",
                      border: "1px solid var(--color-border)",
                      borderRadius: "4px",
                      outline: "none",
                      color: "var(--color-foreground)",
                      backgroundColor: "var(--color-muted)",
                      boxSizing: "border-box",
                    }}
                    onFocus={e => { e.target.style.borderColor = "var(--color-primary)"; }}
                    onBlur={e => { e.target.style.borderColor = "var(--color-border)"; }}
                  />
                  {imageUrl.trim() && (
                    <img
                      src={imageUrl}
                      alt="Vista previa"
                      style={{ maxHeight: "160px", objectFit: "contain", borderRadius: "4px", border: "1px solid var(--color-border)" }}
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                      onLoad={e => { (e.target as HTMLImageElement).style.display = "block"; }}
                    />
                  )}
                </div>
              )}

              {imageTab === "upload" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <label
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      padding: "24px",
                      border: `2px dashed ${hasFile ? "var(--color-primary)" : "var(--color-border)"}`,
                      borderRadius: "6px",
                      cursor: "pointer",
                      backgroundColor: hasFile ? "var(--color-primary-light)" : "var(--color-muted)",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { if (!hasFile) (e.currentTarget as HTMLElement).style.borderColor = "var(--color-primary)"; }}
                    onMouseLeave={e => { if (!hasFile) (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)"; }}
                  >
                    <ImageIcon size={28} color={hasFile ? "var(--color-primary)" : "var(--color-muted-foreground)"} />
                    <span style={{ fontSize: "13px", fontFamily: "Arial, sans-serif", color: hasFile ? "var(--color-primary)" : "var(--color-muted-foreground)", textAlign: "center" }}>
                      {hasFile
                        ? fileInputRef.current?.files?.[0]?.name ?? "Archivo seleccionado"
                        : <>Haz clic para seleccionar<br /><span style={{ fontSize: "11px" }}>JPG, PNG, GIF, WebP · máx. 5 MB</span></>
                      }
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleFileChange}
                      style={{ display: "none" }}
                    />
                  </label>

                  {uploadPreview && (
                    <img
                      src={uploadPreview}
                      alt="Vista previa"
                      style={{ maxHeight: "160px", objectFit: "contain", borderRadius: "4px", border: "1px solid var(--color-border)" }}
                    />
                  )}

                  {uploadError && (
                    <p style={{ fontSize: "12px", color: "var(--color-destructive)", fontFamily: "Arial, sans-serif", margin: 0 }}>
                      {uploadError}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "0 20px 16px" }}>
              <button
                onClick={closeImageDialog}
                style={{ padding: "8px 20px", fontSize: "13px", fontFamily: "Arial, sans-serif", color: "var(--color-foreground)", backgroundColor: "transparent", border: "1px solid var(--color-border)", borderRadius: "4px", cursor: "pointer" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-muted)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
              >
                Cancelar
              </button>
              <button
                onClick={imageTab === "url" ? insertImageFromUrl : uploadAndInsert}
                disabled={insertBtnDisabled}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 20px",
                  fontSize: "13px",
                  fontFamily: "Arial, sans-serif",
                  color: "white",
                  backgroundColor: "var(--color-primary)",
                  border: "none",
                  borderRadius: "4px",
                  cursor: insertBtnDisabled ? "not-allowed" : "pointer",
                  opacity: insertBtnDisabled ? 0.5 : 1,
                  transition: "opacity 0.15s, filter 0.15s",
                }}
                onMouseEnter={e => { if (!insertBtnDisabled) (e.currentTarget as HTMLElement).style.filter = "brightness(0.9)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = "none"; }}
              >
                {uploading && <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />}
                {uploading ? "Subiendo…" : "Insertar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
