import type { TreeAnalysisTextBox, WorksheetImage } from "@/types";

export type WorksheetTextWrap = {
  side: "left" | "right";
  width: number;
  height: number;
  marginTop: number;
};

export function worksheetTextWrap(
  box: TreeAnalysisTextBox,
  images: WorksheetImage[]
): WorksheetTextWrap | undefined {
  const image = images.find((candidate) => {
    const mode = candidate.layoutMode ?? (candidate.wrapText ? "wrap" : "front");
    if (mode !== "wrap" || candidate.pageId !== box.pageId) return false;
    return candidate.x < box.x + box.width &&
      candidate.x + candidate.width > box.x &&
      candidate.y < box.y + box.height &&
      candidate.y + candidate.height > box.y;
  });
  if (!image) return undefined;

  const side = image.x + image.width / 2 <= box.x + box.width / 2 ? "left" : "right";
  const overlapTop = Math.max(box.y, image.y);
  const overlapBottom = Math.min(box.y + box.height, image.y + image.height);

  // A CSS float only reserves space from one outside edge. Reserving merely
  // the image width leaves a narrow strip of text behind an image positioned
  // inside the text box. Word-style wrapping instead keeps the whole side of
  // the line clear up to the image's far edge.
  const reservedWidth = side === "left"
    ? image.x + image.width - box.x
    : box.x + box.width - image.x;

  return {
    side,
    width: Math.max(0, reservedWidth) + 10,
    height: Math.max(0, overlapBottom - overlapTop) + 8,
    marginTop: Math.max(0, image.y - box.y)
  };
}
