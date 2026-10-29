import { PDFDocument } from "pdf-lib";

/** Keep the rendered pages intact rather than redrawing their borders as PDF vectors. */
export async function createWorksheetPdf(pageImages: string[], title: string) {
  if (!pageImages.length) throw new Error("Aucune page à exporter.");
  const document = await PDFDocument.create();
  document.setTitle(title);
  document.setCreator("Alinéa - Activités de français");
  for (const image of pageImages) {
    const png = await document.embedPng(image);
    const page = document.addPage([612, 792]);
    page.drawImage(png, { x: 0, y: 0, width: 612, height: 792 });
  }
  return document.save();
}
