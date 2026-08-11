import { describe, expect, it } from "vitest";
import { isMeasurableRangeToken } from "./use-range-target-positions";

describe("isMeasurableRangeToken", () => {
  it("measures punctuation so a closing bracket is placed after it", () => {
    expect(isMeasurableRangeToken({ id: "period", text: ".", start: 6, end: 7, isWord: false })).toBe(true);
  });

  it("does not use whitespace as a bracket boundary", () => {
    expect(isMeasurableRangeToken({ id: "space", text: " ", start: 6, end: 7, isWord: false })).toBe(false);
  });
});