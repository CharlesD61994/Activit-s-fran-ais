import { describe, expect, it } from "vitest";
import { createWorkflowPhase, defaultWorkflowForObjective, getAgreementWorkflowSettings, normalizeGrammarWorkflow } from "./grammar-workflow";
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

  it("keeps the legacy agreement flow when no explicit phase exists", () => {
    expect(getAgreementWorkflowSettings({} as Sentence)).toEqual({
      identifyDonors: true,
      identifyReceivers: true,
      linkAgreement: true
    });
  });

});
