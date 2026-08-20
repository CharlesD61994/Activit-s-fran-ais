import { describe, expect, it } from "vitest";
import { adjacentBracketPair, bracketSpacing } from "./range-mark-spacing";

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
