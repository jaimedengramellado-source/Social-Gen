"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle, Color } from "@tiptap/extension-text-style";
import { useEffect } from "react";

export type { Editor };

function isHTML(str: string) {
  return /<[a-z][\s\S]*>/i.test(str);
}

function toHTML(content: string) {
  if (!content) return "";
  if (isHTML(content)) return content;
  return content
    .split(/\n\n+/)
    .map(para => `<p>${para.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  onFocusEditor?: (editor: Editor) => void;
}

export function RichTextEditor({
  content, onChange, placeholder, className = "", onFocusEditor,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false, code: false }),
      Underline,
      TextStyle,
      Color,
      Placeholder.configure({ placeholder: placeholder ?? "Escribe aquí…" }),
    ],
    content: toHTML(content),
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    onFocus: ({ editor }) => onFocusEditor?.(editor),
    editorProps: {
      attributes: {
        class: `rich-editor focus:outline-none min-h-[60px] leading-relaxed ${className}`,
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;
    const newHTML = toHTML(content);
    if (editor.getHTML() !== newHTML) editor.commands.setContent(newHTML, { emitUpdate: false });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  if (!editor) return null;
  return <EditorContent editor={editor} />;
}
