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
    const marks: React.ReactNode[] = [];
    if (leftIds.includes(target.id)) marks.push(<span key={`left-mark-${target.id}`} className="word-group-range-bracket left" style={{ left: position.x - position.width / 2 - 10 - leftDepth * 7, top: position.y - 4, height: position.height + 8 }}/>);
    if (rightIds.includes(target.id)) marks.push(<span key={`right-mark-${target.id}`} className="word-group-range-bracket right" style={{ left: position.x + position.width / 2 - 7 + rightDepth * 7, top: position.y - 4, height: position.height + 8 }}/>);
    return marks;
  })}</>;
}
