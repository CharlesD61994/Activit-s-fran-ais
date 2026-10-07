"use client";

import type { RangePosition } from "@/components/grammar/use-range-target-positions";
import { rangeMarkNesting } from "./range-mark-nesting";
import {
  adjacentBracketPair,
  areRangeMarksAdjacent,
  boundedBracketSpacing
} from "@/components/grammar/range-mark-spacing";

type Target = { id: string; start: number; end: number };
type Props = {
  text: string;
  targets: Target[];
  positions: Record<string, RangePosition>;
  leftIds: string[];
  rightIds: string[];
  mode: "brackets" | "frame";
};

export function RangeMarksLayer({
  text,
  targets,
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

  return (
    <>
      {targets.flatMap((target) => {
        const position = positions[target.id];
        if (!position) return [];

        const { leftDepth, rightDepth, verticalInset } = rangeMarkNesting(target, targets);
        const previous = targets
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
        const next = targets
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
        const previousPosition = previous
          ? positions[previous.id]
          : undefined;
        const nextPosition = next ? positions[next.id] : undefined;
        const leftCount = targets.filter((candidate) => candidate.start === target.start).length;
        const rightCount = targets.filter((candidate) => candidate.end === target.end).length;
        const previousCount = previous ? targets.filter((candidate) => candidate.end === previous.end).length : 0;
        const nextCount = next ? targets.filter((candidate) => candidate.start === next.start).length : 0;
        const leftSpacing = boundedBracketSpacing(
          previousPosition ? (position.startX - previousPosition.endX) / 2 : position.startGap,
          leftCount
        );
        const rightSpacing = boundedBracketSpacing(
          nextPosition ? (nextPosition.startX - position.endX) / 2 : position.endGap,
          rightCount
        );
        const leftPair = previousPosition && leftCount === 1 && previousCount === 1
          ? adjacentBracketPair(previousPosition.endX, position.startX)
          : undefined;
        const rightPair = nextPosition && rightCount === 1 && nextCount === 1
          ? adjacentBracketPair(position.endX, nextPosition.startX)
          : undefined;
        const marks: React.ReactNode[] = [];

        if (leftIds.includes(target.id)) {
          marks.push(
            <span
              key={`left-mark-${target.id}`}
              className="word-group-range-bracket left"
              style={{
                left:
                  leftPair && leftDepth === 0
                    ? leftPair.leftBracketLeft
                    : position.startX -
                      leftSpacing.gap -
                      leftSpacing.cap -
                      leftDepth * (leftSpacing.cap + leftSpacing.gap),
                top: position.markStartY - 1 - verticalInset,
                width: leftPair && leftDepth === 0 ? leftPair.cap : leftSpacing.cap,
                height: Math.max(34, position.markStartHeight + 2) + verticalInset * 2
              }}
            />
          );
        }

        if (rightIds.includes(target.id)) {
          marks.push(
            <span
              key={`right-mark-${target.id}`}
              className="word-group-range-bracket right"
              style={{
                left:
                  rightPair && rightDepth === 0
                    ? rightPair.rightBracketLeft
                    : position.endX +
                      rightSpacing.gap +
                      rightDepth * (rightSpacing.cap + rightSpacing.gap),
                top: position.markEndY - 1 - verticalInset,
                width: rightPair && rightDepth === 0 ? rightPair.cap : rightSpacing.cap,
                height: Math.max(34, position.markEndHeight + 2) + verticalInset * 2
              }}
            />
          );
        }

        return marks;
      })}
    </>
  );
}
