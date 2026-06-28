type TextMark = { type: string };
type TiptapTextNode = { type: "text"; text: string; marks?: TextMark[] };
type TiptapNode = TiptapTextNode | {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
};

export function markdownToTiptap(markdown: string): { type: "doc"; content: TiptapNode[] } {
  const lines = markdown.split("\n");
  const nodes: TiptapNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headings
    const hMatch = line.match(/^(#{1,3})\s+(.*)/);
    if (hMatch) {
      const level = hMatch[1].length;
      const content = parseInline(hMatch[2]);
      nodes.push({ type: "heading", attrs: { level }, content: content.length ? content : [{ type: "text", text: hMatch[2] }] });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      nodes.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    // Bullet list
    if (/^[-*]\s+/.test(line)) {
      const items: TiptapNode[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        const text = lines[i].replace(/^[-*]\s+/, "");
        items.push({ type: "listItem", content: [{ type: "paragraph", content: parseInline(text) }] });
        i++;
      }
      nodes.push({ type: "bulletList", content: items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: TiptapNode[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        const text = lines[i].replace(/^\d+\.\s+/, "");
        items.push({ type: "listItem", content: [{ type: "paragraph", content: parseInline(text) }] });
        i++;
      }
      nodes.push({ type: "orderedList", attrs: { start: 1 }, content: items });
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      nodes.push({ type: "blockquote", content: [{ type: "paragraph", content: parseInline(quoteLines.join(" ")) }] });
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Regular paragraph (collect consecutive non-special lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,3}\s|[-*]\s|\d+\.\s|---+$|>\s)/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }

    if (paraLines.length > 0) {
      nodes.push({ type: "paragraph", content: parseInline(paraLines.join(" ")) });
    }
  }

  return { type: "doc", content: nodes.length > 0 ? nodes : [{ type: "paragraph", content: [] }] };
}

function parseInline(text: string): TiptapTextNode[] {
  const tokens: TiptapTextNode[] = [];
  let remaining = text;

  const patterns: { regex: RegExp; mark: string }[] = [
    { regex: /\*\*(.+?)\*\*/, mark: "bold" },
    { regex: /__(.+?)__/, mark: "bold" },
    { regex: /\*(.+?)\*/, mark: "italic" },
    { regex: /_(.+?)_/, mark: "italic" },
    { regex: /`(.+?)`/, mark: "code" },
  ];

  while (remaining.length > 0) {
    let earliest: { index: number; fullLen: number; text: string; mark: string } | null = null;

    for (const { regex, mark } of patterns) {
      const match = remaining.match(regex);
      if (match && match.index !== undefined) {
        if (!earliest || match.index < earliest.index) {
          earliest = { index: match.index, fullLen: match[0].length, text: match[1], mark };
        }
      }
    }

    if (!earliest) {
      if (remaining) tokens.push({ type: "text", text: remaining });
      break;
    }

    if (earliest.index > 0) {
      tokens.push({ type: "text", text: remaining.slice(0, earliest.index) });
    }
    tokens.push({ type: "text", text: earliest.text, marks: [{ type: earliest.mark }] });
    remaining = remaining.slice(earliest.index + earliest.fullLen);
  }

  return tokens.filter(t => t.text !== "");
}
