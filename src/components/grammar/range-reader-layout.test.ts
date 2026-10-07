import { describe, expect, it } from "vitest";
import { normalizeRangeTargets, rangeReaderStyle, sentenceRangeTargets } from "./range-reader-layout";
import { tokenizeGrammarText } from "./range-interaction-engine";
import type { Sentence } from "@/types";

describe("range reader layout", () => {
  it("never changes the horizontal text spacing", () => {
    const sentence = { originalText: "Une lumière dans la forêt", wordGroupTargets: [{ id: "outer", start: 0, end: 25 }, { id: "inner", start: 12, end: 25 }] } as Sentence;
    expect(Object.keys(rangeReaderStyle(sentence))).toEqual(["--range-mark-line-clearance", "--range-group-label-top-space"]);
  });

  it("includes future groups and functions, and deduplicates legacy targets", () => {
    const group = { id: "group", start: 0, end: 3 };
    const sentence = { wordGroupTargets: [group], grammarAnnotations: [{ ...group, kind: "group" }, { id: "function", kind: "function", start: 0, end: 3 }] } as Sentence;
    expect(sentenceRangeTargets(sentence).map((range) => range.id)).toEqual(["group", "function"]);
  });

  it("reserves vertical room for nested marks before they are revealed", () => {
    const sentence = { originalText: "Le très vieux manoir.", wordGroupTargets: [
      { id: "outer", start: 0, end: 20 }, { id: "middle", start: 5, end: 20 }, { id: "inner", start: 10, end: 20 }
    ] } as Sentence;
    expect(rangeReaderStyle(sentence)).toEqual({ "--range-mark-line-clearance": "60px", "--range-group-label-top-space": "40px" });
  });

  it("normalizes shared glyph boundaries despite selection edge spaces", () => {
    const tokens = tokenizeGrammarText("Le vieux manoir domine.", "test");
    const ranges = normalizeRangeTargets(tokens, [{ id: "outer", start: 0, end: 16 }, { id: "inner", start: 3, end: 15 }]);
    expect(ranges[0].end).toBe(ranges[1].end);
  });
});
