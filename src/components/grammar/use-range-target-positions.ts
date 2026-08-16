"use client";

import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";

export type RangeSegment = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RangePosition = {
  x: number;
  y: number;
  width: number;
  height: number;
  startX: number;
  startY: number;
  startHeight: number;
  markStartY: number;
  markStartHeight: number;
  endX: number;
  endY: number;
  endHeight: number;
  markEndY: number;
  markEndHeight: number;
  segments: RangeSegment[];
};

type RangeTarget = { id: string; start: number; end: number };
type RangeToken = {
  id: string;
  text: string;
  start: number;
  end: number;
  isWord: boolean;
};
type RectMetrics = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  height: number;
};

function positionsAreEqual(
  current: Record<string, RangePosition>,
  next: Record<string, RangePosition>
) {
  const currentKeys = Object.keys(current);
  const nextKeys = Object.keys(next);
  if (currentKeys.length !== nextKeys.length) return false;

  const closeEnough = (left: number, right: number) =>
    Math.abs(left - right) < 0.1;
  const scalarKeys: Array<Exclude<keyof RangePosition, "segments">> = [
    "x", "y", "width", "height", "startX", "startY", "startHeight",
    "markStartY", "markStartHeight", "endX", "endY", "endHeight",
    "markEndY", "markEndHeight"
  ];

  return nextKeys.every((key) => {
    const previous = current[key];
    const incoming = next[key];
    if (!previous || !incoming) return false;
    if (scalarKeys.some((metric) => !closeEnough(previous[metric], incoming[metric]))) {
      return false;
    }
    if (previous.segments.length !== incoming.segments.length) return false;
    return incoming.segments.every((segment, index) => {
      const previousSegment = previous.segments[index];
      return previousSegment != null &&
        closeEnough(previousSegment.x, segment.x) &&
        closeEnough(previousSegment.y, segment.y) &&
        closeEnough(previousSegment.width, segment.width) &&
        closeEnough(previousSegment.height, segment.height);
    });
  });
}

export function fitRectToGlyphHeight(
  rect: RectMetrics,
  fontSize: number
): RectMetrics {
  const glyphHeight = Math.min(rect.height, Math.max(1, fontSize * 1.08));
  const verticalInset = (rect.height - glyphHeight) / 2;
  return {
    left: rect.left,
    right: rect.right,
    top: rect.top + verticalInset,
    bottom: rect.bottom - verticalInset,
    height: glyphHeight
  };
}

export function isMeasurableRangeToken(token: RangeToken) {
  return token.isWord || token.text.trim().length > 0;
}

export function buildRangeSegments(
  rects: RectMetrics[],
  surface: Pick<RectMetrics, "left" | "top">
) {
  const lines: RectMetrics[][] = [];

  rects.forEach((rect) => {
    const line = lines.find(
      (candidate) =>
        Math.abs(candidate[0].top - rect.top) <
        Math.min(candidate[0].height, rect.height) * .5
    );
    if (line) line.push(rect);
    else lines.push([rect]);
  });

  return lines.map((line) => {
    const left = Math.min(...line.map((rect) => rect.left));
    const right = Math.max(...line.map((rect) => rect.right));
    const top = Math.min(...line.map((rect) => rect.top));
    const bottom = Math.max(...line.map((rect) => rect.bottom));
    return {
      x: left - surface.left,
      y: top - surface.top,
      width: right - left,
      height: bottom - top
    };
  });
}

export function useRangeTargetPositions(
  surfaceRef: RefObject<HTMLElement | null>,
  targets: RangeTarget[],
  tokens: RangeToken[],
  tokenAttribute: string
) {
  const [positions, setPositions] = useState<Record<string, RangePosition>>({});

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;

    const update = () => {
      const surfaceRect = surface.getBoundingClientRect();
      const next: Record<string, RangePosition> = {};

      targets.forEach((target) => {
        const elements = tokens
          .filter(
            (token) =>
              isMeasurableRangeToken(token) &&
              token.start < target.end &&
              token.end > target.start
          )
          .map((token) =>
            surface.querySelector<HTMLElement>(
              `[${tokenAttribute}="${token.id}"]`
            )
          )
          .filter((element): element is HTMLElement => Boolean(element));
        if (!elements.length) return;

        const rects = elements.map((element) => element.getBoundingClientRect());
        const glyphRects = elements.map((element, index) => {
          const fontSize = Number.parseFloat(
            window.getComputedStyle(element).fontSize
          );
          return fitRectToGlyphHeight(
            rects[index],
            Number.isFinite(fontSize) ? fontSize : rects[index].height
          );
        });
        const first = rects[0];
        const last = rects[rects.length - 1];
        const firstGlyph = glyphRects[0];
        const lastGlyph = glyphRects[glyphRects.length - 1];
        const minLeft = Math.min(...rects.map((rect) => rect.left));
        const maxRight = Math.max(...rects.map((rect) => rect.right));
        const minTop = Math.min(...rects.map((rect) => rect.top));
        const maxBottom = Math.max(...rects.map((rect) => rect.bottom));
        const sameLine =
          Math.abs(first.top - last.top) <
          Math.min(first.height, last.height) * .5;

        next[target.id] = {
          x: sameLine
            ? (first.left + last.right) / 2 - surfaceRect.left
            : (first.left + first.right) / 2 - surfaceRect.left,
          // Les étiquettes se placent par rapport aux lettres visibles, pas à
          // la boîte de ligne qui contient aussi l'interligne.
          y: firstGlyph.top - surfaceRect.top,
          width: maxRight - minLeft,
          height: maxBottom - minTop,
          startX: first.left - surfaceRect.left,
          startY: first.top - surfaceRect.top,
          startHeight: first.height,
          markStartY: firstGlyph.top - surfaceRect.top,
          markStartHeight: firstGlyph.height,
          endX: last.right - surfaceRect.left,
          endY: last.top - surfaceRect.top,
          endHeight: last.height,
          markEndY: lastGlyph.top - surfaceRect.top,
          markEndHeight: lastGlyph.height,
          // Les cadres suivent les glyphes; les crochets et les gestes gardent
          // les rectangles de ligne complets afin de rester faciles à tracer.
          segments: buildRangeSegments(glyphRects, surfaceRect)
        };
      });

      // Une mesure identique ne doit pas provoquer un nouveau rendu. C'est
      // particulièrement important pour les aperçus d'impression, dont les
      // listes de cibles peuvent être recréées par leur composant parent.
      setPositions((current) => positionsAreEqual(current, next) ? current : next);
    };

    update();
    const frame = typeof window.requestAnimationFrame === "function"
      ? window.requestAnimationFrame(update)
      : null;
    const observer = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(update);
    observer?.observe(surface);
    surface
      .querySelectorAll<HTMLElement>(`[${tokenAttribute}]`)
      .forEach((element) => observer?.observe(element));
    const fontsReady = document.fonts?.ready.then(update);
    window.addEventListener("resize", update);

    return () => {
      if (frame !== null && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(frame);
      }
      observer?.disconnect();
      window.removeEventListener("resize", update);
      void fontsReady;
    };
  }, [surfaceRef, targets, tokenAttribute, tokens]);

  return positions;
}
