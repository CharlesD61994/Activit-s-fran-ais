type Target = { id: string; start: number; end: number };

/** Stable geometry, including marks that have not been revealed yet. */
export function rangeMarkNesting(target: Target, targets: Target[]) {
  const boundaryRank = (side: "start" | "end") => targets
    .filter((candidate) => candidate[side] === target[side])
    .sort((a, b) => (a.end - a.start) - (b.end - b.start) || a.id.localeCompare(b.id))
    .findIndex((candidate) => candidate.id === target.id);

  const levels = new Map<string, number>();
  const innerLevels = (range: Target): number => {
    const cached = levels.get(range.id);
    if (cached !== undefined) return cached;
    const children = targets.filter((candidate) => candidate.start >= range.start && candidate.end <= range.end &&
      (candidate.start > range.start || candidate.end < range.end));
    const level = children.length ? 1 + Math.max(...children.map(innerLevels)) : 0;
    levels.set(range.id, level);
    return level;
  };

  return {
    leftDepth: Math.max(0, boundaryRank("start")),
    rightDepth: Math.max(0, boundaryRank("end")),
    verticalInset: 6 * Math.max(innerLevels(target), boundaryRank("start"), boundaryRank("end"))
  };
}
