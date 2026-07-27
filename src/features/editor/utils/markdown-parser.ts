export type Block =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'quote'; text: string }
  | { type: 'checklist'; text: string; checked: boolean }
  | { type: 'bullet'; text: string }
  | { type: 'numbered'; text: string; index: number }
  | { type: 'code'; lines: string[] }
  | { type: 'table'; rows: string[][] }
  | { type: 'hr' }
  | { type: 'image'; alt: string; url: string }
  | { type: 'paragraph'; text: string }
  | { type: 'blank' };

export function parseMarkdown(content: string): Block[] {
  const lines = content.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push({ type: 'code', lines: codeLines });
      continue;
    }

    if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        const cells = lines[i]
          .trim()
          .slice(1, -1)
          .split('|')
          .map((cell) => cell.trim());
        rows.push(cells);
        i += 1;
      }
      const filtered = rows.filter((row) => !row.every((cell) => /^:?-+:?$/.test(cell)));
      blocks.push({ type: 'table', rows: filtered });
      continue;
    }

    // Imagem sozinha na linha vira bloco; dentro de texto continua sendo inline.
    const imageMatch = line.match(/^\s*!\[([^\]]*)\]\(([^)\s]+)\)\s*$/);
    if (imageMatch) {
      blocks.push({ type: 'image', alt: imageMatch[1], url: imageMatch[2] });
      i += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length as 1 | 2 | 3, text: headingMatch[2] });
      i += 1;
      continue;
    }

    const checklistMatch = line.match(/^\s*[-*+]\s+\[( |x|X)\]\s+(.*)$/);
    if (checklistMatch) {
      blocks.push({ type: 'checklist', checked: checklistMatch[1].toLowerCase() === 'x', text: checklistMatch[2] });
      i += 1;
      continue;
    }

    const bulletMatch = line.match(/^\s*[-*+]\s+(.*)$/);
    if (bulletMatch) {
      blocks.push({ type: 'bullet', text: bulletMatch[1] });
      i += 1;
      continue;
    }

    const numberedMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);
    if (numberedMatch) {
      blocks.push({ type: 'numbered', index: Number(numberedMatch[1]), text: numberedMatch[2] });
      i += 1;
      continue;
    }

    const quoteMatch = line.match(/^\s*>\s?(.*)$/);
    if (quoteMatch) {
      blocks.push({ type: 'quote', text: quoteMatch[1] });
      i += 1;
      continue;
    }

    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    if (line.trim() === '') {
      blocks.push({ type: 'blank' });
      i += 1;
      continue;
    }

    blocks.push({ type: 'paragraph', text: line });
    i += 1;
  }

  return blocks;
}

export type InlineToken =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'code'; text: string }
  | { type: 'link'; text: string; href: string };

const INLINE_PATTERN = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))|(\*[^*]+\*)|(_[^_]+_)/g;

export function tokenizeInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(INLINE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      tokens.push({ type: 'text', text: text.slice(lastIndex, index) });
    }
    const raw = match[0];
    if (raw.startsWith('`')) {
      tokens.push({ type: 'code', text: raw.slice(1, -1) });
    } else if (raw.startsWith('**')) {
      tokens.push({ type: 'bold', text: raw.slice(2, -2) });
    } else if (raw.startsWith('[')) {
      const linkMatch = raw.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      tokens.push({ type: 'link', text: linkMatch?.[1] ?? raw, href: linkMatch?.[2] ?? '' });
    } else if (raw.startsWith('*') || raw.startsWith('_')) {
      tokens.push({ type: 'italic', text: raw.slice(1, -1) });
    }
    lastIndex = index + raw.length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: 'text', text: text.slice(lastIndex) });
  }

  return tokens;
}
