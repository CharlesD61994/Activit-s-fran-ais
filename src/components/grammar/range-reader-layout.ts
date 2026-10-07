import type { Sentence } from "@/types";
import type { CSSProperties } from "react";
import { rangeMarkNesting } from "./range-mark-nesting";
import { tokenizeGrammarText } from "./range-interaction-engine";

type Token = { id: string; start: number; end: number; text: string };
type Range = { id: string; start: number; end: number };

export function rangeReaderStyle(sentence: Sentence): CSSProperties {
  const ranges = normalizeRangeTargets(tokenizeGrammarText(sentence.originalText, "range-layout"), sentenceRangeTargets(sentence));
  const inset = Math.max(0, ...ranges.map((range) => rangeMarkNesting(range, ranges).verticalInset));
  return { "--range-mark-line-clearance": `${ranges.length ? 16 + inset * 2 : 0}px` } as CSSProperties;
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
