"use client";

import type { RangePosition } from "@/components/grammar/use-range-target-positions";

export type ResolvedCorrectionMark = {
  id: string;
  start: number;
  end: number;
  label: string;
};

export function ResolvedCorrectionLabels({
  marks,
  positions
}: {
  marks: ResolvedCorrectionMark[];
  positions: Record<string, RangePosition>;
}) {
  return marks.map((mark) => {
    const position = positions[mark.id];
    if (!position) return null;

    return (
      <span
        className="resolved-correction-label"
        key={mark.id}
        style={{ left: position.x, top: position.y }}
      >
        ({mark.label})
      </span>
    );
  });
}
