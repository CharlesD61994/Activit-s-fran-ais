import { describe, expect, it } from "vitest";
import {
  buildRangeSegments,
  fitRectToGlyphHeight,
  isMeasurableRangeToken
} from "./use-range-target-positions";

describe("isMeasurableRangeToken", () => {
  it("measures punctuation so a closing bracket is placed after it", () => {
    expect(isMeasurableRangeToken({ id: "period", text: ".", start: 6, end: 7, isWord: false })).toBe(true);
  });

  it("does not use whitespace as a bracket boundary", () => {
    expect(isMeasurableRangeToken({ id: "space", text: " ", start: 6, end: 7, isWord: false })).toBe(false);
  });
});

describe("fitRectToGlyphHeight", () => {
  it("keeps line spacing outside the visual frame", () => {
    expect(
      fitRectToGlyphHeight(
        { left: 0, right: 100, top: 20, bottom: 100, height: 80 },
        50
      )
    ).toEqual({
      left: 0,
      right: 100,
      top: 33,
      bottom: 87,
      height: 54
    });
  });

  it("conserve les coordonnées non énumérables d'un DOMRect", () => {
    const rect = {} as {
      left: number;
      right: number;
      top: number;
      bottom: number;
      height: number;
    };
    Object.defineProperties(rect, {
      left: { value: 12 },
      right: { value: 92 },
      top: { value: 20 },
      bottom: { value: 100 },
      height: { value: 80 }
    });

    expect(fitRectToGlyphHeight(rect, 50)).toMatchObject({
      left: 12,
      right: 92,
      top: 33,
      bottom: 87,
      height: 54
    });
  });
});

describe("buildRangeSegments", () => {
  it("creates one frame per visual line instead of one large union", () => {
    const segments = buildRangeSegments(
      [
        { left: 110, right: 180, top: 210, bottom: 250, height: 40 },
        { left: 190, right: 280, top: 210, bottom: 250, height: 40 },
        { left: 120, right: 260, top: 270, bottom: 310, height: 40 }
      ],
      { left: 100, top: 200 }
    );

    expect(segments).toEqual([
      { x: 10, y: 10, width: 170, height: 40 },
      { x: 20, y: 70, width: 140, height: 40 }
    ]);
  });
});
