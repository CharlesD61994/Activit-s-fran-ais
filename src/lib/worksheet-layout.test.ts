import { describe, expect, it } from "vitest";
import { boundedWorksheetDelta, worksheetAnswerLineHeight } from "./worksheet-layout";

describe("worksheet portrait layout", () => {
  it("uses the same physical spacing for answer text and rules", () => {
    const pageWidth = 816;
    const pageHeight = pageWidth * 11 / 8.5;
    const lineHeight = parseFloat(worksheetAnswerLineHeight(20)) / 100 * pageWidth;
    expect(lineHeight).toBeCloseTo(20 / 816 * pageHeight);
  });
  it("moves a selection by one shared delta at page edges", () => {
    const items = [{ x: 10, y: 20, width: 100, height: 40 }, { x: 200, y: 100, width: 100, height: 40 }];
    expect(boundedWorksheetDelta(items, -50, -50)).toEqual({ dx: -10, dy: -20 });
    expect(boundedWorksheetDelta(items, 1000, 1000)).toEqual({ dx: 756, dy: 676 });
    expect(boundedWorksheetDelta(items, 1, 0)).toEqual({ dx: 1, dy: 0 });
  });
});
