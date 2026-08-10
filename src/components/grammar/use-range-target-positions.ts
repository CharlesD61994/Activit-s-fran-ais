"use client";
import { useEffect, useState } from "react";
import type { RefObject } from "react";
export type RangePosition = { x: number; y: number; width: number; height: number };
type RangeTarget = { id: string; start: number; end: number };
type RangeToken = { id: string; start: number; end: number; isWord: boolean };
export function useRangeTargetPositions(surfaceRef: RefObject<HTMLElement | null>, targets: RangeTarget[], tokens: RangeToken[], tokenAttribute: string) {
  const [positions, setPositions] = useState<Record<string, RangePosition>>({});
  useEffect(() => {
    const surface = surfaceRef.current; if (!surface) return;
    const update = () => { const surfaceRect = surface.getBoundingClientRect(); const next: Record<string, RangePosition> = {};
      targets.forEach((target) => { const elements = tokens.filter((token) => token.isWord && token.start < target.end && token.end > target.start).map((token) => surface.querySelector<HTMLElement>(`[${tokenAttribute}="${token.id}"]`)).filter((element): element is HTMLElement => Boolean(element)); if (!elements.length) return; const rects = elements.map((element) => element.getBoundingClientRect()); const minLeft = Math.min(...rects.map((rect) => rect.left)); const maxRight = Math.max(...rects.map((rect) => rect.right)); const minTop = Math.min(...rects.map((rect) => rect.top)); const maxBottom = Math.max(...rects.map((rect) => rect.bottom)); next[target.id] = { x: (minLeft + maxRight) / 2 - surfaceRect.left, y: minTop - surfaceRect.top, width: maxRight - minLeft, height: maxBottom - minTop }; }); setPositions(next); };
    const frame = window.requestAnimationFrame(update); const observer = new ResizeObserver(update); observer.observe(surface); window.addEventListener("resize", update);
    return () => { window.cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("resize", update); };
  }, [surfaceRef, targets, tokenAttribute, tokens]);
  return positions;
}
