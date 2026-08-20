import type { AgreementCorrectionArrow } from "@/types";

export type ArrowPoint = { x: number; y: number };

/**
 * Reprojects a hand-drawn arrow onto the current positions of its two words.
 * This keeps the teacher's stroke intact even when printing changes line wraps.
 */
export function projectAgreementArrowPoints(
  arrow: AgreementCorrectionArrow,
  canvas: { width: number; height: number },
  currentStart?: ArrowPoint | null,
  currentEnd?: ArrowPoint | null
): ArrowPoint[] {
  const source = arrow.sourceGeometry;

  if (!source) {
    const points = arrow.points.map((point) => ({
      x: point.x * canvas.width,
      y: point.y * canvas.height
    }));
    if (!currentStart || !currentEnd || points.length === 0) return points;
    const first = points[0];
    const last = points[points.length - 1];
    const lastIndex = Math.max(1, points.length - 1);
    return points.map((point, index) => {
      const progress = index / lastIndex;
      return {
        x: point.x + (currentStart.x - first.x) * (1 - progress) + (currentEnd.x - last.x) * progress,
        y: point.y + (currentStart.y - first.y) * (1 - progress) + (currentEnd.y - last.y) * progress
      };
    });
  }

  if (!currentStart || !currentEnd) return arrow.points.map((point) => ({
    x: point.x * source.width,
    y: point.y * source.height
  }));

  const startDelta = {
    x: currentStart.x - source.startAnchor.x,
    y: currentStart.y - source.startAnchor.y
  };
  const endDelta = {
    x: currentEnd.x - source.endAnchor.x,
    y: currentEnd.y - source.endAnchor.y
  };
  const lastIndex = Math.max(1, arrow.points.length - 1);

  return arrow.points.map((point, index) => {
    const progress = index / lastIndex;
    return {
      x:
        point.x * source.width +
        startDelta.x * (1 - progress) +
        endDelta.x * progress,
      y:
        point.y * source.height +
        startDelta.y * (1 - progress) +
        endDelta.y * progress
    };
  });
}
