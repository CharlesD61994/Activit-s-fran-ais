import { describe, expect, it } from "vitest";
import { worksheetScoreFontSize, worksheetScoreLineWidth } from "./worksheet-scores";

const score = { id: "score", x: 100, y: 100, total: 10, width: 120, height: 42 };
describe("worksheet score appearance", () => {
  it("keeps legacy boxes sized automatically", () => {
    expect(worksheetScoreFontSize(score)).toBeCloseTo(120 / 7);
    expect(worksheetScoreLineWidth(score)).toBeCloseTo(120 / 7 * 1.5);
  });
  it("keeps explicit font and line lengths independent of resizing and totals", () => {
    const custom = { ...score, fontSize: 24, answerLineWidth: 45 };
    expect(worksheetScoreFontSize({ ...custom, height: 90, total: 100 })).toBe(24);
    expect(worksheetScoreLineWidth({ ...custom, width: 200, fontSize: 36 })).toBe(45);
  });
});
