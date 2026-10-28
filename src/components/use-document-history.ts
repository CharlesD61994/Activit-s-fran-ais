"use client";

import { useCallback, useMemo, useReducer, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import { reduceDocumentHistory, type DocumentHistory } from "@/lib/document-history";

export function useDocumentHistory<T extends object>(initial: () => T) {
  const [history, dispatch] = useReducer(reduceDocumentHistory<T>, undefined, (): DocumentHistory<T> => ({ value: initial(), past: [], future: [], group: null, revision: 0 }));
  const action = useRef(0);
  const typing = useRef<{ target: EventTarget | null; time: number }>({ target: null, time: 0 });
  const keys = useRef(Object.keys(history.value));
  const beginAction = useCallback((target: EventTarget | null = null) => {
    const now = Date.now();
    if (!target || typing.current.target !== target || now - typing.current.time > 1000) action.current += 1;
    typing.current = { target, time: now };
  }, []);
  const setters = useMemo(() => Object.fromEntries(keys.current.map((key) => [key,
    (next: unknown) => dispatch({ kind: "update", key: key as keyof T, next, group: action.current, record: true })
  ])) as { [K in keyof T]: Dispatch<SetStateAction<T[K]>> }, []); // The document's fields stay fixed.
  const updateDerived = useCallback(<K extends keyof T>(key: K, next: SetStateAction<T[K]>) => dispatch({ kind: "update", key, next, group: action.current, record: false }), []);
  const undo = useCallback(() => { beginAction(); dispatch({ kind: "undo" }); }, [beginAction]);
  const redo = useCallback(() => { beginAction(); dispatch({ kind: "redo" }); }, [beginAction]);
  return { ...history, setters, beginAction, updateDerived, undo, redo, canUndo: history.past.length > 0, canRedo: history.future.length > 0 };
}
