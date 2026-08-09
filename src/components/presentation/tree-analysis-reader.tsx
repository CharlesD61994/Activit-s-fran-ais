"use client";

import { useMemo, useState } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import type { Sentence, TreeAnalysisInteraction, TreeAnalysisNode, WordClass, WordGroupType } from "@/types";

const groupLabels: Record<WordGroupType, string> = { GN: "GN", GV: "GV", GAdj: "GAdj", GAdv: "GAdv", GPrep: "GPrép" };
const wordClassLabels: Record<WordClass, string> = { noun: "N", determiner: "Dét", verb: "V", preposition: "Prép", adverb: "Adv", adjective: "Adj", pronoun: "Pron", conjunction: "Conj", interjection: "Interj" };

function normalizeAnswer(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z]/g, "").toLowerCase();
}

const nodeAliases: Record<WordGroupType | WordClass, string[]> = {
  GN: ["gn", "groupenominal"], GV: ["gv", "groupeverbal"], GAdj: ["gadj", "groupeadjectival"], GAdv: ["gadv", "groupeadverbial"], GPrep: ["gprep", "groupeprepositionnel"],
  noun: ["n", "nom"], determiner: ["det", "determinant"], verb: ["v", "verbe"], preposition: ["prep", "preposition"], adverb: ["adv", "adverbe"], adjective: ["adj", "adjectif"], pronoun: ["pron", "pronom"], conjunction: ["conj", "conjonction"], interjection: ["interj", "interjection"]
};

type Props = {
  sentence: Sentence;
  onCompleteChange?: (complete: boolean) => void;
  finishControl?: ReactNode;
};

type TextSelection = { textBoxId: string; start: number; end: number };

function expectedNodeLabel(node: TreeAnalysisNode) {
  if (node.groupType) return groupLabels[node.groupType];
  if (node.wordClass) return wordClassLabels[node.wordClass];
  return "";
}

function wordIndexes(text: string, start: number, end: number) {
  const indexes: number[] = [];
  let index = 0;
  for (const match of text.matchAll(/[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N}'’\-]*/gu)) {
    const wordStart = match.index ?? 0;
    const wordEnd = wordStart + match[0].length;
    if (wordEnd > start && wordStart < end) indexes.push(index);
    index += 1;
  }
  return indexes;
}

function selectionMatches(text: string, selected: TextSelection, interaction: TreeAnalysisInteraction, tolerance: "strict" | "normal" | "permissive") {
  if (tolerance === "strict") return selected.start === interaction.start && selected.end === interaction.end;
  const expected = wordIndexes(text, interaction.start, interaction.end);
  const actual = wordIndexes(text, selected.start, selected.end);
  if (tolerance === "normal") return expected.length === actual.length && expected.every((value, index) => value === actual[index]);
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const difference = [...expectedSet].filter((value) => !actualSet.has(value)).length + [...actualSet].filter((value) => !expectedSet.has(value)).length;
  return difference <= 1;
}

export function TreeAnalysisReader({ sentence, onCompleteChange, finishControl }: Props) {
  const nodes = useMemo(() => sentence.treeAnalysisNodes ?? [], [sentence.treeAnalysisNodes]);
  const interactions = useMemo(() => sentence.treeAnalysisInteractions ?? [], [sentence.treeAnalysisInteractions]);
  const tables = useMemo(() => sentence.treeAnalysisTables ?? [], [sentence.treeAnalysisTables]);
  const textBoxes = useMemo(() => sentence.treeAnalysisTextBoxes ?? [], [sentence.treeAnalysisTextBoxes]);
  const relations = useMemo(() => sentence.treeAnalysisRelations ?? [], [sentence.treeAnalysisRelations]);
  const nodeWidth = sentence.treeAnalysisPage?.nodeWidth ?? 72;
  const nodeHeight = sentence.treeAnalysisPage?.nodeHeight ?? 44;
  const flow = sentence.treeAnalysisFlow ?? { preset: "tree_functions_tables" as const, orderedStepIds: [], selectionTolerance: "normal" as const };
  const [completed, setCompleted] = useState<string[]>([]);
  const [nodeDrafts, setNodeDrafts] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState("");
  const [framedAnswers, setFramedAnswers] = useState<Array<{ textBoxId: string; start: number; end: number }>>([]);
  const [drawingStart, setDrawingStart] = useState<{ x: number; y: number } | null>(null);
  const [drawingCurrent, setDrawingCurrent] = useState<{ x: number; y: number } | null>(null);

  const automaticSteps = useMemo(() => {
    if (flow.preset === "groups_tree_tables") {
      const paired = interactions.filter((item) => item.kind === "group").flatMap((item) => [`interaction:${item.id}`, ...(item.linkedNodeId ? [`node:${item.linkedNodeId}`] : [])]);
      const pairedNodes = new Set(interactions.map((item) => item.linkedNodeId).filter(Boolean));
      return [...paired, ...nodes.filter((node) => !pairedNodes.has(node.id)).map((node) => `node:${node.id}`), ...interactions.filter((item) => item.kind === "function").map((item) => `interaction:${item.id}`), ...tables.map((table) => `table:${table.id}`)];
    }
    return [...nodes.map((node) => `node:${node.id}`), ...interactions.map((item) => `interaction:${item.id}`), ...tables.map((table) => `table:${table.id}`)];
  }, [flow.preset, interactions, nodes, tables]);
  const steps = flow.preset === "custom" && flow.orderedStepIds.length ? flow.orderedStepIds : automaticSteps;
  const currentStep = steps.find((id) => !completed.includes(id));
  const currentInteraction = currentStep?.startsWith("interaction:") ? interactions.find((item) => `interaction:${item.id}` === currentStep) : undefined;
  const currentNode = currentStep?.startsWith("node:") ? nodes.find((item) => `node:${item.id}` === currentStep) : undefined;
  const currentTable = currentStep?.startsWith("table:") ? tables.find((item) => `table:${item.id}` === currentStep) : undefined;
  const isComplete = steps.length > 0 && completed.length >= steps.length;
  const freeTreePhase = flow.preset === "tree_functions_tables" && Boolean(currentNode);
  const contentTop = Math.min(...textBoxes.map((box) => box.y), ...nodes.map((node) => node.y), ...tables.map((table) => table.y), 90);
  const topOffset = Math.max(0, contentTop - 24);

  function completeStep(id: string) {
    setCompleted((current) => {
      if (current.includes(id)) return current;
      const next = [...current, id];
      queueMicrotask(() => onCompleteChange?.(next.length >= steps.length));
      return next;
    });
    setFeedback("Bonne réponse!");
  }

  function verifyFraming(candidate: TextSelection | null) {
    if (!currentInteraction || !candidate || candidate.textBoxId !== currentInteraction.textBoxId) {
      setFeedback("Sélectionne d’abord le passage demandé.");
      return;
    }
    const box = textBoxes.find((item) => item.id === currentInteraction.textBoxId);
    if (!box || !selectionMatches(box.text, candidate, currentInteraction, flow.selectionTolerance)) {
      setFeedback("Ce n’est pas tout à fait le bon passage. Réessaie.");
      return;
    }
    setFramedAnswers((current) => [...current, candidate]);
    completeStep(`interaction:${currentInteraction.id}`);
    window.getSelection()?.removeAllRanges();
  }

  function handleDrawingClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (!currentInteraction) return;
    if ((event.target as HTMLElement).closest("button")) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    if (!drawingStart) {
      setDrawingStart(point);
      setDrawingCurrent(point);
      setFeedback("Clique maintenant sur le coin opposé du rectangle.");
      return;
    }
    const margin = 12;
    const left = Math.min(drawingStart.x, point.x) - margin;
    const right = Math.max(drawingStart.x, point.x) + margin;
    const top = Math.min(drawingStart.y, point.y) - margin;
    const bottom = Math.max(drawingStart.y, point.y) + margin;
    const words = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(`.tree-reader-word[data-box-id="${currentInteraction.textBoxId}"]`)).filter((word) => {
      const wordRect = word.getBoundingClientRect();
      const wordLeft = wordRect.left - rect.left;
      const wordRight = wordRect.right - rect.left;
      const wordTop = wordRect.top - rect.top;
      const wordBottom = wordRect.bottom - rect.top;
      return wordRight >= left && wordLeft <= right && wordBottom >= top && wordTop <= bottom;
    });
    const candidate = words.length ? { textBoxId: currentInteraction.textBoxId, start: Math.min(...words.map((word) => Number(word.dataset.start))), end: Math.max(...words.map((word) => Number(word.dataset.end))) } : null;
    setDrawingStart(null);
    setDrawingCurrent(null);
    verifyFraming(candidate);
  }

  function submitNode(node: TreeAnalysisNode, value: string) {
    const correctAnswer = node.groupType ?? node.wordClass ?? "";
    if (!correctAnswer || !nodeAliases[correctAnswer].includes(normalizeAnswer(value))) {
      setFeedback("Ce n’est pas la bonne réponse. Essaie une abréviation ou le nom complet.");
      return;
    }
    completeStep(`node:${node.id}`);
    setNodeDrafts((current) => ({ ...current, [node.id]: "" }));
  }

  return (
    <div className="tree-reader">
      <div className="tree-reader-progress"><span style={{ width: `${steps.length ? completed.length / steps.length * 100 : 0}%` }} /></div>
      <section className="tree-reader-instruction">
        <span className="eyebrow">Étape {Math.min(completed.length + 1, steps.length || 1)} sur {steps.length || 1}</span>
        <h2>{currentInteraction?.instruction ?? (currentNode ? (freeTreePhase ? "Identifie tous les groupes et toutes les classes de mots dans les rectangles." : "Identifie le rectangle actif.") : currentTable ? "Choisis la bonne réponse dans le tableau." : "Activité terminée!")}</h2>
        {currentInteraction && <strong className="tree-reader-draw-help">Clique un premier coin, puis le coin opposé pour tracer ton encadrement.</strong>}
        {feedback && <p>{feedback}</p>}
      </section>

      <div className={`tree-reader-page ${currentInteraction ? "drawing" : ""}`} onClick={handleDrawingClick} onMouseMove={(event) => { if (!drawingStart) return; const rect = event.currentTarget.getBoundingClientRect(); setDrawingCurrent({ x: event.clientX - rect.left, y: event.clientY - rect.top }); }}>
        {textBoxes.map((box) => {
          const answerRanges = framedAnswers.filter((item) => item.textBoxId === box.id);
          let offset = 0;
          const tokens = box.text.match(/\S+|\s+/g) ?? [];
          return <div key={box.id} className="tree-reader-text" style={{ left: `${box.x / 1056 * 100}%`, top: `${(box.y - topOffset) / 816 * 100}%`, width: `${box.width / 1056 * 100}%`, fontSize: `${box.fontSize / 1056 * 100}cqw` }}>{tokens.map((token, index) => { const start = offset; const end = start + token.length; offset = end; const framed = answerRanges.some((item) => item.start <= start && item.end >= end); return /^\s+$/u.test(token) ? token : <span key={`${index}-${start}`} className={`tree-reader-word ${framed ? "tree-reader-framed" : ""}`} data-box-id={box.id} data-start={start} data-end={end}>{token}</span>; })}</div>;
        })}
        <svg className="tree-reader-lines" viewBox="0 0 1056 816" preserveAspectRatio="none">{relations.map((relation) => { const parent = nodes.find((node) => node.id === relation.parentNodeId); const child = nodes.find((node) => node.id === relation.childNodeId); if (!parent || !child) return null; return <line key={relation.id} x1={parent.x + nodeWidth / 2} y1={parent.y + nodeHeight - topOffset} x2={child.x + nodeWidth / 2} y2={child.y - topOffset} />; })}</svg>
        {nodes.map((node) => {
          const stepId = `node:${node.id}`;
          const done = completed.includes(stepId);
          const active = !done && (freeTreePhase || currentNode?.id === node.id);
          return <div key={node.id} className={`tree-reader-node ${active ? "active" : ""} ${done ? "done" : ""}`} style={{ left: `${node.x / 1056 * 100}%`, top: `${(node.y - topOffset) / 816 * 100}%`, width: `${nodeWidth / 1056 * 100}%`, height: `${nodeHeight / 816 * 100}%` }}>{done ? <strong>{expectedNodeLabel(node)}</strong> : active ? <input aria-label="Réponse du rectangle" value={nodeDrafts[node.id] ?? ""} onClick={(event) => event.stopPropagation()} onChange={(event) => { const value = event.target.value; setNodeDrafts((current) => ({ ...current, [node.id]: value })); setFeedback(""); const expected = node.groupType ?? node.wordClass; if (expected && nodeAliases[expected].includes(normalizeAnswer(value))) submitNode(node, value); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); submitNode(node, nodeDrafts[node.id] ?? ""); } }} autoComplete="off" placeholder="?" /> : null}</div>;
        })}
        {tables.map((table) => <div key={table.id} className={`tree-reader-table ${currentTable?.id === table.id ? "active" : ""}`} style={{ left: `${table.x / 1056 * 100}%`, top: `${(table.y - topOffset) / 816 * 100}%`, gridTemplateColumns: `repeat(${table.columns},1fr)` }}>{table.cells.map((cell, index) => cell.columnSpan === 0 ? null : <button type="button" key={index} style={{ gridColumn: cell.columnSpan && cell.columnSpan > 1 ? `span ${cell.columnSpan}` : undefined }} disabled={currentTable?.id !== table.id} onClick={(event) => { event.stopPropagation(); if (cell.isCorrect) completeStep(`table:${table.id}`); else setFeedback("Ce n’est pas la bonne cellule."); }}>{cell.text}</button>)}</div>)}
        {drawingStart && drawingCurrent && <div className="tree-reader-drawing-box" style={{ left: Math.min(drawingStart.x, drawingCurrent.x), top: Math.min(drawingStart.y, drawingCurrent.y), width: Math.abs(drawingCurrent.x - drawingStart.x), height: Math.abs(drawingCurrent.y - drawingStart.y) }} />}
      </div>

      <div className="interactive-reader-actions">{isComplete ? finishControl : null}</div>
    </div>
  );
}
