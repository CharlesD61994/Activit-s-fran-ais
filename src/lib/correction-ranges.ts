import type { SentenceCorrection } from "@/types";

export function resolveCorrectionBounds(
  text: string,
  correction: SentenceCorrection
) {
  if (
    correction.originalText.length === 0 ||
    text.slice(correction.start, correction.end) === correction.originalText
  ) {
    return { start: correction.start, end: correction.end };
  }

  const candidates: number[] = [];
  let cursor = text.indexOf(correction.originalText);
  while (cursor >= 0) {
    candidates.push(cursor);
    cursor = text.indexOf(correction.originalText, cursor + 1);
  }

  const start = candidates.sort(
    (a, b) => Math.abs(a - correction.start) - Math.abs(b - correction.start)
  )[0];

  return start === undefined
    ? { start: correction.start, end: correction.end }
    : { start, end: start + correction.originalText.length };
}
