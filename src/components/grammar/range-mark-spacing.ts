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

/**
 * Places two neighbouring bracket strokes around the real midpoint between
 * words.  Both brackets use the same calculation, so their vertical strokes
 * can never collapse into one shared line.
 */
export function adjacentBracketPair(
  leftWordEnd: number,
  rightWordStart: number
) {
  const availableSpace = Math.max(0, rightWordStart - leftWordEnd);
  const strokeSeparation = Math.max(4, Math.min(8, availableSpace * .28));
  const cap = Math.max(
    3,
    Math.min(DEFAULT_BRACKET_CAP, (availableSpace - strokeSeparation - 2) / 2)
  );
  const midpoint = (leftWordEnd + rightWordStart) / 2;

  return {
    cap,
    rightBracketLeft: midpoint - strokeSeparation / 2 - cap,
    leftBracketLeft: midpoint + strokeSeparation / 2,
    strokeSeparation
  };
}
