/** A shared bracket gap must contain only whitespace, never another word. */
export function areRangeMarksAdjacent(text: string, left: { end: number }, right: { start: number }) {
  return left.end <= right.start && text.slice(left.end, right.start).trim() === "";
}

/** Every bracket on a row uses the same ink band, including tight-gap corners. */
export function verticalBracketGeometry(glyphY: number, glyphHeight: number, inset: number) {
  const center = glyphY + glyphHeight / 2;
  const height = Math.max(34, glyphHeight + 6) + inset * 2;
  const top = center - height / 2;
  return { top, height, upperStemEnd: glyphY - top - 2, lowerStemStart: glyphY + glyphHeight - top + 2 };
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
  if (slot < 3) return {
    stemX: edge + direction * (3 + depth * 3), strokeWidth: 2, cap: 6, splitStem: true
  };
  return {
    stemX: edge + direction * (margin + (depth + .5) * slot),
    strokeWidth: 2,
    cap: 6,
    splitStem: false
  };
}
