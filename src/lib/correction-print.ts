import type { GrammarPhaseKind, Sentence } from "../types";

export type CorrectionPrintSnapshot = {
  id: string;
  title: string;
  kinds: Set<GrammarPhaseKind>;
};

export function buildCorrectionPrintSnapshots(sentence: Sentence): CorrectionPrintSnapshot[] {
  const kinds = new Set<GrammarPhaseKind>();
  const snapshots: CorrectionPrintSnapshot[] = [];
  let phasesSinceSnapshot = 0;

  (sentence.workflowPhases ?? []).forEach((phase) => {
    if (phase.kind === "review") {
      if (phasesSinceSnapshot > 0) {
        snapshots.push({
          id: phase.id,
          title: phase.title || "Temps de correction",
          kinds: new Set(kinds)
        });
        phasesSinceSnapshot = 0;
      }
      return;
    }
    kinds.add(phase.kind);
    phasesSinceSnapshot += 1;
  });

  if (phasesSinceSnapshot > 0 || snapshots.length === 0) {
    snapshots.push({ id: "final", title: "Corrigé final", kinds: new Set(kinds) });
  }

  return snapshots;
}
