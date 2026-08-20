import type { TreeAnalysisTable, TreeAnalysisTableCell } from "@/types";

export type WorksheetTableTemplate = NonNullable<TreeAnalysisTable["kind"]>;

const cell = (text = "", patch: Partial<TreeAnalysisTableCell> = {}): TreeAnalysisTableCell => ({
  text,
  isCorrect: false,
  role: "text",
  background: "white",
  textColor: "black",
  textAlign: "center",
  verticalAlign: "center",
  fontSize: 17,
  ...patch
});

export function tableTemplateLabel(kind: WorksheetTableTemplate) {
  return {
    free: "Tableau libre",
    structured: "Réponse structurée",
    choice: "Choix de réponse",
    sequence: "Ordre ou classement",
    association: "Association ou rôle",
    compact_rubric: "Points par bonne réponse",
    rubric: "Grille de notation"
  }[kind];
}

export function createWorksheetTable(input: {
  kind: WorksheetTableTemplate;
  pageId: string;
  rows: number;
  columns: number;
  maxPoints: number;
  dimension: string;
}): TreeAnalysisTable {
  const id = crypto.randomUUID();
  const base = { id, pageId: input.pageId, x: 150, y: 330, width: 756, kind: input.kind };

  if (input.kind === "structured") {
    const rows = Math.max(2, input.rows);
    const cells = Array.from({ length: rows * 2 }, () => cell());
    cells[0] = cell("Situation initiale", { rowSpan: rows, bold: true });
    for (let row = 1; row < rows; row += 1) cells[row * 2] = cell("", { columnSpan: 0, rowSpan: 0 });
    for (let row = 0; row < rows; row += 1) cells[row * 2 + 1] = cell(["Qui?", "Où?", "Quand?", "Quoi?"][row] ?? "Réponse", { role: "answer", textAlign: "left", answer: "" });
    return { ...base, rows, columns: 2, cells, columnWidths: [190, 566], rowHeights: Array(rows).fill(54) };
  }

  if (input.kind === "choice") {
    const columns = Math.max(2, input.columns);
    return { ...base, rows: 1, columns, cells: Array.from({ length: columns }, (_, index) => cell(`Choix ${index + 1}`, { role: "choice" })), columnWidths: Array(columns).fill(756 / columns), rowHeights: [58] };
  }

  if (input.kind === "sequence" || input.kind === "association") {
    const rows = Math.max(2, input.rows);
    const leftRole = input.kind === "sequence" ? "order" : "text";
    const cells = Array.from({ length: rows * 2 }, (_, index) => index % 2 === 0
      ? cell(input.kind === "sequence" ? "" : `Élément ${Math.floor(index / 2) + 1}`, { role: leftRole, bold: input.kind === "association" })
      : cell(input.kind === "sequence" ? `Énoncé ${Math.floor(index / 2) + 1}` : "Réponse", { role: "answer", textAlign: "left", answer: "" }));
    return { ...base, rows, columns: 2, cells, columnWidths: input.kind === "sequence" ? [72, 684] : [250, 506], rowHeights: Array(rows).fill(52) };
  }

  if (input.kind === "compact_rubric") {
    return {
      ...base,
      rows: 2,
      columns: 2,
      cells: [
        cell(input.dimension.toUpperCase(), { role: "header", columnSpan: 2, background: "black", textColor: "white", bold: true, textAlign: "left" }),
        cell("", { columnSpan: 0 }),
        cell("1 point par bonne réponse", { role: "criterion", textAlign: "left" }),
        cell(`/${input.maxPoints}`, { role: "total", bold: true })
      ],
      columnWidths: [676, 80],
      rowHeights: [38, 48]
    };
  }

  if (input.kind === "rubric") {
    const levels = Math.max(2, input.columns);
    const columns = levels + 1;
    const cells = Array.from({ length: 3 * columns }, () => cell());
    cells[0] = cell(input.dimension.toUpperCase(), { role: "header", columnSpan: levels, background: "black", textColor: "white", bold: true, textAlign: "left" });
    for (let index = 1; index < levels; index += 1) cells[index] = cell("", { columnSpan: 0 });
    cells[levels] = cell(`/${input.maxPoints}`, { role: "total", rowSpan: 3, bold: true, fontSize: 19 });
    cells[columns + levels] = cell("", { columnSpan: 0, rowSpan: 0 });
    cells[columns * 2 + levels] = cell("", { columnSpan: 0, rowSpan: 0 });
    for (let index = 0; index < levels; index += 1) {
      const points = Math.max(0, input.maxPoints - index);
      cells[columns + index] = cell(`${points} point${points === 1 ? "" : "s"}`, { role: "score", background: "gray", bold: true });
      cells[columns * 2 + index] = cell(index === 0 ? "Réponse complète et précise." : index === levels - 1 ? "Réponse absente ou inadéquate." : "Réponse partielle.", { role: "criterion", fontSize: 14 });
    }
    return { ...base, rows: 3, columns, cells, columnWidths: [...Array(levels).fill(676 / levels), 80], rowHeights: [38, 42, 92] };
  }

  const rows = Math.max(1, input.rows);
  const columns = Math.max(1, input.columns);
  return { ...base, rows, columns, cells: Array.from({ length: rows * columns }, () => cell()), columnWidths: Array(columns).fill(756 / columns), rowHeights: Array(rows).fill(54) };
}

export function normalizedColumnWidths(table: TreeAnalysisTable) {
  const width = table.width ?? 360;
  if (table.columnWidths?.length === table.columns) return table.columnWidths;
  return Array(table.columns).fill(width / table.columns);
}

export function normalizedRowHeights(table: TreeAnalysisTable) {
  if (table.rowHeights?.length === table.rows) return table.rowHeights;
  return Array(table.rows).fill(54);
}

export function tableHasInteraction(table: TreeAnalysisTable) {
  return table.cells.some((item) => item.isCorrect || ((item.role === "answer" || item.role === "order") && Boolean(item.answer?.trim())));
}
