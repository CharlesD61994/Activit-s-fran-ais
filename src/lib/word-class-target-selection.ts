import type { WordClassTarget } from "@/types";

type TextRange = { start: number; end: number };

function overlaps(left: TextRange, right: TextRange) {
  return (
    (left.start <= right.start && left.end >= right.end) ||
    (right.start <= left.start && right.end >= left.end)
  );
}

/**
 * Selects the target the student can actually answer. A technical agreement
 * endpoint may share the same range, but must never mask a class target.
 */
export function preferredWordTarget(
  token: TextRange,
  classTargets: WordClassTarget[],
  allTargets: WordClassTarget[]
) {
  return (
    classTargets.find(
      (target) => target.start === token.start && target.end === token.end
    ) ??
    classTargets.find((target) => overlaps(token, target)) ??
    allTargets.find(
      (target) => target.start === token.start && target.end === token.end
    ) ??
    allTargets.find((target) => overlaps(token, target))
  );
}

export function uniqueClassTargetsByRange(targets: WordClassTarget[]) {
  return Array.from(
    new Map(
      targets.map((target) => [`${target.start}-${target.end}`, target])
    ).values()
  );
}
