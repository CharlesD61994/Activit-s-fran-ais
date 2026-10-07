import { describe, expect, it } from "vitest";
import { verticalBracketGeometry } from "./range-mark-spacing";

describe("vertically centered brackets", () => {
  it("centers the minimum-height bracket around short letters", () => {
    const mark = verticalBracketGeometry(50, 20, 40, 45, 0, false);
    expect(mark.height).toBe(34);
    expect(mark.top + mark.height / 2).toBe(60);
  });

  it("centers nested separated corners while leaving the entire line band clear", () => {
    const mark = verticalBracketGeometry(60, 30, 40, 55, 12, true);
    expect(mark.top + mark.height / 2).toBe(75);
    expect(mark.top + mark.upperStemEnd).toBe(38);
    expect(mark.top + mark.lowerStemStart).toBe(97);
  });
});
