"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { GrammarAnnotation, GrammarAnnotationKind, Sentence } from "@/types";
import { grammarActionLabels, grammarPhaseLabels } from "@/lib/grammar-workflow";

type TextToken = { text: string; start: number; end: number; isWord: boolean };
type Point = { x: number; y: number };
type AnswerBox = { id: string; left: number; top: number; width: number; height: number };

const actionAnnotationKind: Partial<Record<string, GrammarAnnotationKind>> = {
  frame_groups: "group",
  identify_group_types: "group",
  identify_word_classes: "word_class",
  find_nuclei: "nucleus",
  frame_functions: "function",
  identify_functions: "function",
  identify_donors: "donor",
  identify_receivers: "receiver"
};

function tokenize(text: string): TextToken[] {
  return Array.from(text.matchAll(/\S+|\s+/g)).map((match) => ({
    text: match[0],
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
    isWord: /\S/.test(match[0])
  }));
}

function rangeMatches(annotation: GrammarAnnotation, start: number, end: number) {
  const overlap = Math.max(0, Math.min(annotation.end, end) - Math.max(annotation.start, start));
  const expectedLength = Math.max(1, annotation.end - annotation.start);
  const selectedLength = Math.max(1, end - start);
  return overlap / expectedLength >= .72 && overlap / selectedLength >= .62;
}

export function GrammarExtensionReader({ sentence, excludedKinds = [] }: { sentence: Sentence; excludedKinds?: GrammarAnnotationKind[] }) {
  const annotations = useMemo(() => sentence.grammarAnnotations ?? [], [sentence.grammarAnnotations]);
  const steps = (sentence.workflowPhases ?? []).flatMap((phase) => phase.actions
    .filter((action) => {
      const kind = actionAnnotationKind[action.kind];
      if (!action.enabled || !kind || excludedKinds.includes(kind)) return false;
      if (action.kind === "identify_functions" && phase.actions.some((candidate) => candidate.kind === "frame_functions" && candidate.enabled)) return false;
      return true;
    })
    .map((action) => ({ phase, action, kind: actionAnnotationKind[action.kind]! })));
  const [stepIndex, setStepIndex] = useState(0);
  const [solvedIds, setSolvedIds] = useState<string[]>([]);
  const [drawingStart, setDrawingStart] = useState<Point | null>(null);
  const [drawingCurrent, setDrawingCurrent] = useState<Point | null>(null);
  const [answerBoxes, setAnswerBoxes] = useState<AnswerBox[]>([]);
  const [message, setMessage] = useState("");
  const surfaceRef = useRef<HTMLDivElement>(null);
  const tokens = useMemo(() => tokenize(sentence.originalText), [sentence.originalText]);
  const step = steps[stepIndex];
  const expected = step ? annotations.filter((annotation) => annotation.kind === step.kind && !solvedIds.includes(annotation.id)) : [];
  const responseMode = step?.action.responseMode ?? (step?.kind === "function" || step?.kind === "group" ? "frame" : "click");

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const update = () => {
      const surfaceRect = surface.getBoundingClientRect();
      const next: AnswerBox[] = [];
      annotations.filter((annotation) => solvedIds.includes(annotation.id) && (annotation.kind === "function" || annotation.kind === "group")).forEach((annotation) => {
        const elements = Array.from(surface.querySelectorAll<HTMLElement>("[data-grammar-start]")).filter((element) => {
          const start = Number(element.dataset.grammarStart);
          const end = Number(element.dataset.grammarEnd);
          return start < annotation.end && end > annotation.start;
        });
        const lines = new Map<number, DOMRect[]>();
        elements.forEach((element) => {
          const rect = element.getBoundingClientRect();
          const key = Math.round(rect.top / 4) * 4;
          lines.set(key, [...(lines.get(key) ?? []), rect]);
        });
        Array.from(lines.values()).forEach((rects, index) => {
          const left = Math.min(...rects.map((rect) => rect.left));
          const right = Math.max(...rects.map((rect) => rect.right));
          const top = Math.min(...rects.map((rect) => rect.top));
          const bottom = Math.max(...rects.map((rect) => rect.bottom));
          next.push({ id: `${annotation.id}-${index}`, left: left - surfaceRect.left - 5, top: top - surfaceRect.top - 3, width: right - left + 10, height: bottom - top + 6 });
        });
      });
      setAnswerBoxes(next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(surface);
    return () => observer.disconnect();
  }, [annotations, solvedIds, sentence.originalText]);

  if (!annotations.length || !step) return null;

  function complete(annotation: GrammarAnnotation) {
    const next = solvedIds.includes(annotation.id) ? solvedIds : [...solvedIds, annotation.id];
    setSolvedIds(next);
    setMessage(annotation.label ? `Oui — ${annotation.label}.` : "Bonne réponse.");
    if (!annotations.some((candidate) => candidate.kind === step.kind && !next.includes(candidate.id))) {
      setStepIndex((index) => Math.min(index + 1, steps.length));
      setDrawingStart(null);
      setDrawingCurrent(null);
    }
  }

  function handleSurfaceClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (responseMode !== "frame") return;
    const surface = surfaceRef.current;
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    if (!drawingStart) {
      setDrawingStart(point);
      setDrawingCurrent(point);
      setMessage("Clique maintenant sur le coin opposé du rectangle.");
      return;
    }
    const left = Math.min(drawingStart.x, point.x) - 7;
    const right = Math.max(drawingStart.x, point.x) + 7;
    const top = Math.min(drawingStart.y, point.y) - 10;
    const bottom = Math.max(drawingStart.y, point.y) + 10;
    const selected = Array.from(surface.querySelectorAll<HTMLElement>("[data-grammar-start]")).filter((element) => {
      const wordRect = element.getBoundingClientRect();
      const centerX = (wordRect.left + wordRect.right) / 2 - rect.left;
      const centerY = (wordRect.top + wordRect.bottom) / 2 - rect.top;
      return centerX >= left && centerX <= right && centerY >= top && centerY <= bottom;
    });
    const start = selected.length ? Math.min(...selected.map((element) => Number(element.dataset.grammarStart))) : -1;
    const end = selected.length ? Math.max(...selected.map((element) => Number(element.dataset.grammarEnd))) : -1;
    const match = expected.find((annotation) => rangeMatches(annotation, start, end));
    setDrawingStart(null);
    setDrawingCurrent(null);
    if (!match) {
      setMessage("Ce n’est pas tout à fait la bonne partie. Réessaie.");
      return;
    }
    complete(match);
  }

  function chooseWord(token: TextToken) {
    if (responseMode !== "click") return;
    const match = expected.find((annotation) => token.start < annotation.end && token.end > annotation.start);
    if (!match) {
      setMessage("Ce n’est pas le bon mot. Réessaie.");
      return;
    }
    complete(match);
  }

  return (
    <section className="grammar-extension-reader">
      <div className="grammar-reader-progress">{steps.map((item, index) => <span className={index === stepIndex ? "active" : index < stepIndex ? "done" : ""} key={`${item.phase.id}-${item.action.id}`}>{index + 1}</span>)}</div>
      <div className="grammar-reader-instruction">
        <small>{grammarPhaseLabels[step.phase.kind]}</small>
        <strong>{grammarActionLabels[step.action.kind]}</strong>
        <span>{responseMode === "frame" ? "Clique sur un premier coin, puis sur le coin opposé." : "Clique sur le bon mot."}</span>
      </div>
      <div className={`grammar-reader-text ${responseMode === "frame" ? "framing" : "clicking"}`} ref={surfaceRef} onClick={handleSurfaceClick} onMouseMove={(event) => { if (!drawingStart || responseMode !== "frame") return; const rect = event.currentTarget.getBoundingClientRect(); setDrawingCurrent({ x: event.clientX - rect.left, y: event.clientY - rect.top }); }}>
        {answerBoxes.map((box) => <span key={box.id} className="grammar-reader-answer-frame" style={{ left: box.left, top: box.top, width: box.width, height: box.height }} />)}
        {drawingStart && drawingCurrent && <span className="grammar-reader-drawing-frame" style={{ left: Math.min(drawingStart.x, drawingCurrent.x), top: Math.min(drawingStart.y, drawingCurrent.y), width: Math.abs(drawingCurrent.x - drawingStart.x), height: Math.abs(drawingCurrent.y - drawingStart.y) }} />}
        {tokens.map((token) => token.isWord ? <button type="button" data-grammar-start={token.start} data-grammar-end={token.end} key={`${token.start}-${token.end}`} onClick={(event) => { if (responseMode === "click") { event.stopPropagation(); chooseWord(token); } }}>{token.text}</button> : <span key={`${token.start}-${token.end}`}>{token.text}</span>)}
      </div>
      {message && <p className="grammar-reader-message">{message}</p>}
    </section>
  );
}
