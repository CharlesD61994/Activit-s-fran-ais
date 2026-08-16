const DEFAULT_BRACKET_CAP = 6;
const DEFAULT_TEXT_GAP = 4;
const MIN_BRACKET_CAP = 5;
const MIN_TEXT_GAP = 2;
const DEFAULT_BRACKET_SEPARATION = 10;
const MIN_BRACKET_SEPARATION = 12;

export function bracketSpacing(availableSpace?: number) {
  const defaultFootprint =
    (DEFAULT_BRACKET_CAP + DEFAULT_TEXT_GAP) * 2 +
    DEFAULT_BRACKET_SEPARATION;

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
