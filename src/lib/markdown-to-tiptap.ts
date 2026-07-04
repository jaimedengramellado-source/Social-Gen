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
  let pendingGap = false;

  // El editor de documentos pinta los párrafos sin margen (estilo Google Docs), así que
  // una línea en blanco del markdown debe convertirse en un párrafo vacío para que el
  // espaciado del original no se pierda. Los headings, hr y tablas ya traen margen propio
  // en CSS — meter un párrafo vacío junto a ellos duplicaría el hueco.
  const hasOwnSpacing = (node: TiptapNode | undefined) =>
    !!node && ["heading", "horizontalRule", "table"].includes(node.type);

  const pushBlock = (node: TiptapNode) => {
    if (pendingGap && !hasOwnSpacing(nodes[nodes.length - 1]) && !hasOwnSpacing(node)) {
      nodes.push({ type: "paragraph", content: [] });
    }
    pendingGap = false;
    nodes.push(node);
  };

  while (i < lines.length) {
    const line = lines[i];

    // Headings
    const hMatch = line.match(/^(#{1,3})\s+(.*)/);
    if (hMatch) {
      const level = hMatch[1].length;
      const content = parseInline(hMatch[2]);
      pushBlock({ type: "heading", attrs: { level }, content: content.length ? content : [{ type: "text", text: hMatch[2] }] });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      pushBlock({ type: "horizontalRule" });
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
      pushBlock({ type: "bulletList", content: items });
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
      pushBlock({ type: "orderedList", attrs: { start: 1 }, content: items });
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      pushBlock({ type: "blockquote", content: [{ type: "paragraph", content: parseInline(quoteLines.join(" ")) }] });
      continue;
    }

    // GFM table: header row + separator row (|---|---|) + body rows
    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headerCells = splitTableRow(line);
      i += 2;
      const bodyRows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        bodyRows.push(splitTableRow(lines[i]));
        i++;
      }
      const colCount = headerCells.length;
      const toCellNodes = (cells: string[], type: "tableHeader" | "tableCell"): TiptapNode[] =>
        Array.from({ length: colCount }, (_, col) => ({
          type,
          content: [{ type: "paragraph", content: parseInline(cells[col] ?? "") }],
        }));
      pushBlock({
        type: "table",
        content: [
          { type: "tableRow", content: toCellNodes(headerCells, "tableHeader") },
          ...bodyRows.map(cells => ({ type: "tableRow", content: toCellNodes(cells, "tableCell") })),
        ],
      });
      continue;
    }

    // Empty line — marks a paragraph break in the source that should stay visible
    if (line.trim() === "") {
      if (nodes.length > 0) pendingGap = true;
      i++;
      continue;
    }

    // Regular paragraph (collect consecutive non-special lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,3}\s|[-*]\s|\d+\.\s|---+$|>\s)/.test(lines[i]) &&
      !(isTableRow(lines[i]) && isTableSeparator(lines[i + 1] ?? ""))
    ) {
      paraLines.push(lines[i]);
      i++;
    }

    if (paraLines.length > 0) {
      const content: TiptapNode[] = [];
      paraLines.forEach((paraLine, idx) => {
        if (idx > 0) content.push({ type: "hardBreak" });
        content.push(...parseInline(paraLine));
      });
      pushBlock({ type: "paragraph", content });
    }
  }

  return { type: "doc", content: nodes.length > 0 ? nodes : [{ type: "paragraph", content: [] }] };
}

function isTableRow(line: string): boolean {
  return /\|/.test(line) && line.trim() !== "";
}

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim().replace(/^\||\|$/g, "");
  if (!trimmed) return false;
  return trimmed.split("|").every(cell => /^:?-+:?$/.test(cell.trim()));
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\||\|$/g, "");
  const cells: string[] = [];
  let current = "";
  for (let idx = 0; idx < trimmed.length; idx++) {
    const ch = trimmed[idx];
    if (ch === "\\" && trimmed[idx + 1] === "|") {
      current += "|";
      idx++;
      continue;
    }
    if (ch === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
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
