import { describe, expect, it } from "vitest";
import { resolveCorrectionBounds } from "./correction-ranges";
import type { SentenceCorrection } from "@/types";

function correction(
  overrides: Partial<SentenceCorrection> = {}
): SentenceCorrection {
  return {
    id: "correction-1",
    start: 0,
    end: 3,
    originalText: "Les",
    correctedText: "Les",
    correctionCodeId: "code-1",
    points: 1,
    revealOrder: 0,
    ...overrides
  };
}

describe("resolveCorrectionBounds", () => {
  it("preserves an exact stored range", () => {
    expect(resolveCorrectionBounds("Les chats", correction())).toEqual({
      start: 0,
      end: 3
    });
  });

  it("repairs a legacy range shifted by one character", () => {
    expect(
      resolveCorrectionBounds(
        "Ces amis son arrivés",
        correction({ start: 10, end: 13, originalText: "son" })
      )
    ).toEqual({ start: 9, end: 12 });
  });

  it("chooses the matching occurrence nearest the stored position", () => {
    expect(
      resolveCorrectionBounds(
        "on arrive et on repart",
        correction({ start: 13, end: 15, originalText: "on" })
      )
    ).toEqual({ start: 13, end: 15 });
  });
});
