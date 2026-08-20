"use client";

import type { RangePosition } from "@/components/grammar/use-range-target-positions";
import {
  adjacentBracketPair,
  bracketSpacing
} from "@/components/grammar/range-mark-spacing";

type Target = { id: string; start: number; end: number };
type Props = {
  targets: Target[];
  positions: Record<string, RangePosition>;
  leftIds: string[];
  rightIds: string[];
  mode: "brackets" | "frame";
};

export function RangeMarksLayer({
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

        const sameLeft = targets.filter(
          (candidate) => candidate.start === target.start
        );
        const sameRight = targets.filter(
          (candidate) => candidate.end === target.end
        );
        const leftDepth = Math.max(
          0,
          sameLeft.findIndex((candidate) => candidate.id === target.id)
        );
        const rightDepth = Math.max(
          0,
          sameRight.findIndex((candidate) => candidate.id === target.id)
        );
        const previous = targets
          .filter(
            (candidate) =>
              candidate.id !== target.id &&
              rightIds.includes(candidate.id) &&
              candidate.end <= target.start &&
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
              leftIds.includes(candidate.id) &&
              candidate.start >= target.end &&
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
        const leftSpacing = bracketSpacing(
          previousPosition
            ? position.startX - previousPosition.endX
            : undefined
        );
        const rightSpacing = bracketSpacing(
          nextPosition ? nextPosition.startX - position.endX : undefined
        );
        const leftPair = previousPosition
          ? adjacentBracketPair(previousPosition.endX, position.startX)
          : undefined;
        const rightPair = nextPosition
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
                top: position.markStartY - 1,
                width: leftPair && leftDepth === 0 ? leftPair.cap : leftSpacing.cap,
                height: Math.max(34, position.markStartHeight + 2)
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
                top: position.markEndY - 1,
                width: rightPair && rightDepth === 0 ? rightPair.cap : rightSpacing.cap,
                height: Math.max(34, position.markEndHeight + 2)
              }}
            />
          );
        }

        return marks;
      })}
    </>
  );
}
