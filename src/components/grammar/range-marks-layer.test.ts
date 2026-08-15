import { describe, expect, it } from "vitest";
import { bracketSpacing } from "./range-mark-spacing";

describe("bracketSpacing", () => {
  it("keeps the normal gap when boundaries have enough room", () => {
    expect(bracketSpacing(30)).toEqual({ cap: 6, gap: 4 });
  });

  it("shrinks both brackets instead of merging adjacent boundaries", () => {
    const spacing = bracketSpacing(18);
    expect(spacing.cap).toBeCloseTo(4.875);
    expect(spacing.gap).toBeCloseTo(1.625);
    expect((spacing.cap + spacing.gap) * 2 + 5).toBeLessThanOrEqual(18);
  });

  it("always leaves a gap between a bracket and its word", () => {
    expect(bracketSpacing(10).gap).toBeGreaterThanOrEqual(1);
  });

  it("keeps a visible separation between neighboring brackets", () => {
    const availableSpace = 18;
    const spacing = bracketSpacing(availableSpace);
    const usedByBrackets = (spacing.cap + spacing.gap) * 2;
    expect(availableSpace - usedByBrackets).toBeGreaterThanOrEqual(5);
  });
});
