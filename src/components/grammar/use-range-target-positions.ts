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
  startInkX?: number;
  endInkX?: number;
  startBandY?: number;
  startBandHeight?: number;
  endBandY?: number;
  endBandHeight?: number;
  startGap?: number;
  endGap?: number;
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

const EMPTY_LINE_BREAKS: readonly number[] = [];

function positionsAreEqual(
  current: Record<string, RangePosition>,
  next: Record<string, RangePosition>
) {
  const currentKeys = Object.keys(current);
  const nextKeys = Object.keys(next);
  if (currentKeys.length !== nextKeys.length) return false;

  const closeEnough = (left: number, right: number) =>
    Math.abs(left - right) < 0.1;
  const scalarKeys: Array<Exclude<keyof RangePosition, "segments" | "startGap" | "endGap" | "startInkX" | "endInkX" | "startBandY" | "startBandHeight" | "endBandY" | "endBandHeight">> = [
    "x", "y", "width", "height", "startX", "startY", "startHeight",
    "markStartY", "markStartHeight", "endX", "endY", "endHeight",
    "markEndY", "markEndHeight"
  ];

  return nextKeys.every((key) => {
    const previous = current[key];
    const incoming = next[key];
    if (!previous || !incoming) return false;
    if ((["startGap", "endGap", "startInkX", "endInkX", "startBandY", "startBandHeight", "endBandY", "endBandHeight"] as const).some((key) => {
      const a = previous[key];
      const b = incoming[key];
      return a === undefined || b === undefined ? a !== b : !closeEnough(a, b);
    })) return false;
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

export function horizontalInkBounds(
  left: number,
  metrics: Pick<TextMetrics, "actualBoundingBoxLeft" | "actualBoundingBoxRight">
) {
  return { left: left - metrics.actualBoundingBoxLeft, right: left + metrics.actualBoundingBoxRight };
}

export function verticalInkBounds(bottom: number, metrics: Pick<TextMetrics, "fontBoundingBoxDescent" | "actualBoundingBoxAscent" | "actualBoundingBoxDescent">) {
  const baseline = bottom - metrics.fontBoundingBoxDescent;
  return { top: baseline - metrics.actualBoundingBoxAscent, bottom: baseline + metrics.actualBoundingBoxDescent };
}

/** Locate the letters' baseline without including absolute annotation labels. */
function rangeTokenVerticalInk(element: HTMLElement, text: string, context: CanvasRenderingContext2D | null) {
  const glyph = element.querySelector<HTMLElement>("[data-word-glyph]") ?? element;
  const textNode = [...glyph.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
  if (!context || !textNode) return null;
  const range = document.createRange();
  range.selectNodeContents(textNode);
  const rect = range.getBoundingClientRect();
  const style = window.getComputedStyle(glyph);
  context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const metrics = context.measureText(text);
  if (![metrics.fontBoundingBoxDescent, metrics.actualBoundingBoxAscent, metrics.actualBoundingBoxDescent].every(Number.isFinite)) return null;
  return verticalInkBounds(rect.bottom, metrics);
}

/** Measure visible ink rather than the advance boxes that touch at punctuation. */
export function rangeTokenInkBounds(element: HTMLElement, text: string, context: CanvasRenderingContext2D | null) {
  const glyph = element.querySelector<HTMLElement>("[data-word-glyph]") ?? element;
  const rect = glyph.getBoundingClientRect();
  if (!context) return { left: rect.left, right: rect.right };
  const style = window.getComputedStyle(glyph);
  context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  if ("letterSpacing" in context) context.letterSpacing = style.letterSpacing === "normal" ? "0px" : style.letterSpacing;
  const metrics = context.measureText(text);
  if (!Number.isFinite(metrics.actualBoundingBoxLeft) || !Number.isFinite(metrics.actualBoundingBoxRight)) return { left: rect.left, right: rect.right };
  return horizontalInkBounds(rect.left, metrics);
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
  tokenAttribute: string,
  lineBreaks: readonly number[] = EMPTY_LINE_BREAKS
) {
  const [positions, setPositions] = useState<Record<string, RangePosition>>({});

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const inkContext = document.createElement("canvas").getContext("2d");

    const update = () => {
      const surfaceRect = surface.getBoundingClientRect();
      const next: Record<string, RangePosition> = {};
      const lineTokens = tokens.filter(isMeasurableRangeToken).flatMap((token) => {
        const element = surface.querySelector<HTMLElement>(`[${tokenAttribute}="${token.id}"]`);
        return element ? [{ rect: element.getBoundingClientRect(), ink: rangeTokenVerticalInk(element, token.text, inkContext) }] : [];
      });
      const lineRects = lineTokens.map((item) => item.rect);
      const lineBand = (boundary: DOMRect) => {
        const row = lineRects.filter((rect) => Math.abs(rect.top + rect.height / 2 - boundary.top - boundary.height / 2) < Math.min(rect.height, boundary.height) * .5);
        const top = Math.min(boundary.top, ...row.map((rect) => rect.top));
        const bottom = Math.max(boundary.bottom, ...row.map((rect) => rect.bottom));
        return { y: top - surfaceRect.top, height: bottom - top };
      };

      targets.forEach((target) => {
        const measuredTokens = tokens
          .filter(
            (token) =>
              isMeasurableRangeToken(token) &&
              token.start < target.end &&
              token.end > target.start
          )
          .map((token) => ({ token, element: surface.querySelector<HTMLElement>(
              `[${tokenAttribute}="${token.id}"]`
            ) }))
          .filter((item): item is { token: RangeToken; element: HTMLElement } => Boolean(item.element));
        const elements = measuredTokens.map((item) => item.element);
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
        const boundaryInk = (boundary: DOMRect, fallback: RectMetrics) => {
          const inks = lineTokens.flatMap(({ rect, ink }) =>
            Math.abs(rect.top + rect.height / 2 - boundary.top - boundary.height / 2) < Math.min(rect.height, boundary.height) * .5 && ink ? [ink] : []);
          return inks.length ? { top: Math.min(...inks.map((ink) => ink.top)), bottom: Math.max(...inks.map((ink) => ink.bottom)) } : fallback;
        };
        const firstVisibleInk = boundaryInk(first, firstGlyph);
        const lastVisibleInk = boundaryInk(last, lastGlyph);
        const firstBand = lineBand(first);
        const lastBand = lineBand(last);
        const firstInk = rangeTokenInkBounds(elements[0], measuredTokens[0].token.text, inkContext);
        const lastInk = rangeTokenInkBounds(elements[elements.length - 1], measuredTokens[measuredTokens.length - 1].token.text, inkContext);
        const minLeft = Math.min(...rects.map((rect) => rect.left));
        const maxRight = Math.max(...rects.map((rect) => rect.right));
        const minTop = Math.min(...rects.map((rect) => rect.top));
        const maxBottom = Math.max(...rects.map((rect) => rect.bottom));
        const sameLine =
          Math.abs(first.top - last.top) <
          Math.min(first.height, last.height) * .5;

        const neighbourGap = (side: "start" | "end") => {
          const boundary = side === "start" ? first : last;
          const neighbour = side === "start"
            ? [...tokens].reverse().find((token) => token.end <= target.start && token.text.trim())
            : tokens.find((token) => token.start >= target.end && token.text.trim());
          const element = neighbour && surface.querySelector<HTMLElement>(`[${tokenAttribute}="${neighbour.id}"]`);
          if (!element) return undefined;
          const rect = element.getBoundingClientRect();
          if (Math.abs(rect.top - boundary.top) >= Math.min(rect.height, boundary.height) * .5) return undefined;
          const ink = rangeTokenInkBounds(element, neighbour!.text, inkContext);
          return Math.max(0, side === "start" ? firstInk.left - ink.right : ink.left - lastInk.right);
        };

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
          markStartY: firstVisibleInk.top - surfaceRect.top,
          markStartHeight: firstVisibleInk.bottom - firstVisibleInk.top,
          endX: last.right - surfaceRect.left,
          startInkX: firstInk.left - surfaceRect.left,
          endInkX: lastInk.right - surfaceRect.left,
          startBandY: firstBand.y,
          startBandHeight: firstBand.height,
          endBandY: lastBand.y,
          endBandHeight: lastBand.height,
          startGap: neighbourGap("start"),
          endGap: neighbourGap("end"),
          endY: last.top - surfaceRect.top,
          endHeight: last.height,
          markEndY: lastVisibleInk.top - surfaceRect.top,
          markEndHeight: lastVisibleInk.bottom - lastVisibleInk.top,
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
  }, [surfaceRef, targets, tokenAttribute, tokens, lineBreaks]);

  return positions;
}
