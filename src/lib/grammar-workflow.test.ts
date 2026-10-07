import { describe, expect, it } from "vitest";
import { createWorkflowPhase, defaultWorkflowForObjective, getAgreementWorkflowSettings, getSecondaryObjectives, normalizeGrammarWorkflow, reviewPhaseImmediatelyAfter, shuffledGrammarTargetIds } from "./grammar-workflow";
import type { Sentence, SentenceCorrection } from "../types";
import { getCorrectionPointStages, syncCorrectionCodePhase } from "./grammar-workflow";

describe("correction scoring", () => {
  const withCode = { id: "with", correctionCodeId: "code-a" } as SentenceCorrection;
  const withoutCode = { id: "without", correctionCodeId: "" } as SentenceCorrection;

  it("only asks for codes and awards code-related points on configured errors", () => {
    const sentence = { workflowPhases: [createWorkflowPhase("correction")] } as Sentence;
    expect(getCorrectionPointStages(sentence, withCode)).toEqual(["click", "word", "code"]);
    expect(getCorrectionPointStages(sentence, withoutCode)).toEqual(["word"]);
    sentence.workflowPhases![0].actions.find((action) => action.kind === "identify_codes")!.enabled = false;
    expect(getCorrectionPointStages(sentence, withCode)).toEqual(["word"]);
  });

  it("synchronizes the code phase when adding and removing coded errors", () => {
    const original = [createWorkflowPhase("correction"), createWorkflowPhase("word_classes")];
    const codeAction = (phases: typeof original) => phases[0].actions.find((action) => action.kind === "identify_codes")!.enabled;
    const noCodes = syncCorrectionCodePhase(original, [withoutCode]);
    expect(codeAction(noCodes)).toBe(false);
    expect(noCodes[0].actions.find((action) => action.kind === "write_corrections")!.enabled).toBe(true);
    const mixed = syncCorrectionCodePhase(noCodes, [withoutCode, withCode]);
    expect(codeAction(mixed)).toBe(true);
    expect(mixed[1]).toBe(original[1]);
    expect(codeAction(syncCorrectionCodePhase(mixed, [withoutCode]))).toBe(false);
    expect(codeAction(syncCorrectionCodePhase(mixed, []))).toBe(false);
    expect(codeAction(original)).toBe(true);
  });

  it("awards only the correction point when codes are disabled", () => {
    const phase = createWorkflowPhase("correction");
    phase.actions.find((action) => action.kind === "identify_codes")!.enabled = false;
    const stages = getCorrectionPointStages({ workflowPhases: [phase] } as Sentence);
    expect(stages).toEqual(["word"]);
    expect(stages).not.toContain("click");
    expect(stages).not.toContain("code");
  });

  it("preserves scoring with codes enabled and for legacy activities", () => {
    expect(getCorrectionPointStages({ workflowPhases: [createWorkflowPhase("correction")] } as Sentence))
      .toEqual(["click", "word", "code"]);
    expect(getCorrectionPointStages({} as Sentence)).toEqual(["click", "word", "code"]);
  });
});

describe("grammar workflow", () => {
  it("keeps nucleus identification inside the groups phase", () => {
    const phases = defaultWorkflowForObjective("word_groups");
    expect(phases.map((phase) => phase.kind)).toEqual(["groups"]);
    expect(phases[0].actions.map((action) => action.kind)).toContain("find_nuclei");
  });

  it("migrates a legacy nuclei phase into groups", () => {
    const normalized = normalizeGrammarWorkflow([createWorkflowPhase("groups"), createWorkflowPhase("nuclei")]);
    expect(normalized.map((phase) => phase.kind)).toEqual(["groups"]);
    expect(normalized[0].actions.find((action) => action.kind === "find_nuclei")?.enabled).toBe(true);
  });
  it("honors each explicit donor and receiver action", () => {
    const phase = createWorkflowPhase("agreements");
    const sentence = {
      workflowPhases: [{
        ...phase,
        actions: phase.actions.map((action) => ({
          ...action,
          enabled: action.kind === "identify_receivers"
        }))
      }]
    } as Sentence;

    expect(getAgreementWorkflowSettings(sentence)).toEqual({
      identifyDonors: false,
      identifyReceivers: true,
      linkAgreement: false
    });
  });

  it("keeps arrow drawing on donor/receiver events instead of the phase", () => {
    const phase = createWorkflowPhase("agreements");
    expect(phase.actions.map((action) => action.kind)).not.toContain("link_agreement");

    expect(getAgreementWorkflowSettings({
      workflowPhases: [phase],
      grammarAnnotations: [{
        id: "donor",
        start: 0,
        end: 3,
        kind: "donor",
        responseMode: "arrow"
      }]
    } as Sentence).linkAgreement).toBe(true);
  });

  it("keeps the legacy agreement flow when no explicit phase exists", () => {
    expect(getAgreementWorkflowSettings({} as Sentence)).toEqual({
      identifyDonors: true,
      identifyReceivers: true,
      linkAgreement: true
    });
  });

  it("does not invent agreement questions inside an explicit workflow", () => {
    expect(getAgreementWorkflowSettings({
      workflowPhases: [createWorkflowPhase("word_classes")]
    } as Sentence)).toEqual({
      identifyDonors: false,
      identifyReceivers: false,
      linkAgreement: false
    });
  });

  it("shuffles target ids without mutating the source order", () => {
    const source = ["fonction-1", "fonction-2", "fonction-3"];
    expect(shuffledGrammarTargetIds(source, () => 0)).toEqual([
      "fonction-2",
      "fonction-3",
      "fonction-1"
    ]);
    expect(source).toEqual(["fonction-1", "fonction-2", "fonction-3"]);
  });

  it("finds only a correction pause placed immediately after a phase", () => {
    const correction = createWorkflowPhase("correction");
    const review = createWorkflowPhase("review");
    const groups = createWorkflowPhase("groups");

    expect(reviewPhaseImmediatelyAfter([correction, review, groups], "correction")?.id).toBe(review.id);
    expect(reviewPhaseImmediatelyAfter([correction, groups, review], "correction")).toBeUndefined();
  });

  it("does not expose correction pauses as student activity tags", () => {
    const sentence = {
      primaryObjective: "sentence_correction",
      workflowPhases: [createWorkflowPhase("correction"), createWorkflowPhase("review"), createWorkflowPhase("groups")]
    } as Sentence;

    expect(getSecondaryObjectives(sentence)).toEqual(["groups"]);
  });

});
