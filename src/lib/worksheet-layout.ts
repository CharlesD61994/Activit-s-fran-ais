// Existing worksheet coordinates use a 1056 × 816 grid on a portrait page.
export const WORKSHEET_WIDTH = 1056;
export const WORKSHEET_HEIGHT = 816;
export function worksheetVerticalLength(spacing: number) {
  return `${spacing / WORKSHEET_HEIGHT * (11 / 8.5) * 100}cqw`;
}
export const worksheetAnswerLineHeight = worksheetVerticalLength;

export function boundedWorksheetDelta(items: Array<{ x: number; y: number; width: number; height: number }>, dx: number, dy: number) {
  if (!items.length) return { dx: 0, dy: 0 };
  const minX = Math.min(...items.map((item) => item.x));
  const minY = Math.min(...items.map((item) => item.y));
  const maxX = Math.max(...items.map((item) => item.x + item.width));
  const maxY = Math.max(...items.map((item) => item.y + item.height));
  return { dx: Math.max(-minX, Math.min(WORKSHEET_WIDTH - maxX, dx)), dy: Math.max(-minY, Math.min(WORKSHEET_HEIGHT - maxY, dy)) };
}
