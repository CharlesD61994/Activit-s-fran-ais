"use client";

import type { RangePosition } from "@/components/grammar/use-range-target-positions";

type Target = { id: string; start: number; end: number };
type Props = { targets: Target[]; positions: Record<string, RangePosition>; leftIds: string[]; rightIds: string[]; mode: "brackets" | "frame" };

export function RangeMarksLayer({ targets, positions, leftIds, rightIds, mode }: Props) {
  if (mode === "frame") return <>{targets.map((target) => { const position = positions[target.id]; if (!position || !leftIds.includes(target.id) || !rightIds.includes(target.id)) return null; return <span key={`frame-${target.id}`} className="word-group-confirmed-frame" style={{ left: position.x - position.width / 2 - 7, top: position.y - 4, width: position.width + 14, height: position.height + 8 }}/>; })}</>;
  return <>{targets.flatMap((target) => {
    const position = positions[target.id]; if (!position) return [];
    const sameLeft = targets.filter((candidate) => candidate.start === target.start), sameRight = targets.filter((candidate) => candidate.end === target.end);
    const leftDepth = Math.max(0, sameLeft.findIndex((candidate) => candidate.id === target.id));
    const rightDepth = Math.max(0, sameRight.findIndex((candidate) => candidate.id === target.id));
    const previous = targets.filter((candidate) => candidate.id !== target.id && rightIds.includes(candidate.id) && candidate.end <= target.start && positions[candidate.id] && Math.abs(positions[candidate.id].endY - position.startY) < Math.min(positions[candidate.id].endHeight, position.startHeight) * .5).sort((a, b) => b.end - a.end)[0];
    const next = targets.filter((candidate) => candidate.id !== target.id && leftIds.includes(candidate.id) && candidate.start >= target.end && positions[candidate.id] && Math.abs(positions[candidate.id].startY - position.endY) < Math.min(positions[candidate.id].startHeight, position.endHeight) * .5).sort((a, b) => a.start - b.start)[0];
    const previousPosition = previous ? positions[previous.id] : undefined;
    const nextPosition = next ? positions[next.id] : undefined;
    const sharedLeftBoundary = previousPosition && position.startX - previousPosition.endX < 44 ? (previousPosition.endX + position.startX) / 2 + 4 : undefined;
    const sharedRightBoundary = nextPosition && nextPosition.startX - position.endX < 44 ? (position.endX + nextPosition.startX) / 2 - 10 : undefined;
    const leftInset = Math.max(3, position.startHeight * .08);
    const rightInset = Math.max(3, position.endHeight * .08);
    const marks: React.ReactNode[] = [];
    if (leftIds.includes(target.id)) marks.push(<span key={`left-mark-${target.id}`} className="word-group-range-bracket left" style={{ left: sharedLeftBoundary ?? position.startX - 6 - leftDepth * 7, top: position.startY + leftInset, height: Math.max(34, position.startHeight - leftInset * 2) }}/>);
    if (rightIds.includes(target.id)) marks.push(<span key={`right-mark-${target.id}`} className="word-group-range-bracket right" style={{ left: sharedRightBoundary ?? position.endX + rightDepth * 7, top: position.endY + rightInset, height: Math.max(34, position.endHeight - rightInset * 2) }}/>);
    return marks;
  })}</>;
}
