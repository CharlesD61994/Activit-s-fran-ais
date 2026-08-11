const DEFAULT_BRACKET_CAP = 6;
const DEFAULT_TEXT_GAP = 4;
const MIN_BRACKET_CAP = 3;
const MIN_TEXT_GAP = 1;
const MIN_BRACKET_SEPARATION = 2;

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