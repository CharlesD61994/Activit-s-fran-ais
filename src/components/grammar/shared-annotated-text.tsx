"use client";

import type { ReactNode } from "react";

export type SharedTextRange = { start: number; end: number };
export type SharedTextMark = SharedTextRange & { id?: string; color?: string | null; backgroundColor?: string; underlineColor?: string; framed?: boolean; bold?: boolean; fontScale?: number };

export function rebaseSharedTextRange(previousText: string, nextText: string, start: number, end: number): SharedTextRange {
  if (previousText === nextText) return { start, end };
  let prefix = 0;
  while (prefix < previousText.length && prefix < nextText.length && previousText[prefix] === nextText[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < previousText.length - prefix && suffix < nextText.length - prefix && previousText[previousText.length - 1 - suffix] === nextText[nextText.length - 1 - suffix]) suffix += 1;
  const previousChangeEnd = previousText.length - suffix;
  const nextChangeEnd = nextText.length - suffix;
  const delta = nextText.length - previousText.length;
  const mapIndex = (index: number) => index <= prefix ? index : index >= previousChangeEnd ? index + delta : nextChangeEnd;
  return { start: mapIndex(start), end: mapIndex(end) };
}

export function captureSharedTextSelection(element: HTMLElement): SharedTextRange | null {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (!element.contains(range.startContainer) || !element.contains(range.endContainer)) return null;
  const beforeStart = range.cloneRange();
  beforeStart.selectNodeContents(element);
  beforeStart.setEnd(range.startContainer, range.startOffset);
  const beforeEnd = range.cloneRange();
  beforeEnd.selectNodeContents(element);
  beforeEnd.setEnd(range.endContainer, range.endOffset);
  return { start: beforeStart.toString().length, end: beforeEnd.toString().length };
}

export function groupSharedTextMarks(text: string, marks: SharedTextMark[]) {
  const boundaries = Array.from(new Set([0, text.length, ...marks.flatMap((mark) => [mark.start, mark.end])])).sort((a, b) => a - b);
  const segments = boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1];
    const active = marks.filter((mark) => mark.start <= start && mark.end >= end);
    return {
      start,
      end,
      text: text.slice(start, end),
      color: [...active].reverse().find((mark) => mark.color !== undefined)?.color ?? undefined,
      backgroundColor: [...active].reverse().find((mark) => mark.backgroundColor !== undefined)?.backgroundColor,
      underlineColor: [...active].reverse().find((mark) => mark.underlineColor !== undefined)?.underlineColor,
      framed: active.some((mark) => mark.framed === true),
      bold: active.some((mark) => mark.bold === true),
      fontScale: [...active].reverse().find((mark) => mark.fontScale !== undefined)?.fontScale
    };
  });
  return segments.reduce<Array<{ framed: boolean; segments: typeof segments }>>((result, segment) => {
    const group = result[result.length - 1];
    if (group && group.framed === segment.framed) group.segments.push(segment);
    else result.push({ framed: segment.framed, segments: [segment] });
    return result;
  }, []);
}

export function renderSharedAnnotatedText(text: string, marks: SharedTextMark[], framedClassName: string): ReactNode {
  const groups = groupSharedTextMarks(text, marks);
  return groups.map((group, groupIndex) => (
    <span key={`${groupIndex}-${group.segments[0]?.start ?? 0}`} className={group.framed ? framedClassName : undefined}>
      {group.segments.map((segment) => <span key={`${segment.start}-${segment.end}`} style={{ color: segment.color ?? undefined, backgroundColor: segment.backgroundColor, fontWeight: segment.bold ? 700 : undefined, fontSize: segment.fontScale ? `${segment.fontScale}em` : undefined, textDecoration: segment.underlineColor ? "underline" : undefined, textDecorationColor: segment.underlineColor }}>{segment.text}</span>)}
    </span>
  ));
}
