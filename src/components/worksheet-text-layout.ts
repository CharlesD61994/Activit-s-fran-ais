"use client";

import { useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import { WORKSHEET_HEIGHT } from "@/lib/worksheet-layout";

/** Fit old and new boxes to their rendered text, independent of saved heights. */
export function useWorksheetTextHeight(ref: RefObject<HTMLDivElement | null>, onHeight?: (height: number) => void) {
  const callback = useRef(onHeight);
  callback.current = onHeight;
  useLayoutEffect(() => {
    const content = ref.current;
    const box = content?.parentElement;
    if (!content || !box) return;
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      const rect = content.getBoundingClientRect();
      const style = getComputedStyle(box);
      const scale = box.getBoundingClientRect().width / parseFloat(style.width) || 1;
      const fontSize = parseFloat(style.fontSize);
      if (fontSize > 0) box.style.setProperty("--worksheet-text-fit-height", `${rect.height / scale / fontSize}em`);
      const page = box.closest(".worksheet-canvas");
      if (page && page.getBoundingClientRect().height > 0) callback.current?.(rect.height / page.getBoundingClientRect().height * WORKSHEET_HEIGHT);
    };
    measure();
    void document.fonts?.ready.then(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => { disposed = true; observer.disconnect(); };
  }, [ref]);
}
