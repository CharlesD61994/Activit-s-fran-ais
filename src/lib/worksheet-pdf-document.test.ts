import { describe, expect, it } from "vitest";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { createWorksheetPdf } from "./worksheet-pdf-document";

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC";

describe("worksheet PDF document", () => {
  it("includes every rendered page at full Letter size without margins", async () => {
    const document = await PDFDocument.load(await createWorksheetPdf([png, png], "Mon corrigé"));
    expect(document.getTitle()).toBe("Mon corrigé");
    expect(document.getPages().map((page) => page.getSize())).toEqual([{ width: 612, height: 792 }, { width: 612, height: 792 }]);
    for (const page of document.getPages()) expect(page.node.Resources()?.lookup(PDFName.of("XObject"), PDFDict).keys()).toHaveLength(1);
  });
  it("rejects an empty export instead of downloading a blank page", async () => {
    await expect(createWorksheetPdf([], "Vide")).rejects.toThrow("Aucune page");
  });
});
