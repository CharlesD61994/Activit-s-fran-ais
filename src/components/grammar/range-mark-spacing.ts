const DEFAULT_BRACKET_CAP = 6;
const DEFAULT_TEXT_GAP = 4;
const MIN_BRACKET_CAP = 3;
const MIN_TEXT_GAP = 2;
const MIN_BRACKET_SEPARATION = 6;

export function bracketSpacing(availableSpace?: number) {
  const defaultFootprint =
    (DEFAULT_BRACKET_CAP + DEFAULT_TEXT_GAP) * 2 +
    MIN_BRACKET_SEPARATION;

  if (availableSpace === undefined || availableSpace >= defaultFootprint) {
    return { cap: DEFAULT_BRACKET_CAP, gap: DEFAULT_TEXT_GAP };
  }

  const slot = Math.max(
    MIN_BRACKET_CAP + MIN_TEXT_GAP,
    (availableSpace - MIN_BRACKET_SEPARATION) / 2
  );
  const gap = Math.max(
    MIN_TEXT_GAP,
    Math.min(DEFAULT_TEXT_GAP, slot * .25)
  );

  return {
    cap: Math.max(MIN_BRACKET_CAP, slot - gap),
    gap
  };
}
export function bracketReserve(boundaryCount: number) {
  return Math.max(0, boundaryCount) *
    (DEFAULT_BRACKET_CAP + DEFAULT_TEXT_GAP);
}

type RangeBoundary = { start: number; end: number };
type IdentifiedRangeBoundary = RangeBoundary & { id: string };

export function bracketTokenMargins(
  token: RangeBoundary,
  targets: RangeBoundary[]
) {
  const leftBoundaryCount = targets.filter(
    (target) =>
      token.start <= target.start && token.end > target.start
  ).length;
  const rightBoundaryCount = targets.filter(
    (target) =>
      token.start < target.end && token.end >= target.end
  ).length;

  return {
    marginLeft: bracketReserve(leftBoundaryCount),
    marginRight: bracketReserve(rightBoundaryCount)
  };
}

export function validatedBracketTokenMargins(
  token: RangeBoundary,
  targets: IdentifiedRangeBoundary[],
  leftIds: string[],
  rightIds: string[]
) {
  const leftSet = new Set(leftIds);
  const rightSet = new Set(rightIds);
  const leftBoundaryCount = targets.filter(
    (target) =>
      leftSet.has(target.id) &&
      token.start <= target.start && token.end > target.start
  ).length;
  const rightBoundaryCount = targets.filter(
    (target) =>
      rightSet.has(target.id) &&
      token.start < target.end && token.end >= target.end
  ).length;

  return {
    marginLeft: bracketReserve(leftBoundaryCount),
    marginRight: bracketReserve(rightBoundaryCount)
  };
}
