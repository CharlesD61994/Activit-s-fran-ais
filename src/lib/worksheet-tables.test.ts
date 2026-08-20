import { describe, expect, it } from "vitest";
import type { TreeAnalysisTable } from "@/types";
import { tableHasInteraction } from "./worksheet-tables";

describe("tableHasInteraction", () => {
  it("makes any cell with a correction-layer answer interactive", () => {
    const table: TreeAnalysisTable = {
      id: "table",
      pageId: "page",
      x: 0,
      y: 0,
      width: 300,
      rows: 1,
      columns: 1,
      cells: [{ text: "Qui?", answer: "Oui", isCorrect: false, role: "text" }]
    };
    expect(tableHasInteraction(table)).toBe(true);
  });
});
