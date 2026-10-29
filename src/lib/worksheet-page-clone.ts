export function cloneWorksheetPage(canvas: HTMLElement) {
  const clone = canvas.cloneNode(true) as HTMLElement;
  clone.classList.add("worksheet-print-clone");
  clone.querySelectorAll(".selected,.cell-selected").forEach((element) => element.classList.remove("selected", "cell-selected"));
  clone.querySelectorAll("[contenteditable]").forEach((element) => {
    element.removeAttribute("contenteditable");
    element.removeAttribute("spellcheck");
  });
  clone.querySelectorAll([
    "button",
    ".tree-analysis-text-delete",
    ".tree-analysis-text-resize",
    ".tree-analysis-text-move-handle",
    ".tree-analysis-alignment-guide",
    ".tree-analysis-delete-table",
    ".worksheet-selection-marquee",
    ".worksheet-group-selection-outline",
    ".worksheet-text-move-edge",
    ".worksheet-table-move-edge",
    ".worksheet-table-resize",
    ".worksheet-lines-delete",
    ".worksheet-lines-resize",
    ".worksheet-checkbox-delete",
    ".worksheet-image-delete",
    ".worksheet-image-resize",
    ".worksheet-image-controls",
    ".worksheet-band-delete",
    ".worksheet-score-delete",
    ".worksheet-score-resize"
  ].join(",")).forEach((element) => element.remove());
  return clone;
}