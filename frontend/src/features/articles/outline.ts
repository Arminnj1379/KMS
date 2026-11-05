export interface OutlineItem {
  level: 2 | 3;
  text: string;
}

interface TipTapNode {
  type?: string;
  text?: string;
  attrs?: { level?: unknown };
  content?: unknown[];
}

function textOf(node: TipTapNode): string {
  if (typeof node.text === 'string') return node.text;
  return (node.content ?? []).map((child) => textOf(child as TipTapNode)).join('');
}

/**
 * Level-2/3 headings of a Tiptap document, in reading order. Empty headings are
 * kept so that the index matches the rendered `h2, h3` elements one-to-one.
 */
export function headingOutline(doc: Record<string, unknown>): OutlineItem[] {
  const items: OutlineItem[] = [];
  const walk = (node: TipTapNode): void => {
    if (node.type === 'heading' && (node.attrs?.level === 2 || node.attrs?.level === 3)) {
      items.push({ level: node.attrs.level, text: textOf(node).trim() });
      return;
    }
    for (const child of node.content ?? []) walk(child as TipTapNode);
  };
  walk(doc as TipTapNode);
  return items;
}
