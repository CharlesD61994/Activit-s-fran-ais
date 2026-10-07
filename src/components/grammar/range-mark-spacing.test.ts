import { describe, expect, it } from "vitest";
import { verticalBracketGeometry } from "./range-mark-spacing";

describe("vertically centered brackets", () => {
  it("centers the minimum-height bracket around short letters", () => {
    const mark = verticalBracketGeometry(50, 20, 0);
    expect(mark.height).toBe(34);
    expect(mark.top + mark.height / 2).toBe(60);
  });

  it("centers nested separated corners while leaving the visible letters clear", () => {
    const mark = verticalBracketGeometry(60, 30, 12);
    expect(mark.top + mark.height / 2).toBe(75);
    expect(mark.top + mark.upperStemEnd).toBe(58);
    expect(mark.top + mark.lowerStemStart).toBe(92);
  });
});
