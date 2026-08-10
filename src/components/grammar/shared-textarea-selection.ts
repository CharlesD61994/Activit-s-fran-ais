export type TextareaSelection = { start: number; end: number; text: string };

export function readTextareaSelection(element: HTMLTextAreaElement, source: string): TextareaSelection | null {
  const rawStart = element.selectionStart;
  const rawEnd = element.selectionEnd;
  const rawText = source.slice(rawStart, rawEnd);
  const leadingWhitespace = rawText.match(/^\s*/u)?.[0].length ?? 0;
  const trailingWhitespace = rawText.match(/\s*$/u)?.[0].length ?? 0;
  const start = rawStart + leadingWhitespace;
  const end = rawEnd - trailingWhitespace;
  return end > start ? { start, end, text: source.slice(start, end) } : null;
}

export function rangesOverlap(start: number, end: number, ranges: Array<{ start: number; end: number }>) {
  return ranges.some((range) => start < range.end && end > range.start);
}
