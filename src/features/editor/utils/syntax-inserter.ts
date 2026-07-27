export type Selection = { start: number; end: number };
export type InsertResult = { text: string; selection: Selection };

export type InsertOptions = { prefix: string; suffix?: string; placeholder?: string };

export function insertAtSelection(text: string, selection: Selection, options: InsertOptions): InsertResult {
  const { start, end } = selection;
  const before = text.slice(0, start);
  const selected = text.slice(start, end);
  const after = text.slice(end);
  const suffix = options.suffix ?? '';
  const body = selected || options.placeholder || '';
  const newText = `${before}${options.prefix}${body}${suffix}${after}`;
  const cursor = selected
    ? start + options.prefix.length + body.length + suffix.length
    : start + options.prefix.length + body.length;
  return { text: newText, selection: { start: cursor, end: cursor } };
}

export function insertLinePrefix(text: string, cursor: number, prefix: string): InsertResult {
  const lineStart = text.lastIndexOf('\n', cursor - 1) + 1;
  const newText = `${text.slice(0, lineStart)}${prefix}${text.slice(lineStart)}`;
  const newCursor = cursor + prefix.length;
  return { text: newText, selection: { start: newCursor, end: newCursor } };
}

export const TABLE_TEMPLATE = '| Coluna 1 | Coluna 2 |\n| --- | --- |\n| Valor | Valor |\n';
