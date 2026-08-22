import { describe, expect, it } from "vitest";
import type { TreeAnalysisTextBox, WorksheetImage } from "@/types";
import { worksheetTextWrap } from "./worksheet-images";

const box: TreeAnalysisTextBox = {
  id: "text",
  pageId: "page",
  x: 100,
  y: 100,
  width: 500,
  height: 240,
  text: "Un texte",
  fontSize: 20,
  annotations: []
};

describe("worksheetTextWrap", () => {
  it("reserves the left side up to the far edge of an image placed inside the text box", () => {
    const image: WorksheetImage = { id: "image", pageId: "page", x: 120, y: 130, width: 140, height: 100, src: "data:image/png;base64,x", alt: "", wrapText: true };
    expect(worksheetTextWrap(box, [image])).toEqual({ side: "left", width: 168, height: 136, marginTop: 30 });
  });

  it("reserves the right side up to the near edge of an image placed inside the text box", () => {
    const image: WorksheetImage = { id: "image", pageId: "page", x: 430, y: 130, width: 100, height: 100, src: "data:image/png;base64,x", alt: "", wrapText: true };
    expect(worksheetTextWrap(box, [image])).toEqual({ side: "right", width: 178, height: 136, marginTop: 30 });
  });

  it("ignores images on another page or with wrapping disabled", () => {
    const image: WorksheetImage = { id: "image", pageId: "other", x: 120, y: 130, width: 140, height: 100, src: "data:image/png;base64,x", alt: "", wrapText: true };
    expect(worksheetTextWrap(box, [image])).toBeUndefined();
    expect(worksheetTextWrap(box, [{ ...image, pageId: "page", wrapText: false }])).toBeUndefined();
  });

  it("uses the explicit layout mode for new worksheet images", () => {
    const image: WorksheetImage = { id: "image", pageId: "page", x: 120, y: 130, width: 140, height: 100, src: "data:image/png;base64,x", alt: "", wrapText: true, layoutMode: "front" };
    expect(worksheetTextWrap(box, [image])).toBeUndefined();
    expect(worksheetTextWrap(box, [{ ...image, layoutMode: "wrap" }])).toBeDefined();
  });
});
