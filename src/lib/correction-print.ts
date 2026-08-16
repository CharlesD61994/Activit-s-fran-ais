import type { GrammarPhaseKind, Sentence } from "../types";

export type CorrectionPrintSnapshot = {
  id: string;
  title: string;
  kinds: Set<GrammarPhaseKind>;
};

export type PrintPoint = { x: number; y: number };

/**
 * Rejoue un tracé libre entre les positions actuelles de ses deux mots.
 * La courbure dessinée par l'enseignant est conservée, tandis que les
 * extrémités suivent les mots si la phrase change de largeur ou de ligne.
 */
export function remapCorrectionArrow(
  points: PrintPoint[],
  start: PrintPoint,
  end: PrintPoint
) {
  if (points.length < 2) return [start, end];
  const sourceStart = points[0];
  const sourceEnd = points[points.length - 1];
  const sourceX = sourceEnd.x - sourceStart.x;
  const sourceY = sourceEnd.y - sourceStart.y;
  const sourceLengthSquared = sourceX * sourceX + sourceY * sourceY;
  if (sourceLengthSquared < 0.000001) return [start, end];

  const destinationX = end.x - start.x;
  const destinationY = end.y - start.y;
  return points.map((point) => {
    const relativeX = point.x - sourceStart.x;
    const relativeY = point.y - sourceStart.y;
    const along =
      (relativeX * sourceX + relativeY * sourceY) / sourceLengthSquared;
    const perpendicular =
      (sourceX * relativeY - sourceY * relativeX) / sourceLengthSquared;
    return {
      x: start.x + along * destinationX - perpendicular * destinationY,
      y: start.y + along * destinationY + perpendicular * destinationX
    };
  });
}

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
