"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useEditor } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle, Color, FontFamily, FontSize, BackgroundColor } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { ResizableImage } from "./ResizableImage";
import { createClient } from "@/lib/supabase/client";
import { GDocsHeader } from "./GDocsHeader";
import { GDocsMenuBar } from "./GDocsMenuBar";
import { GDocsToolbar } from "./GDocsToolbar";
import { GDocsDocumentArea } from "./GDocsDocumentArea";
import { GDocsSidebar } from "./GDocsSidebar";

export type SaveState = "idle" | "saving" | "saved" | "error";

export interface ScriptListItem {
  id: string;
  title: string;
  platform: string | null;
  viral_score: number | null;
  created_at: string;
}

export interface GDocsEditorProps {
  scriptId: string;
  initialTitle: string;
  initialContent: object | null;
  legacyHook?: string | null;
  legacyIntro?: string | null;
  legacyMainContent?: Array<{ section: string; content: string }> | null;
  legacyCta?: string | null;
  allScripts: ScriptListItem[];
}

export interface TocItem {
  level: number;
  text: string;
  pos: number;
}

function buildInitialContent(props: GDocsEditorProps): object | string {
  if (props.initialContent) return props.initialContent;
  const parts: string[] = [];
  if (props.legacyHook) { parts.push("<h2>🎣 Hook</h2>"); parts.push(props.legacyHook); }
  if (props.legacyIntro) { parts.push("<h2>Introducción</h2>"); parts.push(props.legacyIntro); }
  if (Array.isArray(props.legacyMainContent)) {
    for (const sec of props.legacyMainContent) {
      if (sec.section) parts.push(`<h2>${sec.section}</h2>`);
      if (sec.content) parts.push(sec.content);
    }
  }
  if (props.legacyCta) { parts.push("<h2>🎯 CTA</h2>"); parts.push(props.legacyCta); }
  return parts.join("") || "<p></p>";
}

function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout>;
  return (...args: A) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

async function uploadImageFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload/chat-image", { method: "POST", body: fd });
  if (!res.ok) throw new Error(await res.text() || "Error al subir");
  const { url } = await res.json() as { url: string };
  return url;
}

export function GDocsEditor(props: GDocsEditorProps) {
  const { scriptId, initialTitle, allScripts } = props;

  const [zoom, setZoom] = useState(100);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [title, setTitle] = useState(initialTitle);
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [localScripts, setLocalScripts] = useState<ScriptListItem[]>(allScripts);

  const saveStateRef = useRef(saveState);
  useEffect(() => { saveStateRef.current = saveState; }, [saveState]);

  // Used in paste handler which is defined before editor is created
  const editorRef = useRef<Editor | null>(null);

  const initialContent = buildInitialContent(props);

  const saveContent = useCallback(async (content: object) => {
    setSaveState("saving");
    try {
      const supabase = createClient();
      await supabase.from("scripts").update({ content, updated_at: new Date().toISOString() }).eq("id", scriptId);
      setSaveState("saved");
      setTimeout(() => setSaveState(s => s === "saved" ? "idle" : s), 3000);
    } catch { setSaveState("error"); }
  }, [scriptId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSave = useCallback(debounce(saveContent, 1500), [saveContent]);

  const saveTitle = useCallback(async (newTitle: string) => {
    const supabase = createClient();
    await supabase.from("scripts").update({ title: newTitle }).eq("id", scriptId);
    setLocalScripts(prev => prev.map(s => s.id === scriptId ? { ...s, title: newTitle } : s));
  }, [scriptId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSaveTitle = useCallback(debounce(saveTitle, 1000), [saveTitle]);

  const handleTitleChange = (v: string) => { setTitle(v); debouncedSaveTitle(v); };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      BackgroundColor,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: "Empieza a escribir o escoge una plantilla…" }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer" } }),
      Underline,
      ResizableImage.configure({ inline: false, allowBase64: false }),
    ],
    content: initialContent as string | object,
    immediatelyRender: false,
    editorProps: {
      // Handle pasting images from clipboard
      handlePaste(_view, event) {
        const imageFiles = [...(event.clipboardData?.files ?? [])].filter(f => f.type.startsWith("image/"));
        if (!imageFiles.length) return false;
        event.preventDefault();
        imageFiles.forEach(async file => {
          try {
            const url = await uploadImageFile(file);
            editorRef.current?.chain().setImage({ src: url }).run();
          } catch { /* ignore */ }
        });
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      const headings: TocItem[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "heading") {
          headings.push({ level: node.attrs.level as number, text: node.textContent, pos });
        }
      });
      setTocItems(headings);
      debouncedSave(editor.getJSON());
    },
  });

  useEffect(() => { editorRef.current = editor; }, [editor]);

  // Initial TOC
  useEffect(() => {
    if (!editor) return;
    const headings: TocItem[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "heading")
        headings.push({ level: node.attrs.level as number, text: node.textContent, pos });
    });
    setTocItems(headings);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!editor]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!editor) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        const url = window.prompt("URL del enlace:", "https://");
        if (url) editor.chain().focus().setLink({ href: url }).run();
        else editor.chain().focus().unsetLink().run();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        window.print();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: "100%", backgroundColor: "white" }}>
      <GDocsHeader title={title} onTitleChange={handleTitleChange} saveState={saveState} scriptId={scriptId} editor={editor} />
      <GDocsMenuBar editor={editor} />
      <GDocsToolbar editor={editor} zoom={zoom} onZoomChange={setZoom} />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <GDocsSidebar scripts={localScripts} currentScriptId={scriptId} tocItems={tocItems} editor={editor} />
        <GDocsDocumentArea editor={editor} zoom={zoom} />
      </div>
    </div>
  );
}
