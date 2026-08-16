import { describe, expect, it } from "vitest";
import { createWorkflowPhase, defaultWorkflowForObjective, getAgreementWorkflowSettings, getSecondaryObjectives, normalizeGrammarWorkflow, reviewPhaseImmediatelyAfter, shuffledGrammarTargetIds } from "./grammar-workflow";
import type { Sentence } from "../types";

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
