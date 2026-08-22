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
  // The editor renders the image as a draggable page element, then inserts a
  // float spacer inside the text box. A float can only reserve one side of the
  // line, so we reserve the side occupied by the image up to its far edge. This
  // keeps text from running under the image without creating a full-width blank
  // band when the image sits in the middle of a paragraph.
  const reservedWidth = side === "left"
    ? image.x + image.width - box.x
    : box.x + box.width - image.x;

  return {
    side,
    width: Math.max(0, Math.min(box.width, reservedWidth)) + 8,
    height: Math.max(0, image.y - box.y) + Math.max(0, overlapBottom - overlapTop) + 6,
    marginTop: Math.max(0, image.y - box.y)
  };
}
