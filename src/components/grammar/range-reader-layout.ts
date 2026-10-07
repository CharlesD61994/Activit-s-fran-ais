import type { Sentence } from "@/types";
import type { CSSProperties } from "react";
import { rangeMarkNesting } from "./range-mark-nesting";
import { tokenizeGrammarText } from "./range-interaction-engine";
import { isPrincipalGroup } from "./group-label-layout";

type Token = { id: string; start: number; end: number; text: string };
type Range = { id: string; start: number; end: number };

export function rangeReaderStyle(sentence: Sentence): CSSProperties {
  const ranges = normalizeRangeTargets(tokenizeGrammarText(sentence.originalText, "range-layout"), sentenceRangeTargets(sentence));
  const inset = Math.max(0, ...ranges.map((range) => rangeMarkNesting(range, ranges).verticalInset));
  const groupIds = new Set([
    ...(sentence.wordGroupTargets ?? []).map((group) => group.id),
    ...(sentence.grammarAnnotations ?? []).filter((annotation) => annotation.kind === "group").map((group) => group.id)
  ]);
  const groups = ranges.filter((range) => groupIds.has(range.id));
  const principal = groups.some((group) => isPrincipalGroup(group, groups));
  return {
    "--range-mark-line-clearance": `${Math.max(ranges.length ? 16 + inset * 2 : 0, principal ? 60 : 0)}px`,
    "--range-group-label-top-space": principal ? "40px" : "0px"
  } as CSSProperties;
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
