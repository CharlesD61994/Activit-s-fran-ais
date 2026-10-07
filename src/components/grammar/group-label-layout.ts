import type { RangePosition } from "./use-range-target-positions";

type Group = { id: string; start: number; end: number };
export const PRINCIPAL_GROUP_LABEL_OFFSET = 34;

function contains(parent: Group, child: Group) {
  return parent.start <= child.start && parent.end >= child.end &&
    (parent.start < child.start || parent.end > child.end);
}

export function isPrincipalGroup(group: Group, groups: Group[]) {
  return groups.some((candidate) => contains(group, candidate)) &&
    !groups.some((candidate) => contains(candidate, group));
}

/** Keep the outer group centered; expansions stay on the existing lower row. */
export function groupLabelPlacement(group: Group, groups: Group[], position: Pick<RangePosition, "x" | "y" | "segments">) {
  const principal = isPrincipalGroup(group, groups);
  const left = principal && position.segments.length
    ? (Math.min(...position.segments.map((segment) => segment.x)) +
      Math.max(...position.segments.map((segment) => segment.x + segment.width))) / 2
    : position.x;
  return { left, top: position.y - (principal ? PRINCIPAL_GROUP_LABEL_OFFSET : 0), principal };
}
