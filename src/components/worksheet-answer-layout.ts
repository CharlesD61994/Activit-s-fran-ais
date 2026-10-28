"use client";

import { useLayoutEffect } from "react";
import type { RefObject } from "react";
import type { WorksheetAnswerLines } from "@/types";

/** Align the real text baseline with each rule, including after a page zoom. */
export function useWorksheetAnswerBaseline(ref: RefObject<HTMLElement | null>, item: WorksheetAnswerLines) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const probe = document.createElement("span");
      probe.style.cssText = "display:inline-block;width:0;height:0;padding:0;margin:0;border:0;vertical-align:baseline;font-size:0;line-height:0";
      element.prepend(probe);
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const scale = rect.width / parseFloat(style.width) || 1;
      const baseline = (probe.getBoundingClientRect().top - rect.top) / scale;
      probe.remove();
      const lineHeight = parseFloat(style.lineHeight);
      // Store a font-relative offset so print clones also scale with the page.
      const fontSize = parseFloat(style.fontSize);
      // Leave a small gap above the rule, including under descending letters.
      if (fontSize > 0) element.style.top = `${(lineHeight - baseline) / fontSize - .25}em`;
    };
    measure();
    void document.fonts?.ready.then(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, item.answerFontSize, item.answerBold, item.lineSpacing, item.width]);
}

export function pasteWorksheetPlainText(event: React.ClipboardEvent<HTMLElement>) {
  event.preventDefault();
  document.execCommand("insertText", false, event.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n"));
}
