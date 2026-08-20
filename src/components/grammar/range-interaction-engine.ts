export type InteractionPoint = { x: number; y: number };
export type GrammarRangeToken = { id: string; text: string; start: number; end: number; isWord: boolean };
export type RangeTargetLike = { id: string; start: number; end: number };
export type BoundaryAnchor = { x: number; y: number; height: number };

export function tokenizeGrammarText(text: string, prefix = "grammar-token"): GrammarRangeToken[] {
  return Array.from(
    text.matchAll(/[\p{L}\p{M}]+['’](?=[\p{L}\p{M}])|[\p{L}\p{M}]+|\s+|[^\p{L}\p{M}\s]+/gu)
  ).map((match, index) => {
    const value = match[0];
    const start = match.index ?? 0;
    return {
      id: `${prefix}-${index}-${start}`,
      text: value,
      start,
      end: start + value.length,
      isWord: /[\p{L}\p{M}]/u.test(value)
    };
  });
}

export function recognizeBracketStroke(points: InteractionPoint[]): "[" | "]" | null {
  if (points.length < 3) return null;
  const xs = points.map((point) => point.x), ys = points.map((point) => point.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const width = maxX - minX, height = maxY - minY;
  if (height < 15 || width < 2 || height < width * .65) return null;
  const sideBand = Math.max(5, width * .44);
  const leftStem = points.filter((point) => point.x <= minX + sideBand).length;
  const rightStem = points.filter((point) => point.x >= maxX - sideBand).length;
  if (Math.abs(leftStem - rightStem) < points.length * .08) {
    const top = points.filter((point) => point.y <= minY + height * .25), bottom = points.filter((point) => point.y >= maxY - height * .25);
    const topAverage = top.reduce((sum, point) => sum + point.x, 0) / Math.max(1, top.length);
    const bottomAverage = bottom.reduce((sum, point) => sum + point.x, 0) / Math.max(1, bottom.length);
    return (topAverage + bottomAverage) / 2 >= (minX + maxX) / 2 ? "[" : "]";
  }
  return leftStem > rightStem ? "[" : "]";
}

export function strokeCenter(points: InteractionPoint[]) {
  const xs = points.map((point) => point.x), ys = points.map((point) => point.y);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

export function chooseBracketTarget<T extends RangeTargetLike>(points: InteractionPoint[], targets: T[], unavailableIds: string[], otherBoundaryIds: string[], requestedTargetId: string | undefined, getAnchor: (target: T) => BoundaryAnchor | null): { target: T; index: number } | null {
  const center = strokeCenter(points), horizontalTolerance = 52;
  const candidates = targets.filter((target) => !requestedTargetId || target.id === requestedTargetId).filter((target) => !unavailableIds.includes(target.id)).map((target) => {
    const anchor = getAnchor(target); if (!anchor) return null;
    const verticalTolerance = Math.max(58, anchor.height * 1.12), dx = Math.abs(center.x - anchor.x), dy = Math.abs(center.y - anchor.y);
    if (dx > horizontalTolerance || dy > verticalTolerance) return null;
    return { target, index: targets.findIndex((candidate) => candidate.id === target.id), score: dx / horizontalTolerance + dy / verticalTolerance - (otherBoundaryIds.includes(target.id) ? .45 : 0) };
  }).filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate)).sort((a, b) => a.score - b.score);
  return candidates[0] ? { target: candidates[0].target, index: candidates[0].index } : null;
}

export function matchDrawnRange<T extends RangeTargetLike>(start: number, end: number, targets: T[], unavailableIds: string[], requestedTargetId?: string, tolerance = 2) {
  return targets.find((target) => (!requestedTargetId || target.id === requestedTargetId) && !unavailableIds.includes(target.id) && start <= target.start && end >= target.end && Math.abs(start - target.start) <= tolerance && Math.abs(end - target.end) <= tolerance) ?? null;
}
