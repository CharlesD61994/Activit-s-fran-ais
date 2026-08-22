import type { AgreementRelation, WordClassTarget } from "@/types";

export type RelationTask = {
  targetId: string;
  role: "donor" | "receiver";
  expectedIds: string[];
};

export function buildRelationTasks(
  analysisTargets: WordClassTarget[],
  relations: AgreementRelation[],
  options: {
    includeDonorTasks?: boolean;
    includeReceiverTasks?: boolean;
  } = {}
): RelationTask[] {
  const includeDonorTasks = options.includeDonorTasks ?? true;
  const includeReceiverTasks = options.includeReceiverTasks ?? true;

  return analysisTargets.flatMap<RelationTask>((target) => {
    const donorRelations = relations.filter((relation) => relation.donorId === target.id);
    if (includeDonorTasks && donorRelations.length > 0) {
      return [{
        targetId: target.id,
        role: "donor",
        expectedIds: Array.from(new Set(donorRelations.flatMap((relation) => relation.receiverIds)))
      }];
    }

    if (!includeReceiverTasks) return [];

    const receiverRelations = relations.filter((relation) => relation.receiverIds.includes(target.id));
    if (receiverRelations.length === 0) return [];

    return [{
      targetId: target.id,
      role: "receiver",
      expectedIds: Array.from(new Set(receiverRelations.map((relation) => relation.donorId)))
    }];
  });
}
