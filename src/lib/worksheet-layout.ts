// Existing worksheet coordinates use a 1056 × 816 grid on a portrait page.
export const WORKSHEET_WIDTH = 1056;
export const WORKSHEET_HEIGHT = 816;
export function worksheetVerticalLength(spacing: number) {
  return `${spacing / WORKSHEET_HEIGHT * (11 / 8.5) * 100}cqw`;
}
export const worksheetAnswerLineHeight = worksheetVerticalLength;

type WorksheetBounds = { x: number; y: number; width: number; height: number };
export function snapWorksheetBox(moving: WorksheetBounds, targets: WorksheetBounds[], vertical: number[], horizontal: number[], tolerance = 6) {
  const edges = (start: number, size: number) => [start, start + size / 2, start + size];
  const match = (start: number, size: number, candidates: number[]) => {
    const closest = edges(start, size).flatMap((edge) => candidates.map((guide) => ({ guide, offset: guide - edge }))).sort((a, b) => Math.abs(a.offset) - Math.abs(b.offset))[0];
    return closest && Math.abs(closest.offset) <= tolerance ? closest : undefined;
  };
  const x = match(moving.x, moving.width, [...vertical, ...targets.flatMap((target) => edges(target.x, target.width))]);
  const y = match(moving.y, moving.height, [...horizontal, ...targets.flatMap((target) => edges(target.y, target.height))]);
  return { x: moving.x + (x?.offset ?? 0), y: moving.y + (y?.offset ?? 0), guides: { x: x?.guide, y: y?.guide } };
}

export function boundedWorksheetDelta(items: Array<{ x: number; y: number; width: number; height: number }>, dx: number, dy: number) {
  if (!items.length) return { dx: 0, dy: 0 };
  const minX = Math.min(...items.map((item) => item.x));
  const minY = Math.min(...items.map((item) => item.y));
  const maxX = Math.max(...items.map((item) => item.x + item.width));
  const maxY = Math.max(...items.map((item) => item.y + item.height));
  return { dx: Math.max(-minX, Math.min(WORKSHEET_WIDTH - maxX, dx)), dy: Math.max(-minY, Math.min(WORKSHEET_HEIGHT - maxY, dy)) };
}
