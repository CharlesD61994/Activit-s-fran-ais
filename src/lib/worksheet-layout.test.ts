import { describe, expect, it } from "vitest";
import { boundedWorksheetDelta, DEFAULT_WORKSHEET_LINE_SPACING, snapWorksheetBox, worksheetAnswerLineHeight, worksheetPasteDelta, worksheetPointFromClient, worksheetSpacingFromMm, worksheetSpacingInMm } from "./worksheet-layout";

describe("worksheet portrait layout", () => {
  it("spaces new answer rules by 9 mm on a full-size Letter page", () => {
    expect(worksheetSpacingInMm(DEFAULT_WORKSHEET_LINE_SPACING)).toBeCloseTo(9);
    const spacingInPixels = parseFloat(worksheetAnswerLineHeight(DEFAULT_WORKSHEET_LINE_SPACING)) / 100 * (8.5 * 96);
    expect(spacingInPixels / 96 * 25.4).toBeCloseTo(9);
    expect(worksheetSpacingFromMm(worksheetSpacingInMm(20))).toBeCloseTo(20);
  });
  it("converts the mouse position using the current page size and scroll position", () => {
    expect(worksheetPointFromClient({ left: 100, top: -200, width: 528, height: 684 }, 364, 142)).toEqual({ x: 528, y: 408 });
    expect(worksheetPointFromClient({ left: 100, top: -200, width: 528, height: 684 }, 50, 142)).toBeNull();
    expect(worksheetPointFromClient({ left: 0, top: 0, width: 0, height: 0 }, 0, 0)).toBeNull();
  });
  it("pastes a group with its top-left corner at the mouse and preserves its offsets", () => {
    const items = [{ x: 200, y: 100, width: 100, height: 40 }, { x: 10, y: 20, width: 100, height: 40 }];
    const delta = worksheetPasteDelta(items, { x: 300, y: 200 });
    expect(delta).toEqual({ dx: 290, dy: 180 });
    expect(items.map((item) => ({ x: item.x + delta.dx, y: item.y + delta.dy }))).toEqual([{ x: 490, y: 280 }, { x: 300, y: 200 }]);
  });
  it("keeps the entire pasted group inside the page near the mouse", () => {
    expect(worksheetPasteDelta([{ x: 200, y: 100, width: 120, height: 42 }], { x: 1050, y: 810 })).toEqual({ dx: 736, dy: 674 });
    expect(worksheetPasteDelta([], { x: 100, y: 100 })).toEqual({ dx: 0, dy: 0 });
  });
  it("aligns a score box with another box's edges and center", () => {
    const target = { x: 500, y: 100, width: 120, height: 42 };
    const result = snapWorksheetBox({ x: 503, y: 104, width: 120, height: 42 }, [target], [], []);
    expect(result).toEqual({ x: 500, y: 100, guides: { x: 500, y: 100 } });
    const centered = snapWorksheetBox({ x: 528, y: 200, width: 60, height: 28 }, [target], [], []);
    expect(centered.x).toBe(530);
    expect(centered.guides.x).toBe(560);
  });
  it("snaps to page margins and response rules only within the tolerance", () => {
    const box = { x: 124, y: 203, width: 120, height: 42 };
    expect(snapWorksheetBox(box, [{ x: 0, y: 200, width: 1056, height: 0 }], [121], []).guides).toEqual({ x: 121, y: 200 });
    expect(snapWorksheetBox({ ...box, x: 140, y: 220 }, [], [121], [200])).toEqual({ x: 140, y: 220, guides: { x: undefined, y: undefined } });
  });
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
