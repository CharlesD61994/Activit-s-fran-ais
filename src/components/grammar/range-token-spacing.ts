import type { Sentence } from "@/types";
import type { CSSProperties } from "react";
import { rangeMarkNesting } from "./range-mark-nesting";
import { tokenizeGrammarText } from "./range-interaction-engine";

type Token = { id: string; start: number; end: number; text: string };
type Range = { id: string; start: number; end: number };
export type RangeTokenPadding = { paddingInlineStart: number; paddingInlineEnd: number };

export function rangeReaderStyle(sentence: Sentence): CSSProperties {
  const ranges = normalizeRangeTargets(tokenizeGrammarText(sentence.originalText, "range-layout"), sentenceRangeTargets(sentence));
  const inset = Math.max(0, ...ranges.map((range) => rangeMarkNesting(range, ranges).verticalInset));
  return { "--range-mark-line-clearance": `${inset * 2}px` } as CSSProperties;
}

/** Geometry follows the visible tokens, including selections with edge spaces. */
export function normalizeRangeTargets(tokens: Token[], ranges: Range[]): Range[] {
  return ranges.map((range) => {
    const covered = tokens.filter((token) => token.text.trim() && token.start < range.end && token.end > range.start);
    return covered.length ? {
      id: range.id,
      start: covered[0].start,
      end: covered[covered.length - 1].end
    } : range;
  });
}

/** Include future phases so revealing an annotation never moves the text. */
export function sentenceRangeTargets(sentence: Sentence): Range[] {
  const ranges = [
    ...(sentence.wordGroupTargets ?? []),
    ...(sentence.grammarAnnotations ?? []).filter((annotation) =>
      annotation.kind === "group" || annotation.kind === "function" ||
      annotation.visualEffect?.kind === "brackets" || annotation.visualEffect?.kind === "frame"
    )
  ];
  return [...new Map(ranges.map((range) => [range.id, range])).values()];
}

/** Reserve space outside the measured glyph spans, even next to punctuation. */
export function rangeTokenPadding(tokens: Token[], ranges: Range[]): Record<string, RangeTokenPadding> {
  const counts = new Map<string, { start: number; end: number }>();
  for (const range of ranges) {
    const covered = tokens.filter((token) => token.text.trim() && token.start < range.end && token.end > range.start);
    if (!covered.length) continue;
    const first = covered[0];
    const last = covered[covered.length - 1];
    if (!counts.has(first.id)) counts.set(first.id, { start: 0, end: 0 });
    if (!counts.has(last.id)) counts.set(last.id, { start: 0, end: 0 });
    counts.get(first.id)!.start += 1;
    counts.get(last.id)!.end += 1;
  }
  // Each bracket needs a 6px arm and a 4px gap; keep another 4px clear of
  // neighbouring glyphs. The allocation depends on all targets, not answers.
  const reserve = (count: number) => count ? count * 10 + 4 : 0;
  return Object.fromEntries([...counts].map(([id, count]) => [id, {
    paddingInlineStart: reserve(count.start),
    paddingInlineEnd: reserve(count.end)
  }]));
}
