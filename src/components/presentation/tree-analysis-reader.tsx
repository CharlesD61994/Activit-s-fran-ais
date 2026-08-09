"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Sentence, TreeAnalysisInteraction, TreeAnalysisNode, WordClass, WordGroupType } from "@/types";

const groupLabels: Record<WordGroupType, string> = { GN: "GN", GV: "GV", GAdj: "GAdj", GAdv: "GAdv", GPrep: "GPrép" };
const wordClassLabels: Record<WordClass, string> = { noun: "Nom", determiner: "Déterminant", verb: "Verbe", preposition: "Préposition", adverb: "Adverbe", adjective: "Adjectif", pronoun: "Pronom", conjunction: "Conjonction", interjection: "Interjection" };

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
  const [selectedText, setSelectedText] = useState<TextSelection | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [nodeCategory, setNodeCategory] = useState<"group" | "class" | "">("");
  const [nodeAnswer, setNodeAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [framedAnswers, setFramedAnswers] = useState<Array<{ textBoxId: string; start: number; end: number }>>([]);

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
  const activeNodeTarget = nodes.find((node) => node.id === activeNodeId);
  const freeTreePhase = flow.preset === "tree_functions_tables" && Boolean(currentNode);

  function completeStep(id: string) {
    setCompleted((current) => {
      if (current.includes(id)) return current;
      const next = [...current, id];
      queueMicrotask(() => onCompleteChange?.(next.length >= steps.length));
      return next;
    });
    setFeedback("Bonne réponse!");
  }

  function captureSelection(textBoxId: string, element: HTMLDivElement) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    if (!element.contains(range.startContainer) || !element.contains(range.endContainer)) return;
    const startRange = range.cloneRange();
    startRange.selectNodeContents(element);
    startRange.setEnd(range.startContainer, range.startOffset);
    const endRange = range.cloneRange();
    endRange.selectNodeContents(element);
    endRange.setEnd(range.endContainer, range.endOffset);
    setSelectedText({ textBoxId, start: startRange.toString().length, end: endRange.toString().length });
    setFeedback("");
  }

  function submitFraming() {
    if (!currentInteraction || !selectedText || selectedText.textBoxId !== currentInteraction.textBoxId) {
      setFeedback("Sélectionne d’abord le passage demandé.");
      return;
    }
    const box = textBoxes.find((item) => item.id === currentInteraction.textBoxId);
    if (!box || !selectionMatches(box.text, selectedText, currentInteraction, flow.selectionTolerance)) {
      setFeedback("Ce n’est pas tout à fait le bon passage. Réessaie.");
      return;
    }
    setFramedAnswers((current) => [...current, selectedText]);
    completeStep(`interaction:${currentInteraction.id}`);
    window.getSelection()?.removeAllRanges();
    setSelectedText(null);
  }

  function submitNode() {
    if (!activeNodeTarget) return;
    const correctCategory = activeNodeTarget.groupType ? "group" : "class";
    const correctAnswer = activeNodeTarget.groupType ?? activeNodeTarget.wordClass ?? "";
    if (nodeCategory !== correctCategory || nodeAnswer !== correctAnswer) {
      setFeedback("Vérifie s’il s’agit d’un groupe ou d’une classe de mots.");
      return;
    }
    completeStep(`node:${activeNodeTarget.id}`);
    setActiveNodeId(null);
    setNodeCategory("");
    setNodeAnswer("");
  }

  return (
    <div className="tree-reader">
      <div className="tree-reader-progress"><span style={{ width: `${steps.length ? completed.length / steps.length * 100 : 0}%` }} /></div>
      <section className="tree-reader-instruction">
        <span className="eyebrow">Étape {Math.min(completed.length + 1, steps.length || 1)} sur {steps.length || 1}</span>
        <h2>{currentInteraction?.instruction ?? (currentNode ? (freeTreePhase ? "Identifie tous les groupes et toutes les classes de mots dans les rectangles." : "Identifie le rectangle actif.") : currentTable ? "Choisis la bonne réponse dans le tableau." : "Activité terminée!")}</h2>
        {currentInteraction && <Button type="button" onClick={submitFraming}>Encadrer la sélection</Button>}
        {feedback && <p>{feedback}</p>}
      </section>

      <div className="tree-reader-page">
        {textBoxes.map((box) => {
          const answerRanges = framedAnswers.filter((item) => item.textBoxId === box.id);
          const boundaries = Array.from(new Set([0, box.text.length, ...answerRanges.flatMap((item) => [item.start, item.end])])).sort((a, b) => a - b);
          return <div key={box.id} className="tree-reader-text" style={{ left: `${box.x / 1056 * 100}%`, top: `${box.y / 816 * 100}%`, width: `${box.width / 1056 * 100}%`, fontSize: `${box.fontSize / 1056 * 100}cqw` }} onMouseUp={(event) => captureSelection(box.id, event.currentTarget)}>{boundaries.slice(0, -1).map((start, index) => { const end = boundaries[index + 1]; const framed = answerRanges.some((item) => item.start <= start && item.end >= end); return <span key={`${start}-${end}`} className={framed ? "tree-reader-framed" : ""}>{box.text.slice(start, end)}</span>; })}</div>;
        })}
        <svg className="tree-reader-lines" viewBox="0 0 1056 816" preserveAspectRatio="none">{relations.map((relation) => { const parent = nodes.find((node) => node.id === relation.parentNodeId); const child = nodes.find((node) => node.id === relation.childNodeId); if (!parent || !child) return null; return <line key={relation.id} x1={parent.x + nodeWidth / 2} y1={parent.y + nodeHeight} x2={child.x + nodeWidth / 2} y2={child.y} />; })}</svg>
        {nodes.map((node) => {
          const stepId = `node:${node.id}`;
          const done = completed.includes(stepId);
          const active = !done && (freeTreePhase || currentNode?.id === node.id);
          return <button type="button" key={node.id} className={`tree-reader-node ${active ? "active" : ""} ${done ? "done" : ""}`} style={{ left: `${node.x / 1056 * 100}%`, top: `${node.y / 816 * 100}%`, width: `${nodeWidth / 1056 * 100}%`, height: `${nodeHeight / 816 * 100}%` }} disabled={!active} onClick={() => { setActiveNodeId(node.id); setFeedback(""); }}>{done ? expectedNodeLabel(node) : active ? "?" : ""}</button>;
        })}
        {tables.map((table) => <div key={table.id} className={`tree-reader-table ${currentTable?.id === table.id ? "active" : ""}`} style={{ left: `${table.x / 1056 * 100}%`, top: `${table.y / 816 * 100}%`, gridTemplateColumns: `repeat(${table.columns},1fr)` }}>{table.cells.map((cell, index) => cell.columnSpan === 0 ? null : <button type="button" key={index} style={{ gridColumn: cell.columnSpan && cell.columnSpan > 1 ? `span ${cell.columnSpan}` : undefined }} disabled={currentTable?.id !== table.id} onClick={() => cell.isCorrect ? completeStep(`table:${table.id}`) : setFeedback("Ce n’est pas la bonne cellule.")}>{cell.text}</button>)}</div>)}
      </div>

      {activeNodeId && activeNodeTarget && <div className="tree-reader-modal-backdrop"><div className="tree-reader-modal"><button className="tree-reader-modal-close" type="button" onClick={() => setActiveNodeId(null)}><X size={18} /></button><h3>Que représente ce rectangle?</h3><div className="tree-reader-category"><button type="button" className={nodeCategory === "group" ? "active" : ""} onClick={() => { setNodeCategory("group"); setNodeAnswer(""); }}>Groupe de mots</button><button type="button" className={nodeCategory === "class" ? "active" : ""} onClick={() => { setNodeCategory("class"); setNodeAnswer(""); }}>Classe de mots</button></div>{nodeCategory === "group" && <select value={nodeAnswer} onChange={(event) => setNodeAnswer(event.target.value)}><option value="">Choisir…</option>{Object.entries(groupLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>}{nodeCategory === "class" && <select value={nodeAnswer} onChange={(event) => setNodeAnswer(event.target.value)}><option value="">Choisir…</option>{Object.entries(wordClassLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>}<Button type="button" onClick={submitNode} disabled={!nodeAnswer}><Check size={17} /> Valider</Button></div></div>}
      <div className="interactive-reader-actions">{isComplete ? finishControl : null}</div>
    </div>
  );
}
