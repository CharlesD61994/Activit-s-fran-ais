export type DocumentHistory<T> = { value: T; past: T[]; group: number | null; revision: number };
export type DocumentHistoryAction<T> = { kind: "update"; key: keyof T; next: unknown; group: number; record: boolean } | { kind: "undo" };

export function reduceDocumentHistory<T>(state: DocumentHistory<T>, action: DocumentHistoryAction<T>): DocumentHistory<T> {
  if (action.kind === "undo") {
    if (!state.past.length) return state;
    return { value: state.past[state.past.length - 1], past: state.past.slice(0, -1), group: null, revision: state.revision + 1 };
  }
  const previous = state.value[action.key];
  const next = typeof action.next === "function" ? action.next(previous) : action.next;
  if (Object.is(previous, next) || JSON.stringify(previous) === JSON.stringify(next)) return state;
  const newStep = action.record && state.group !== action.group;
  return { ...state, value: { ...state.value, [action.key]: next }, past: newStep ? [...state.past.slice(-79), state.value] : state.past, group: action.record ? action.group : state.group };
}
