import { describe, expect, it } from "vitest";
import { reduceDocumentHistory, type DocumentHistory } from "./document-history";

const initial = (): DocumentHistory<{ text: string; x: number; height: number }> => ({ value: { text: "Avant", x: 10, height: 40 }, past: [], group: null, revision: 0 });
describe("document undo", () => {
  it("undoes a complete drag as one action, including multiple fields", () => {
    let state = initial();
    for (const x of [20, 30, 45]) state = reduceDocumentHistory(state, { kind: "update", key: "x", next: x, group: 1, record: true });
    state = reduceDocumentHistory(state, { kind: "update", key: "text", next: "Après", group: 1, record: true });
    expect(state.past).toHaveLength(1);
    expect(reduceDocumentHistory(state, { kind: "undo" }).value).toEqual(initial().value);
  });
  it("keeps automatic layout out of undo and allows several successive undos", () => {
    let state = reduceDocumentHistory(initial(), { kind: "update", key: "height", next: 20, group: 0, record: false });
    expect(state.past).toHaveLength(0);
    state = reduceDocumentHistory(state, { kind: "update", key: "text", next: "Un texte plus long", group: 1, record: true });
    state = reduceDocumentHistory(state, { kind: "update", key: "height", next: 60, group: 1, record: false });
    state = reduceDocumentHistory(state, { kind: "update", key: "x", next: 25, group: 2, record: true });
    state = reduceDocumentHistory(state, { kind: "undo" });
    expect(state.value).toEqual({ text: "Un texte plus long", height: 60, x: 10 });
    state = reduceDocumentHistory(state, { kind: "undo" });
    expect(state.value).toEqual({ text: "Avant", height: 20, x: 10 });
    expect(state.past).toHaveLength(0);
  });
  it("ignores no-op updates and records fresh edits after undo", () => {
    const state = initial();
    expect(reduceDocumentHistory(state, { kind: "update", key: "x", next: (x: number) => x, group: 1, record: true })).toBe(state);
    const edited = reduceDocumentHistory(state, { kind: "update", key: "x", next: 50, group: 1, record: true });
    const undone = reduceDocumentHistory(edited, { kind: "undo" });
    expect(reduceDocumentHistory(undone, { kind: "update", key: "text", next: "Nouveau", group: 2, record: true }).past).toHaveLength(1);
  });
});
