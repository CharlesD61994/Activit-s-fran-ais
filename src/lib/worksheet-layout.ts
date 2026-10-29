// Existing worksheet coordinates use a 1056 × 816 grid on a portrait page.
export const WORKSHEET_WIDTH = 1056;
export const WORKSHEET_HEIGHT = 816;
const WORKSHEET_PAGE_HEIGHT_MM = 11 * 25.4;
export const worksheetSpacingInMm = (spacing: number) => spacing / WORKSHEET_HEIGHT * WORKSHEET_PAGE_HEIGHT_MM;
export const worksheetSpacingFromMm = (millimeters: number) => millimeters / WORKSHEET_PAGE_HEIGHT_MM * WORKSHEET_HEIGHT;
export const DEFAULT_WORKSHEET_LINE_SPACING = worksheetSpacingFromMm(9);
export function worksheetVerticalLength(spacing: number) {
  return `${spacing / WORKSHEET_HEIGHT * (11 / 8.5) * 100}cqw`;
}
export const worksheetAnswerLineHeight = worksheetVerticalLength;

type WorksheetBounds = { x: number; y: number; width: number; height: number };
export function worksheetPointFromClient(rect: { left: number; top: number; width: number; height: number }, clientX: number, clientY: number) {
  if (rect.width <= 0 || rect.height <= 0 || clientX < rect.left || clientX > rect.left + rect.width || clientY < rect.top || clientY > rect.top + rect.height) return null;
  return { x: (clientX - rect.left) / rect.width * WORKSHEET_WIDTH, y: (clientY - rect.top) / rect.height * WORKSHEET_HEIGHT };
}

export function worksheetPasteDelta(items: WorksheetBounds[], position: { x: number; y: number }) {
  if (!items.length) return { dx: 0, dy: 0 };
  return boundedWorksheetDelta(items, position.x - Math.min(...items.map((item) => item.x)), position.y - Math.min(...items.map((item) => item.y)));
}

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
