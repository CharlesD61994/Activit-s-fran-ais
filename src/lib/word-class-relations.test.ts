import { describe, expect, it } from "vitest";
import { buildRelationTasks } from "./word-class-relations";
import type { AgreementRelation, WordClassTarget } from "@/types";

const targets = [{ id: "donor" }, { id: "receiver-1" }, { id: "receiver-2" }] as WordClassTarget[];
const relations = [{ donorId: "donor", receiverIds: ["receiver-1", "receiver-2"] }] as AgreementRelation[];

describe("buildRelationTasks", () => {
  it("construit les tâches du donneur et des receveurs", () => {
    expect(buildRelationTasks(targets, relations)).toEqual([
      { targetId: "donor", role: "donor", expectedIds: ["receiver-1", "receiver-2"] },
      { targetId: "receiver-1", role: "receiver", expectedIds: ["donor"] },
      { targetId: "receiver-2", role: "receiver", expectedIds: ["donor"] }
    ]);
  });

  it("ignore les tâches inverses des receveurs quand elles sont désactivées", () => {
    expect(
      buildRelationTasks(targets, relations, { includeReceiverTasks: false })
    ).toEqual([
      { targetId: "donor", role: "donor", expectedIds: ["receiver-1", "receiver-2"] }
    ]);
  });

  it("ignore une cible sans relation", () => {
    expect(buildRelationTasks([{ id: "isolated" } as WordClassTarget], relations)).toEqual([]);
  });
});
