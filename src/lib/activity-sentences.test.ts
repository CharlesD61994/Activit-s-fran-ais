import { describe, expect, it } from "vitest";
import { assembleActivity, getActivitySentences, replacePhrasePoints } from "./activity-sentences";
import type { Sentence } from "../types";

const first: Sentence = { id: "phrase-a", title: "Accords", levelId: "sec-2", difficulty: "easy", tags: [], assignedGroupIds: [], originalText: "Les chats jouent.", corrections: [], workflowPhases: [], createdAt: "2026-10-07", updatedAt: "2026-10-07" };
const second: Sentence = { ...first, id: "phrase-b", originalText: "Les oiseaux chantent.", corrections: [{ id: "second-error", correctionCodeId: "code-a", start: 0, end: 3, originalText: "Les", correctedText: "Les", points: 1, revealOrder: 1 }], workflowPhases: [{ id: "second-phase", title: "Correction", kind: "correction", actions: [] }] };

describe("activity sentence sequence", () => {
  it("keeps legacy activities as a single unchanged sentence", () => {
    expect(getActivitySentences(first)).toEqual([first]);
    expect(assembleActivity([first], "activity-id", first).activitySentences).toBeUndefined();
  });
  it("round-trips the selected order, independent answers and phases", () => {
    const activity = assembleActivity([second, first], "activity-id", first);
    const restored = getActivitySentences(JSON.parse(JSON.stringify(activity)));
    expect(activity.id).toBe("activity-id");
    expect(activity.originalText).toBe(second.originalText);
    expect(restored.map((part) => part.id)).toEqual(["phrase-b", "phrase-a"]);
    expect(restored[0].corrections).toEqual(second.corrections);
    expect(restored[1].corrections).toEqual([]);
    expect(restored[0].workflowPhases).toEqual(second.workflowPhases);
  });
  it("keeps metadata shared without overwriting individual content", () => {
    const activity = assembleActivity([first, second], "activity-id", { ...first, title: "Révision", levelId: "sec-3" });
    expect(getActivitySentences(activity).map((part) => [part.title, part.levelId])).toEqual([["Révision", "sec-3"], ["Révision", "sec-3"]]);
    expect(second.title).toBe("Accords");
  });
  it("restores and restarts one phase without losing points from other phrases or phases", () => {
    const earlier = { phraseId: "phrase-a", stage: "word", points: 1 };
    const correction = { phraseId: "phrase-b", stage: "word", points: 1 };
    const classPoint = { phraseId: "phrase-b", stage: "class", points: 1 };
    const current = [earlier, correction, classPoint];
    expect(replacePhrasePoints(current, [correction], "phrase-b", ["word", "code", "click"]))
      .toEqual([earlier, classPoint, correction]);
    expect(replacePhrasePoints(current, [], "phrase-b", ["word", "code", "click"]))
      .toEqual([earlier, classPoint]);
  });
});
