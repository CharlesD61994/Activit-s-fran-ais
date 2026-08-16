import { describe, expect, it } from "vitest";
import { createWorkflowPhase } from "./grammar-workflow";
import { buildCorrectionPrintSnapshots } from "./correction-print";
import type { Sentence } from "../types";

describe("correction print snapshots", () => {
  it("creates cumulative snapshots at correction pauses", () => {
    const correction = createWorkflowPhase("correction");
    const firstReview = { ...createWorkflowPhase("review"), title: "Corrige les erreurs" };
    const groups = createWorkflowPhase("groups");
    const secondReview = { ...createWorkflowPhase("review"), title: "Vérifie les groupes" };
    const functions = createWorkflowPhase("functions");
    const sentence = {
      workflowPhases: [correction, firstReview, groups, secondReview, functions]
    } as Sentence;

    const snapshots = buildCorrectionPrintSnapshots(sentence);
    expect(snapshots.map((snapshot) => snapshot.title)).toEqual([
      "Corrige les erreurs",
      "Vérifie les groupes",
      "Corrigé final"
    ]);
    expect(Array.from(snapshots[0].kinds)).toEqual(["correction"]);
    expect(Array.from(snapshots[1].kinds)).toEqual(["correction", "groups"]);
    expect(Array.from(snapshots[2].kinds)).toEqual(["correction", "groups", "functions"]);
  });
});
