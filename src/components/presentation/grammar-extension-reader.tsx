"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import type { GrammarAnnotation, GrammarAnnotationKind, Sentence } from "@/types";
import { grammarActionLabels, grammarPhaseLabels } from "@/lib/grammar-workflow";

type Token = { text: string; start: number; end: number; isWord: boolean };
type Point = { x: number; y: number };
type MarkBox = { id: string; left: number; top: number; width: number; height: number; kind: "frame" | "brackets"; color?: string };
const actionKinds: Partial<Record<string, GrammarAnnotationKind>> = { frame_groups: "group", identify_group_types: "group", identify_word_classes: "word_class", find_nuclei: "nucleus", frame_functions: "function", identify_functions: "function", identify_donors: "donor", identify_receivers: "receiver" };
const tokenize = (text: string): Token[] => Array.from(text.matchAll(/\S+|\s+/g)).map((match) => ({ text: match[0], start: match.index ?? 0, end: (match.index ?? 0) + match[0].length, isWord: /\S/.test(match[0]) }));
function rangeMatches(annotation: GrammarAnnotation, start: number, end: number) { const overlap = Math.max(0, Math.min(annotation.end, end) - Math.max(annotation.start, start)); return overlap / Math.max(1, annotation.end - annotation.start) >= .72 && overlap / Math.max(1, end - start) >= .62; }

type Props = { sentence: Sentence; excludedKinds?: GrammarAnnotationKind[]; persistenceKey?: string; onCompleteChange?: (complete: boolean) => void; finishControl?: React.ReactNode; initialSolvedIds?: string[] };

export function GrammarExtensionReader({ sentence, excludedKinds = [], persistenceKey, onCompleteChange, finishControl, initialSolvedIds = [] }: Props) {
  const annotations = useMemo(() => sentence.grammarAnnotations ?? [], [sentence.grammarAnnotations]);
  const allSteps = useMemo(() => (sentence.workflowPhases ?? []).flatMap((phase) => phase.actions.filter((action) => action.enabled && actionKinds[action.kind] && !excludedKinds.includes(actionKinds[action.kind]!)).map((action) => ({ phase, action, kind: actionKinds[action.kind]! }))), [excludedKinds, sentence.workflowPhases]);
  const steps = useMemo(() => allSteps.filter((item) => !item.action.parentActionId), [allSteps]);
  const tokens = useMemo(() => tokenize(sentence.originalText), [sentence.originalText]);
  const [stepIndex, setStepIndex] = useState(0);
  const [solvedIds, setSolvedIds] = useState<string[]>(initialSolvedIds);
  const [solvedActionTargets, setSolvedActionTargets] = useState<string[]>([]);
  const [linkedQueue, setLinkedQueue] = useState<Array<{ actionId: string; parentAnnotationId: string }>>([]);
  const [drawingStart, setDrawingStart] = useState<Point | null>(null);
  const [drawingCurrent, setDrawingCurrent] = useState<Point | null>(null);
  const [markBoxes, setMarkBoxes] = useState<MarkBox[]>([]);
  const [message, setMessage] = useState("");
  const surfaceRef = useRef<HTMLDivElement>(null);
  const linkedContext = linkedQueue[0];
  const step = linkedContext ? allSteps.find((item) => item.action.id === linkedContext.actionId) : steps[stepIndex];
  const responseMode = step?.action.responseMode ?? "click";
  const actionTargetKey = (id: string) => `${step?.action.id ?? ""}:${id}`;
  const parentAnnotation = linkedContext ? annotations.find((item) => item.id === linkedContext.parentAnnotationId) : undefined;
  const allExpected = step ? annotations.filter((item) => item.kind === step.kind && (!parentAnnotation || item.parentAnnotationId === parentAnnotation.id || (item.start >= parentAnnotation.start && item.end <= parentAnnotation.end))) : [];
  const remaining = allExpected.filter((item) => !solvedActionTargets.includes(actionTargetKey(item.id)));
  const expected = step?.action.targetOrder === "fixed" ? remaining.slice(0, 1) : remaining;

  useEffect(() => {
    if (!step || allExpected.length > 0) return;
    if (linkedContext) setLinkedQueue((queue) => queue.slice(1));
    else setStepIndex((current) => current + 1);
  }, [allExpected.length, linkedContext, step]);

  useEffect(() => { if (!persistenceKey || typeof window === "undefined") return; try { const saved = JSON.parse(sessionStorage.getItem(persistenceKey) ?? "{}"); setStepIndex(saved.stepIndex ?? 0); setSolvedIds(saved.solvedIds ?? []); setSolvedActionTargets(saved.solvedActionTargets ?? []); setLinkedQueue(saved.linkedQueue ?? []); } catch { sessionStorage.removeItem(persistenceKey); } }, [persistenceKey, sentence.id]);
  useEffect(() => { setSolvedIds((current) => Array.from(new Set([...current, ...initialSolvedIds]))); }, [initialSolvedIds]);
  useEffect(() => { if (persistenceKey && typeof window !== "undefined") sessionStorage.setItem(persistenceKey, JSON.stringify({ stepIndex, solvedIds, solvedActionTargets, linkedQueue })); onCompleteChange?.(steps.length > 0 && stepIndex >= steps.length && linkedQueue.length === 0); }, [linkedQueue, onCompleteChange, persistenceKey, solvedActionTargets, solvedIds, stepIndex, steps.length]);
  useEffect(() => {
    const surface = surfaceRef.current; if (!surface) return;
    const update = () => { const surfaceRect = surface.getBoundingClientRect(); const next: MarkBox[] = []; annotations.filter((item) => solvedIds.includes(item.id) && (["frame", "brackets"].includes(item.visualEffect?.kind ?? "") || (!item.visualEffect && ["group", "function"].includes(item.kind)))).forEach((annotation) => { const elements = Array.from(surface.querySelectorAll<HTMLElement>("[data-grammar-start]")).filter((element) => Number(element.dataset.grammarStart) < annotation.end && Number(element.dataset.grammarEnd) > annotation.start); const lines = new Map<number, DOMRect[]>(); elements.forEach((element) => { const rect = element.getBoundingClientRect(); const key = Math.round(rect.top / 4) * 4; lines.set(key, [...(lines.get(key) ?? []), rect]); }); Array.from(lines.values()).forEach((rects, index) => { const left = Math.min(...rects.map((rect) => rect.left)); const right = Math.max(...rects.map((rect) => rect.right)); const top = Math.min(...rects.map((rect) => rect.top)); const bottom = Math.max(...rects.map((rect) => rect.bottom)); next.push({ id: `${annotation.id}-${index}`, left: left - surfaceRect.left - 5, top: top - surfaceRect.top - 3, width: right - left + 10, height: bottom - top + 6, kind: annotation.visualEffect?.kind === "brackets" ? "brackets" : "frame", color: annotation.visualEffect?.color }); }); }); setMarkBoxes(next); };
    update(); const observer = new ResizeObserver(update); observer.observe(surface); return () => observer.disconnect();
  }, [annotations, sentence.originalText, solvedIds]);

  if (!annotations.length || !step) return <>{finishControl}</>;
  const complete = (annotation: GrammarAnnotation) => {
    const key = actionTargetKey(annotation.id); const nextTargets = solvedActionTargets.includes(key) ? solvedActionTargets : [...solvedActionTargets, key];
    setSolvedActionTargets(nextTargets); setSolvedIds((current) => current.includes(annotation.id) ? current : [...current, annotation.id]); setMessage(annotation.label ? `Oui — ${annotation.label}.` : "Bonne réponse.");
    const children = allSteps.filter((item) => item.action.parentActionId === step.action.id).map((item) => ({ actionId: item.action.id, parentAnnotationId: annotation.id }));
    const actionDone = allExpected.every((item) => nextTargets.includes(actionTargetKey(item.id)));
    if (linkedContext && actionDone) setLinkedQueue((queue) => [...children, ...queue.slice(1)]);
    else if (children.length) setLinkedQueue((queue) => [...children, ...queue]);
    if (!linkedContext && actionDone) setStepIndex((index) => index + 1);
    if (actionDone) { setDrawingStart(null); setDrawingCurrent(null); }
  };
  const selectRange = (start: number, end: number) => { const match = expected.find((item) => rangeMatches(item, start, end)); if (match) complete(match); else setMessage("Ce n’est pas tout à fait la bonne partie. Réessaie."); };
  const handleSurfaceClick = (event: ReactMouseEvent<HTMLDivElement>) => { if (responseMode === "click") return; const surface = surfaceRef.current; if (!surface) return; const rect = surface.getBoundingClientRect(); const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }; if (!drawingStart) { setDrawingStart(point); setDrawingCurrent(point); setMessage(responseMode === "brackets" ? "Clique maintenant sur l’autre limite du passage." : "Clique maintenant sur le coin opposé."); return; } const left = Math.min(drawingStart.x, point.x) - 7, right = Math.max(drawingStart.x, point.x) + 7, top = Math.min(drawingStart.y, point.y) - 10, bottom = Math.max(drawingStart.y, point.y) + 10; const selected = Array.from(surface.querySelectorAll<HTMLElement>("[data-grammar-start]")).filter((element) => { const box = element.getBoundingClientRect(); const x = (box.left + box.right) / 2 - rect.left, y = (box.top + box.bottom) / 2 - rect.top; return x >= left && x <= right && y >= top && y <= bottom; }); setDrawingStart(null); setDrawingCurrent(null); selectRange(selected.length ? Math.min(...selected.map((element) => Number(element.dataset.grammarStart))) : -1, selected.length ? Math.max(...selected.map((element) => Number(element.dataset.grammarEnd))) : -1); };
  const tokenStyle = (token: Token): CSSProperties => { const marks = annotations.filter((item) => solvedIds.includes(item.id) && token.start < item.end && token.end > item.start); const color = [...marks].reverse().find((item) => item.visualEffect?.kind === "color")?.visualEffect?.color; const backgroundColor = [...marks].reverse().find((item) => item.visualEffect?.kind === "highlight")?.visualEffect?.color; const underline = [...marks].reverse().find((item) => item.visualEffect?.kind === "underline")?.visualEffect?.color; return { color, backgroundColor, fontWeight: marks.some((item) => item.visualEffect?.kind === "bold") ? 800 : undefined, textDecoration: underline ? "underline" : undefined, textDecorationColor: underline }; };

  return <section className="grammar-extension-reader mixed-grammar-reader">
    <div className="grammar-reader-progress">{allSteps.map((item, index) => <span className={item.action.id === step.action.id ? "active" : solvedActionTargets.some((key) => key.startsWith(`${item.action.id}:`)) ? "done" : ""} key={`${item.phase.id}-${item.action.id}`}>{index + 1}</span>)}</div>
    <div className="grammar-reader-instruction"><small>{grammarPhaseLabels[step.phase.kind]}</small><strong>{grammarActionLabels[step.action.kind]}</strong><span>{responseMode === "frame" ? "Trace un encadrement autour de la réponse." : responseMode === "brackets" ? "Indique les deux limites du passage à mettre entre crochets." : "Clique sur le bon mot ou le bon passage."}</span></div>
    <div className={`grammar-reader-text ${responseMode === "click" ? "clicking" : "framing"}`} ref={surfaceRef} onClick={handleSurfaceClick} onMouseMove={(event) => { if (!drawingStart || responseMode === "click") return; const rect = event.currentTarget.getBoundingClientRect(); setDrawingCurrent({ x: event.clientX - rect.left, y: event.clientY - rect.top }); }}>
      {markBoxes.map((box) => <span key={box.id} className={box.kind === "brackets" ? "grammar-reader-answer-brackets" : "grammar-reader-answer-frame"} style={{ left: box.left, top: box.top, width: box.width, height: box.height, borderColor: box.color }}/>) }
      {drawingStart && drawingCurrent && (
        <span className="grammar-reader-drawing-frame" style={{ left: Math.min(drawingStart.x, drawingCurrent.x), top: Math.min(drawingStart.y, drawingCurrent.y), width: Math.abs(drawingCurrent.x - drawingStart.x), height: Math.abs(drawingCurrent.y - drawingStart.y) }}/>
      )}
      {tokens.map((token) => token.isWord ? <button type="button" style={tokenStyle(token)} data-grammar-start={token.start} data-grammar-end={token.end} key={`${token.start}-${token.end}`} onClick={(event) => { if (responseMode !== "click") return; event.stopPropagation(); const match = expected.find((item) => token.start < item.end && token.end > item.start); if (match) complete(match); else setMessage("Ce n’est pas le bon passage. Réessaie."); }}>{token.text}</button> : <span style={tokenStyle(token)} key={`${token.start}-${token.end}`}>{token.text}</span>)}
    </div>
    {message && <p className="grammar-reader-message">{message}</p>}
  </section>;
}
