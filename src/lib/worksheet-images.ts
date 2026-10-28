import type { TreeAnalysisTextBox, WorksheetImage } from "@/types";
import { WORKSHEET_WIDTH, WORKSHEET_HEIGHT } from "./worksheet-layout";

export type ImageResizeCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export function resizeWorksheetImage(image: WorksheetImage, dx: number, dy: number, corner: ImageResizeCorner, proportional = true) {
  const left = corner.endsWith("left");
  const top = corner.startsWith("top");
  const maxWidth = left ? image.x + image.width : WORKSHEET_WIDTH - image.x;
  const maxHeight = top ? image.y + image.height : WORKSHEET_HEIGHT - image.y;
  const requestedWidth = image.width + (left ? -dx : dx);
  const requestedHeight = image.height + (top ? -dy : dy);
  const clamp = (value: number, max: number) => Math.max(Math.min(24, max), Math.min(value, max));
  let width = clamp(requestedWidth, maxWidth);
  let height = clamp(requestedHeight, maxHeight);
  if (proportional) {
    const maxScale = Math.min(maxWidth / image.width, maxHeight / image.height);
    const minScale = Math.min(maxScale, Math.max(24 / image.width, 24 / image.height));
    const requestedScale = Math.abs(dx / image.width) >= Math.abs(dy / image.height) ? requestedWidth / image.width : requestedHeight / image.height;
    const scale = Math.max(minScale, Math.min(maxScale, requestedScale));
    width = image.width * scale; height = image.height * scale;
  }
  return { ...image, x: left ? image.x + image.width - width : image.x, y: top ? image.y + image.height - height : image.y, width, height };
}

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
