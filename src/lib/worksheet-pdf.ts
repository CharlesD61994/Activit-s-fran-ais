import { toPng } from "html-to-image";
import { createWorksheetPdf } from "./worksheet-pdf-document";

export async function downloadWorksheetPdf(pages: HTMLElement[], title: string, mode: "student" | "answer") {
  const holder = document.createElement("div");
  holder.className = "worksheet-editor worksheet-pdf-capture";
  holder.setAttribute("aria-hidden", "true");
  Object.assign(holder.style, { position: "fixed", left: "-10000px", top: "0", width: "816px", pointerEvents: "none" });
  document.body.appendChild(holder);
  try {
    await document.fonts.ready;
    const images: string[] = [];
    for (const page of pages) {
      for (const [property, value] of Object.entries({ width: "816px", height: "1056px", margin: "0", transform: "none", boxShadow: "none" })) page.style.setProperty(property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`), value, "important");
      holder.replaceChildren(page);
      await Promise.all(Array.from(page.querySelectorAll("img")).map((image) => image.decode()));
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      images.push(await toPng(page, { backgroundColor: "#ffffff", pixelRatio: 4, width: 816, height: 1056 }));
    }
    const bytes = await createWorksheetPdf(images, title);
    const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const name = title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim() || "Feuille d’activité";
    link.href = url;
    link.download = `${name} - ${mode === "answer" ? "corrigé" : "élève"}.pdf`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  } finally { holder.remove(); }
}
