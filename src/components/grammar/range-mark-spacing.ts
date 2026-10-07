/** A shared bracket gap must contain only whitespace, never another word. */
export function areRangeMarksAdjacent(text: string, left: { end: number }, right: { start: number }) {
  return left.end <= right.start && text.slice(left.end, right.start).trim() === "";
}

/** Allocate stems in the natural gap; arms are drawn above/below the glyphs. */
export function naturalBracketGeometry(
  edge: number,
  availableSpace: number | undefined,
  count: number,
  depth: number,
  side: "left" | "right"
) {
  const direction = side === "left" ? -1 : 1;
  if (availableSpace === undefined) {
    return { stemX: edge + direction * (10 + depth * 6), strokeWidth: 2, cap: 6, splitStem: false };
  }
  const margin = Math.min(1, availableSpace * .15);
  const slot = Math.max(0, availableSpace - margin * 2) / Math.max(1, count);
  // When glyphs touch (punctuation/elision), use separated corners above and
  // below the letters. A full vertical stroke cannot fit without hiding ink.
  if (slot < 1.5) return {
    stemX: edge + direction * (3 + depth * 3), strokeWidth: 1.5, cap: 6, splitStem: true
  };
  return {
    stemX: edge + direction * (margin + (depth + .5) * slot),
    strokeWidth: Math.min(2, slot * .5),
    cap: 6,
    splitStem: false
  };
}
