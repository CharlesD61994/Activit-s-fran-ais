import { describe, expect, it } from "vitest";
import { createWorkflowPhase } from "./grammar-workflow";
import { buildCorrectionPrintSnapshots, remapCorrectionArrow } from "./correction-print";
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

  it("reattaches a freehand arrow to the current word positions", () => {
    const points = [
      { x: 0.1, y: 0.7 },
      { x: 0.35, y: 0.2 },
      { x: 0.9, y: 0.7 }
    ];
    const remapped = remapCorrectionArrow(
      points,
      { x: 120, y: 80 },
      { x: 520, y: 180 }
    );

    expect(remapped[0]).toEqual({ x: 120, y: 80 });
    expect(remapped.at(-1)).toEqual({ x: 520, y: 180 });
    expect(remapped[1].y).toBeLessThan(80);
  });
});
