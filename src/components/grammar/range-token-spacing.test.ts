import { describe, expect, it } from "vitest";
import { tokenizeGrammarText } from "./range-interaction-engine";
import { normalizeRangeTargets, rangeReaderStyle, rangeTokenPadding, sentenceRangeTargets } from "./range-token-spacing";
import type { Sentence } from "@/types";

function spacing(text: string, selections: string[]) {
  const tokens = tokenizeGrammarText(text, "test");
  const ranges = selections.map((selection, index) => ({ id: String(index), start: text.indexOf(selection), end: text.indexOf(selection) + selection.length }));
  const padding = rangeTokenPadding(tokens, ranges);
  return (word: string) => padding[tokens.find((token) => token.text === word)!.id];
}

describe("reserved range space", () => {
  it("reserves both closing brackets before attirait", () => {
    const padding = spacing("Une étrange lumière dans la forêt attirait les voyageurs.", ["Une étrange lumière dans la forêt", "étrange", "dans la forêt"]);
    expect(padding("forêt").paddingInlineEnd).toBe(24);
    expect(padding("étrange")).toEqual({ paddingInlineStart: 14, paddingInlineEnd: 14 });
    expect(padding("attirait")).toBeUndefined();
  });

  it("scales with any depth at a shared boundary", () => {
    const padding = spacing("Le très vieux manoir, sombre, domine.", ["Le très vieux manoir", "très vieux manoir", "vieux manoir", "manoir"]);
    expect(padding("manoir").paddingInlineEnd).toBe(44);
  });

  it("keeps punctuation outside a bracket when there is no word space", () => {
    const padding = spacing("Une lumière, vive.", ["Une lumière"]);
    expect(padding("lumière").paddingInlineEnd).toBe(14);
  });

  it("uses visible token boundaries even with whitespace in a selection", () => {
    const padding = spacing("Le vieux manoir", [" vieux "]);
    expect(padding("vieux")).toEqual({ paddingInlineStart: 14, paddingInlineEnd: 14 });
  });

  it("includes future groups and functions, and deduplicates legacy targets", () => {
    const group = { id: "group", start: 0, end: 3 };
    const sentence = { wordGroupTargets: [group], grammarAnnotations: [{ ...group, kind: "group" }, { id: "function", kind: "function", start: 0, end: 3 }] } as Sentence;
    expect(sentenceRangeTargets(sentence).map((range) => range.id)).toEqual(["group", "function"]);
  });

  it("reserves vertical room for nested marks before they are revealed", () => {
    const sentence = { originalText: "Le très vieux manoir.", wordGroupTargets: [
      { id: "outer", start: 0, end: 20 },
      { id: "middle", start: 5, end: 20 },
      { id: "inner", start: 10, end: 20 }
    ] } as Sentence;
    expect(rangeReaderStyle(sentence)).toEqual({ "--range-mark-line-clearance": "24px" });
  });

  it("normalizes shared glyph boundaries despite selection edge spaces", () => {
    const tokens = tokenizeGrammarText("Le vieux manoir domine.", "test");
    const ranges = normalizeRangeTargets(tokens, [
      { id: "outer", start: 0, end: 16 },
      { id: "inner", start: 3, end: 15 }
    ]);
    expect(ranges[0].end).toBe(ranges[1].end);
  });
});
