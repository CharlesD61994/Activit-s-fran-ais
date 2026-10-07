import { describe, expect, it } from "vitest";
import { adjacentBracketPair, areRangeMarksAdjacent, boundedBracketSpacing, bracketSpacing } from "./range-mark-spacing";

describe("range adjacency", () => {
  const text = "Le vieux manoir abandonné domine la vallée.";
  const range = (word: string) => ({ start: text.indexOf(word), end: text.indexOf(word) + word.length });

  it("does not pair the adjective brackets across manoir", () => {
    expect(areRangeMarksAdjacent(text, range("vieux"), range("abandonné"))).toBe(false);
  });

  it("pairs boundaries only across the space between consecutive words", () => {
    expect(areRangeMarksAdjacent(text, range("vieux"), range("manoir"))).toBe(true);
    expect(areRangeMarksAdjacent("a\u00a0b", { end: 1 }, { start: 2 })).toBe(true);
  });

  it("does not pair nested or overlapping groups", () => {
    expect(areRangeMarksAdjacent(text, { end: range("abandonné").end }, range("vieux"))).toBe(false);
  });
});

describe("shared boundary spacing", () => {
  it("keeps both closing brackets between abandonné and domine", () => {
    const gap = 12.21875;
    const spacing = boundedBracketSpacing(gap, 2);
    expect((spacing.cap + spacing.gap) * 2).toBeLessThan(gap);
    expect(spacing.cap).toBeGreaterThan(3);
    expect(spacing.gap).toBeGreaterThan(1);
  });

  it("fits three nested marks without reaching the following word", () => {
    const spacing = boundedBracketSpacing(18, 3);
    expect((spacing.cap + spacing.gap) * 3).toBeLessThan(18);
  });
});

describe("bracketSpacing", () => {
  it("keeps the normal gap when boundaries have enough room", () => {
    expect(bracketSpacing(30)).toEqual({ cap: 6, gap: 4 });
  });

  it("keeps visible bracket arms instead of reducing adjacent marks to lines", () => {
    const spacing = bracketSpacing(18);
    expect(spacing.cap).toBe(5);
    expect(spacing.gap).toBe(2);
    expect((spacing.cap + spacing.gap) * 2).toBeLessThanOrEqual(18);
  });

  it("always leaves a gap between a bracket and its word", () => {
    expect(bracketSpacing(10).gap).toBeGreaterThanOrEqual(1);
  });

  it("keeps a visible separation between neighboring brackets", () => {
    const availableSpace = 18;
    const spacing = bracketSpacing(availableSpace);
    const usedByBrackets = (spacing.cap + spacing.gap) * 2;
    expect(availableSpace - usedByBrackets).toBeGreaterThanOrEqual(4);
  });
});

describe("adjacentBracketPair", () => {
  it("always gives adjacent brackets two distinct vertical strokes", () => {
    const pair = adjacentBracketPair(100, 118);
    const rightStroke = pair.rightBracketLeft + pair.cap;
    const leftStroke = pair.leftBracketLeft;
    expect(leftStroke - rightStroke).toBeGreaterThanOrEqual(4);
  });

  it("keeps visible arms even when the word space is narrow", () => {
    expect(adjacentBracketPair(100, 110).cap).toBeGreaterThanOrEqual(3);
  });
});
