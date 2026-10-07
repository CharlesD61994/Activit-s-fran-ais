"use client";

import type { RangePosition } from "@/components/grammar/use-range-target-positions";
import { rangeMarkNesting } from "./range-mark-nesting";
import { normalizeRangeTargets } from "./range-reader-layout";
import { tokenizeGrammarText } from "./range-interaction-engine";
import {
  naturalBracketGeometry,
  areRangeMarksAdjacent
} from "@/components/grammar/range-mark-spacing";

type Target = { id: string; start: number; end: number };
type Props = {
  text: string;
  targets: Target[];
  geometryTargets?: Target[];
  positions: Record<string, RangePosition>;
  leftIds: string[];
  rightIds: string[];
  mode: "brackets" | "frame";
};

export function RangeMarksLayer({
  text,
  targets,
  geometryTargets = targets,
  positions,
  leftIds,
  rightIds,
  mode
}: Props) {
  if (mode === "frame") {
    return (
      <>
        {targets.map((target) => {
          const position = positions[target.id];
          if (
            !position ||
            !leftIds.includes(target.id) ||
            !rightIds.includes(target.id)
          ) {
            return null;
          }

          return position.segments.map((segment, index) => (
            <span
              key={`frame-${target.id}-${index}`}
              className="word-group-confirmed-frame"
              style={{
                left: segment.x - 5,
                top: segment.y - 3,
                width: segment.width + 10,
                height: segment.height + 6
              }}
            />
          ));
        })}
      </>
    );
  }

  const layoutTargets = normalizeRangeTargets(tokenizeGrammarText(text, "range-geometry"), geometryTargets);

  return (
    <>
      {targets.flatMap((rawTarget) => {
        const target = layoutTargets.find((candidate) => candidate.id === rawTarget.id) ?? rawTarget;
        const position = positions[target.id];
        if (!position) return [];

        const { leftDepth, rightDepth, verticalInset } = rangeMarkNesting(target, layoutTargets);
        const previous = layoutTargets
          .filter(
            (candidate) =>
              candidate.id !== target.id &&
              areRangeMarksAdjacent(text, candidate, target) &&
              positions[candidate.id] &&
              Math.abs(
                positions[candidate.id].markEndY - position.markStartY
              ) <
                Math.min(
                  positions[candidate.id].markEndHeight,
                  position.markStartHeight
                ) * .5
          )
          .sort((a, b) => b.end - a.end)[0];
        const next = layoutTargets
          .filter(
            (candidate) =>
              candidate.id !== target.id &&
              areRangeMarksAdjacent(text, target, candidate) &&
              positions[candidate.id] &&
              Math.abs(
                positions[candidate.id].markStartY - position.markEndY
              ) <
                Math.min(
                  positions[candidate.id].markStartHeight,
                  position.markEndHeight
                ) * .5
          )
          .sort((a, b) => a.start - b.start)[0];
        const leftCount = layoutTargets.filter((candidate) => candidate.start === target.start).length;
        const rightCount = layoutTargets.filter((candidate) => candidate.end === target.end).length;
        const previousCount = previous ? layoutTargets.filter((candidate) => candidate.end === previous.end).length : 0;
        const nextCount = next ? layoutTargets.filter((candidate) => candidate.start === next.start).length : 0;
        const leftGeometry = naturalBracketGeometry(position.startInkX ?? position.startX, position.startGap, leftCount + previousCount, leftDepth, "left");
        const rightGeometry = naturalBracketGeometry(position.endInkX ?? position.endX, position.endGap, rightCount + nextCount, rightDepth, "right");
        const marks: React.ReactNode[] = [];
        for (const side of ["left", "right"] as const) {
          if (!(side === "left" ? leftIds : rightIds).includes(target.id)) continue;
          const geometry = side === "left" ? leftGeometry : rightGeometry;
          const glyphY = side === "left" ? position.markStartY : position.markEndY;
          const glyphHeight = side === "left" ? position.markStartHeight : position.markEndHeight;
          const bandY = geometry.splitStem ? (side === "left" ? position.startBandY ?? position.startY : position.endBandY ?? position.endY) : glyphY;
          const bandHeight = geometry.splitStem ? (side === "left" ? position.startBandHeight ?? position.startHeight : position.endBandHeight ?? position.endHeight) : glyphHeight;
          const cornerClearance = geometry.splitStem ? 8 : 3;
          const height = Math.max(34, bandHeight + cornerClearance * 2) + verticalInset * 2;
          const width = geometry.cap + geometry.strokeWidth;
          const stem = side === "left" ? geometry.strokeWidth / 2 : width - geometry.strokeWidth / 2;
          const tip = side === "left" ? width - geometry.strokeWidth / 2 : geometry.strokeWidth / 2;
          const top = geometry.strokeWidth / 2;
          const bottom = height - geometry.strokeWidth / 2;
          marks.push(
            <svg key={`${side}-mark-${target.id}`} aria-hidden="true"
              className={`word-group-range-bracket vector ${side}`}
              style={{ left: geometry.stemX - stem, top: bandY - cornerClearance - verticalInset, width, height }}
              viewBox={`0 0 ${width} ${height}`}>
              <g fill="none" stroke="currentColor" strokeWidth={geometry.strokeWidth}>
                {geometry.splitStem ? <>
                  <line data-bracket-stem="true" x1={stem} x2={stem} y1={top} y2={verticalInset + cornerClearance - 2} />
                  <line data-bracket-stem="true" x1={stem} x2={stem} y1={height - verticalInset - cornerClearance + 2} y2={bottom} />
                </> : <line data-bracket-stem="true" x1={stem} x2={stem} y1={top} y2={bottom} />}
                <path d={`M ${tip} ${top} H ${stem} M ${stem} ${bottom} H ${tip}`} />
              </g>
            </svg>
          );
        }

        return marks;
      })}
    </>
  );
}
