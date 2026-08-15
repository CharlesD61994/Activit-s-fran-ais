import { describe, expect, it } from "vitest";
import {
  bracketReserve,
  bracketSpacing,
  bracketTokenMargins
} from "./range-mark-spacing";

describe("bracketSpacing", () => {
  it("keeps the normal gap when boundaries have enough room", () => {
    expect(bracketSpacing(30)).toEqual({ cap: 6, gap: 4 });
  });

  it("shrinks both brackets instead of merging adjacent boundaries", () => {
    const spacing = bracketSpacing(18);
    expect(spacing.cap).toBe(4);
    expect(spacing.gap).toBe(2);
    expect((spacing.cap + spacing.gap) * 2 + 6).toBeLessThanOrEqual(18);
  });

  it("always leaves a gap between a bracket and its word", () => {
    expect(bracketSpacing(10).gap).toBeGreaterThanOrEqual(1);
  });

  it("reserves layout space for every boundary before marks appear", () => {
    expect(bracketReserve(1)).toBe(10);
    expect(bracketReserve(2)).toBe(20);
  });

  it("shares the same token gutter between group and function readers", () => {
    const targets = [
      { start: 0, end: 8 },
      { start: 9, end: 20 }
    ];

    expect(bracketTokenMargins({ start: 0, end: 8 }, targets)).toEqual({
      marginLeft: 10,
      marginRight: 10
    });
    expect(bracketTokenMargins({ start: 9, end: 12 }, targets)).toEqual({
      marginLeft: 10,
      marginRight: 0
    });
  });
});
