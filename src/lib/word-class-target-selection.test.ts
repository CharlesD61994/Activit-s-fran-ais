import { describe, expect, it } from "vitest";
import {
  preferredWordTarget,
  uniqueClassTargetsByRange
} from "./word-class-target-selection";
import type { WordClassTarget } from "@/types";

describe("word class target selection", () => {
  it("does not let a technical agreement endpoint mask the class target", () => {
    const classTarget: WordClassTarget = {
      id: "class-name",
      start: 4,
      end: 9,
      text: "chats",
      wordClass: "noun",
      isAnalysisTarget: true
    };
    const technicalTarget: WordClassTarget = {
      ...classTarget,
      id: "agreement-endpoint",
      isAnalysisTarget: false
    };

    expect(
      preferredWordTarget(
        { start: 4, end: 9 },
        [classTarget],
        [classTarget, technicalTarget]
      )?.id
    ).toBe("class-name");
  });

  it("counts only one class action for duplicate ranges", () => {
    const targets = ["old", "current"].map((id): WordClassTarget => ({
      id,
      start: 0,
      end: 3,
      text: "Les",
      wordClass: "determiner"
    }));

    expect(uniqueClassTargetsByRange(targets).map((target) => target.id)).toEqual([
      "current"
    ]);
  });
});
