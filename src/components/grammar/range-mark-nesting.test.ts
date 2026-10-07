import { describe, expect, it } from "vitest";
import { rangeMarkNesting } from "./range-mark-nesting";

describe("nested range brackets", () => {
  const outer = { id: "outer", start: 0, end: 30 };
  const middle = { id: "middle", start: 0, end: 20 };
  const inner = { id: "inner", start: 0, end: 10 };

  it("places outer shared boundaries outside the inner ones in any creation order", () => {
    for (const targets of [[outer, middle, inner], [inner, outer, middle], [middle, inner, outer]]) {
      expect(rangeMarkNesting(inner, targets)).toEqual({ leftDepth: 0, rightDepth: 0, verticalInset: 0 });
      expect(rangeMarkNesting(middle, targets)).toEqual({ leftDepth: 1, rightDepth: 0, verticalInset: 6 });
      expect(rangeMarkNesting(outer, targets)).toEqual({ leftDepth: 2, rightDepth: 0, verticalInset: 12 });
    }
  });

  it("separates shared closing brackets in the same inside-to-outside order", () => {
    const child = { id: "child", start: 10, end: 30 };
    expect(rangeMarkNesting(outer, [outer, child])).toMatchObject({ rightDepth: 1, verticalInset: 6 });
    expect(rangeMarkNesting(child, [outer, child])).toMatchObject({ rightDepth: 0, verticalInset: 0 });
  });

  it("uses taller outer brackets even when neither boundary is shared", () => {
    const child = { id: "child", start: 10, end: 20 };
    expect(rangeMarkNesting(outer, [outer, child])).toEqual({ leftDepth: 0, rightDepth: 0, verticalInset: 6 });
  });

  it("keeps adjacent and crossing groups at the normal height", () => {
    expect(rangeMarkNesting(inner, [inner, { id: "next", start: 10, end: 20 }]).verticalInset).toBe(0);
    expect(rangeMarkNesting(inner, [inner, { id: "crossing", start: 5, end: 20 }]).verticalInset).toBe(0);
  });
});
