import { describe, expect, it } from "vitest";
import { createWorkflowPhase, defaultWorkflowForObjective, normalizeGrammarWorkflow } from "./grammar-workflow";

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
});
