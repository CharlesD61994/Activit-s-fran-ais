"use client";
import { useEffect, useState } from "react";
import type { RefObject } from "react";
export type RangePosition = { x: number; y: number; width: number; height: number; startX: number; startY: number; startHeight: number; endX: number; endY: number; endHeight: number };
type RangeTarget = { id: string; start: number; end: number };
type RangeToken = { id: string; start: number; end: number; isWord: boolean };
export function useRangeTargetPositions(surfaceRef: RefObject<HTMLElement | null>, targets: RangeTarget[], tokens: RangeToken[], tokenAttribute: string) {
  const [positions, setPositions] = useState<Record<string, RangePosition>>({});
  useEffect(() => {
    const surface = surfaceRef.current; if (!surface) return;
    const update = () => { const surfaceRect = surface.getBoundingClientRect(); const next: Record<string, RangePosition> = {};
      targets.forEach((target) => { const elements = tokens.filter((token) => token.isWord && token.start < target.end && token.end > target.start).map((token) => surface.querySelector<HTMLElement>(`[${tokenAttribute}="${token.id}"]`)).filter((element): element is HTMLElement => Boolean(element)); if (!elements.length) return; const rects = elements.map((element) => element.getBoundingClientRect()); const first = rects[0], last = rects[rects.length - 1]; const minLeft = Math.min(...rects.map((rect) => rect.left)); const maxRight = Math.max(...rects.map((rect) => rect.right)); const minTop = Math.min(...rects.map((rect) => rect.top)); const maxBottom = Math.max(...rects.map((rect) => rect.bottom)); const sameLine = Math.abs(first.top - last.top) < Math.min(first.height, last.height) * .5; next[target.id] = { x: sameLine ? (first.left + last.right) / 2 - surfaceRect.left : (first.left + first.right) / 2 - surfaceRect.left, y: first.top - surfaceRect.top, width: maxRight - minLeft, height: maxBottom - minTop, startX: first.left - surfaceRect.left, startY: first.top - surfaceRect.top, startHeight: first.height, endX: last.right - surfaceRect.left, endY: last.top - surfaceRect.top, endHeight: last.height }; }); setPositions(next); };
    const frame = window.requestAnimationFrame(update); const observer = new ResizeObserver(update); observer.observe(surface); surface.querySelectorAll<HTMLElement>(`[${tokenAttribute}]`).forEach((element) => observer.observe(element)); const fontsReady = document.fonts?.ready.then(update); window.addEventListener("resize", update);
    return () => { window.cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("resize", update); void fontsReady; };
  }, [surfaceRef, targets, tokenAttribute, tokens]);
  return positions;
}
