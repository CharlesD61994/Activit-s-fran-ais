import { describe, expect, it } from "vitest";
import { resizeWorksheetImage } from "./worksheet-images";
import type { WorksheetImage } from "@/types";
const image: WorksheetImage = { id: "image", pageId: "page", x: 100, y: 100, width: 200, height: 100, src: "", alt: "" };
describe("worksheet image resize", () => {
  it("keeps proportions and anchors the opposite corner", () => {
    const result = resizeWorksheetImage(image, -100, -50, "top-left");
    expect(result).toMatchObject({ x: 0, y: 50, width: 300, height: 150 });
    expect(result.x + result.width).toBe(300);
    expect(result.y + result.height).toBe(200);
  });
  it("stays inside the page when dragged past its edge", () => {
    const result = resizeWorksheetImage(image, 5000, 5000, "bottom-right");
    expect(result.width / result.height).toBe(2);
    expect(result.x + result.width).toBeLessThanOrEqual(1056);
    expect(result.y + result.height).toBeLessThanOrEqual(816);
  });
  it("allows independent dimensions with Shift, without negative sizes", () => {
    expect(resizeWorksheetImage(image, 100, 0, "bottom-right", false)).toMatchObject({ width: 300, height: 100 });
    const small = resizeWorksheetImage(image, -1000, -1000, "bottom-right", false);
    expect(small.width).toBe(24); expect(small.height).toBe(24);
  });
});
