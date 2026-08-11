"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState
} from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

type ReaderChromeSlot =
  | "viewTools"
  | "instruction"
  | "progress"
  | "contextTools"
  | "actions";

type ReaderChromeTargets = Record<ReaderChromeSlot, HTMLElement | null>;

type ReaderChromeContextValue = {
  targets: ReaderChromeTargets;
  setTarget: (slot: ReaderChromeSlot, node: HTMLElement | null) => void;
};

const emptyTargets: ReaderChromeTargets = {
  viewTools: null,
  instruction: null,
  progress: null,
  contextTools: null,
  actions: null
};

const ReaderChromeContext = createContext<ReaderChromeContextValue | null>(null);

export function ReaderChromeProvider({ children }: { children: ReactNode }) {
  const [targets, setTargets] = useState<ReaderChromeTargets>(emptyTargets);
  const setTarget = useCallback(
    (slot: ReaderChromeSlot, node: HTMLElement | null) => {
      setTargets((current) =>
        current[slot] === node ? current : { ...current, [slot]: node }
      );
    },
    []
  );
  const value = useMemo(() => ({ targets, setTarget }), [setTarget, targets]);

  return (
    <ReaderChromeContext.Provider value={value}>
      {children}
    </ReaderChromeContext.Provider>
  );
}

export function ReaderChromeTarget({
  slot,
  className
}: {
  slot: ReaderChromeSlot;
  className?: string;
}) {
  const context = useContext(ReaderChromeContext);
  const setTarget = context?.setTarget;
  const ref = useCallback(
    (node: HTMLDivElement | null) => setTarget?.(slot, node),
    [setTarget, slot]
  );

  return <div className={className} data-reader-chrome-slot={slot} ref={ref} />;
}

export function ReaderChromePortal({
  slot,
  children
}: {
  slot: ReaderChromeSlot;
  children: ReactNode;
}) {
  const context = useContext(ReaderChromeContext);
  const target = context?.targets[slot];
  return target ? createPortal(children, target) : null;
}
