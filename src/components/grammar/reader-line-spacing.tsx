"use client";

import { createElement, useLayoutEffect, useState } from "react";
import type { RefObject } from "react";
import { isPrincipalGroup } from "./group-label-layout";
import { rangeMarkNesting } from "./range-mark-nesting";
import { normalizeRangeTargets } from "./range-reader-layout";

type Group = { id: string; start: number; end: number };
type Token = { id: string; start: number; end: number; text: string };

export function principalLineClearances(groups: Group[], lineStarts: number[], enclosedIds: string[]) {
  const starts = [...new Set([0, ...lineStarts])].sort((a, b) => a - b);
  const result: Record<number, number> = {};
  for (const group of groups) {
    if (!enclosedIds.includes(group.id) || !isPrincipalGroup(group, groups)) continue;
    const clearance = Math.max(60, 16 + rangeMarkNesting(group, groups).verticalInset * 2);
    for (let index = 1; index < starts.length; index += 1) {
      if (group.start >= starts[index] && group.start < (starts[index + 1] ?? Infinity)) {
        result[starts[index]] = Math.max(result[starts[index]] ?? 0, clearance);
      }
    }
  }
  return result;
}

/** Read actual wrapping, including readers whose agreement layout uses no <br>. */
export function useReaderLineClearances(
  surfaceRef: RefObject<HTMLElement | null>, tokens: Token[], groups: Group[], enclosedIds: string[], tokenAttribute: string
) {
  const [clearances, setClearances] = useState<Record<number, number>>({});
  const groupKey = JSON.stringify(groups.map(({ id, start, end }) => ({ id, start, end })));
  const enclosedKey = JSON.stringify(enclosedIds);
  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const update = () => {
      const starts: number[] = [];
      let rowCenter: number | undefined;
      for (const token of tokens) {
        if (!token.text.trim()) continue;
        const element = surface.querySelector<HTMLElement>(`[${tokenAttribute}="${token.id}"]`);
        if (!element) continue;
        const glyph = element.querySelector<HTMLElement>("[data-word-glyph]") ?? element;
        const rect = glyph.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        if (rowCenter === undefined) rowCenter = center;
        else if (center - rowCenter > rect.height * .6) {
          starts.push(token.start);
          rowCenter = center;
        }
      }
      const next = principalLineClearances(normalizeRangeTargets(tokens, JSON.parse(groupKey)), starts, JSON.parse(enclosedKey));
      setClearances((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
    };
    update();
    const frame = window.requestAnimationFrame(update);
    const observer = new ResizeObserver(update);
    observer.observe(surface);
    surface.querySelectorAll<HTMLElement>(`[${tokenAttribute}]`).forEach((element) => observer.observe(element));
    document.fonts?.ready.then(update);
    window.addEventListener("resize", update);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [surfaceRef, tokens, groupKey, enclosedKey, tokenAttribute]);
  return clearances;
}

export function ReaderLineSpacing({ height }: { height?: number }) {
  if (!height) return null;
  return createElement("span", { "aria-hidden": true, className: "reader-line-spacing", style: { height: `calc(var(--reader-line-base-height, 1.48em) + ${height}px)` } });
}
