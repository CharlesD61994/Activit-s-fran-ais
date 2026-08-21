"use client";

import { useEffect, useMemo, useState } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReaderChromePortal } from "@/components/presentation/reader-chrome";
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
const DEFAULT_PHASE_ORDER = ["groups", "nuclei", "linked_nodes", "functions", "remaining_nodes", "tables"] as const;
type ReaderPhase = typeof DEFAULT_PHASE_ORDER[number];

type Props = {
  sentence: Sentence;
  persistenceKey?: string;
  onCompleteChange?: (complete: boolean) => void;
  finishControl?: ReactNode;
};

type TextSelection = { textBoxId: string; start: number; end: number };

function trimSelectionWhitespace(text: string, selection: TextSelection): TextSelection {
  let start = selection.start;
  let end = selection.end;
  while (start < end && /\s/u.test(text[start])) start += 1;
  while (end > start && /\s/u.test(text[end - 1])) end -= 1;
  return { ...selection, start, end };
}

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
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const difference = [...expectedSet].filter((value) => !actualSet.has(value)).length + [...actualSet].filter((value) => !expectedSet.has(value)).length;
  if (tolerance === "normal") return difference <= 1;
  return difference <= 2;
}

function estimateTableHeight(table: NonNullable<Sentence["treeAnalysisTables"]>[number]) {
  const firstCell = table.cells[0];
  const hasMergedQuestion = Boolean(firstCell?.columnSpan && firstCell.columnSpan > 1);
  if (!hasMergedQuestion) return table.rows * 50;
  const questionLines = Math.max(1, Math.ceil((firstCell?.text.length ?? 0) / 34));
  const questionHeight = Math.max(50, questionLines * 23 + 20);
  return questionHeight + Math.max(0, table.rows - 1) * 50;
}

export function TreeAnalysisReader({ sentence, persistenceKey, onCompleteChange, finishControl }: Props) {
  const nodes = useMemo(() => sentence.treeAnalysisNodes ?? [], [sentence.treeAnalysisNodes]);
  const interactions = useMemo(() => sentence.treeAnalysisInteractions ?? [], [sentence.treeAnalysisInteractions]);
  const tables = useMemo(() => sentence.treeAnalysisTables ?? [], [sentence.treeAnalysisTables]);
  const textBoxes = useMemo(() => sentence.treeAnalysisTextBoxes ?? [], [sentence.treeAnalysisTextBoxes]);
  const relations = useMemo(() => sentence.treeAnalysisRelations ?? [], [sentence.treeAnalysisRelations]);
  const documentPages = useMemo(() => sentence.treeAnalysisDocumentPages ?? [], [sentence.treeAnalysisDocumentPages]);
  const questionBadges = useMemo(() => sentence.treeAnalysisQuestionBadges ?? [], [sentence.treeAnalysisQuestionBadges]);
  const nodeWidth = sentence.treeAnalysisPage?.nodeWidth ?? 72;
  const nodeHeight = sentence.treeAnalysisPage?.nodeHeight ?? 44;
  const nodeDimensions = (node: TreeAnalysisNode) => {
    const page = documentPages.find((item) => item.id === (node.pageId ?? documentPages[0]?.id));
    return page?.rectanglePreset === "compact" ? { width: 78, height: 19 } : { width: nodeWidth, height: nodeHeight };
  };
  const flow = sentence.treeAnalysisFlow ?? { preset: "tree_functions_tables" as const, orderedStepIds: [], selectionTolerance: "normal" as const };
  const [completed, setCompleted] = useState<string[]>([]);
  const [nodeDrafts, setNodeDrafts] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState("");
  const [framedAnswers, setFramedAnswers] = useState<Array<{ textBoxId: string; start: number; end: number }>>([]);
  const [drawingStart, setDrawingStart] = useState<{ x: number; y: number } | null>(null);
  const [drawingCurrent, setDrawingCurrent] = useState<{ x: number; y: number } | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [zoom, setZoom] = useState(1);

  const pagePhaseData = useMemo(() => documentPages.map((page) => {
    const owns = (pageId?: string) => (pageId ?? documentPages[0]?.id) === page.id;
    const pageInteractions = interactions.filter((item) => owns(textBoxes.find((box) => box.id === item.textBoxId)?.pageId));
    const linkedIds = Array.from(new Set(pageInteractions.map((item) => item.linkedNodeId).filter((id): id is string => Boolean(id))));
    const phases: Record<ReaderPhase, string[]> = {
      groups: pageInteractions.filter((item) => item.kind === "group").map((item) => `interaction:${item.id}`),
      nuclei: pageInteractions.filter((item) => item.kind === "nucleus").map((item) => `interaction:${item.id}`),
      linked_nodes: linkedIds.map((id) => `node:${id}`),
      functions: pageInteractions.filter((item) => item.kind === "function").map((item) => `interaction:${item.id}`),
      remaining_nodes: nodes.filter((node) => owns(node.pageId) && !linkedIds.includes(node.id)).map((node) => `node:${node.id}`),
      tables: tables.filter((table) => owns(table.pageId)).map((table) => `table:${table.id}`)
    };
    const order = [...(page.readerPhaseOrder ?? []), ...DEFAULT_PHASE_ORDER.filter((phase) => !page.readerPhaseOrder?.includes(phase))];
    return { pageId: page.id, phases, order: order.filter((phase) => phases[phase].length) };
  }), [documentPages, interactions, nodes, tables, textBoxes]);
  const steps = pagePhaseData.flatMap((page) => page.order.flatMap((phase) => page.phases[phase]));
  const currentStep = steps.find((id) => !completed.includes(id));
  const currentInteraction = currentStep?.startsWith("interaction:") ? interactions.find((item) => `interaction:${item.id}` === currentStep) : undefined;
  const currentNode = currentStep?.startsWith("node:") ? nodes.find((item) => `node:${item.id}` === currentStep) : undefined;
  const currentTable = currentStep?.startsWith("table:") ? tables.find((item) => `table:${item.id}` === currentStep) : undefined;
  useEffect(() => {
    setDrawingStart(null);
    setDrawingCurrent(null);
  }, [currentInteraction?.id, currentInteraction?.responseMode]);
  const currentPageId = currentNode?.pageId ?? currentTable?.pageId ?? textBoxes.find((box) => box.id === currentInteraction?.textBoxId)?.pageId ?? documentPages[0]?.id;
  const ownsCurrentPage = (pageId?: string) => (pageId ?? documentPages[0]?.id) === currentPageId;
  const visibleTextBoxes = textBoxes.filter((box) => ownsCurrentPage(box.pageId));
  const visibleNodes = nodes.filter((node) => ownsCurrentPage(node.pageId));
  const visibleTables = tables.filter((table) => ownsCurrentPage(table.pageId));
  const currentPage = documentPages.find((page) => page.id === currentPageId);
  const currentPageIndex = Math.max(0, documentPages.findIndex((page) => page.id === currentPageId));
  const showFullPortraitPage = currentPage?.orientation === "portrait";
  const currentPhase = pagePhaseData.find((page) => page.pageId === currentPageId)?.order.find((phase) => pagePhaseData.find((item) => item.pageId === currentPageId)?.phases[phase].includes(currentStep ?? ""));
  const currentPhaseNodeIds = currentPhase ? pagePhaseData.find((page) => page.pageId === currentPageId)?.phases[currentPhase].filter((id) => id.startsWith("node:")).map((id) => id.slice(5)) ?? [] : [];
  const freeTreePhase = currentPhaseNodeIds.length > 0;
  const contentTop = Math.min(...visibleTextBoxes.map((box) => box.y), ...visibleNodes.map((node) => node.y), ...visibleTables.map((table) => table.y), 90);
  const contentBottom = Math.max(...visibleTextBoxes.map((box) => box.y + Math.max(box.height, box.fontSize * 1.5)), ...visibleNodes.map((node) => node.y + nodeDimensions(node).height), ...visibleTables.map((table) => table.y + estimateTableHeight(table)), 260);
  const topOffset = showFullPortraitPage ? 0 : Math.max(0, contentTop - 4);
  const visibleBottom = contentBottom + 32;
  const visibleHeight = showFullPortraitPage ? 816 : Math.max(180, visibleBottom - topOffset);

  useEffect(() => {
    if (!persistenceKey || typeof window === "undefined") { setHydrated(true); return; }
    try {
      const raw = window.sessionStorage.getItem(persistenceKey);
      if (raw) {
        const saved = JSON.parse(raw) as { completed?: string[]; nodeDrafts?: Record<string, string>; framedAnswers?: Array<{ textBoxId: string; start: number; end: number }> };
        setCompleted(saved.completed ?? []);
        setNodeDrafts(saved.nodeDrafts ?? {});
        setFramedAnswers(saved.framedAnswers ?? []);
        onCompleteChange?.((saved.completed?.length ?? 0) >= steps.length && steps.length > 0);
      }
    } catch { window.sessionStorage.removeItem(persistenceKey); }
    setHydrated(true);
    // Restore only when opening this activity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistenceKey, sentence.id]);

  useEffect(() => {
    if (!hydrated || !persistenceKey || typeof window === "undefined") return;
    window.sessionStorage.setItem(persistenceKey, JSON.stringify({ completed, nodeDrafts, framedAnswers }));
  }, [completed, framedAnswers, hydrated, nodeDrafts, persistenceKey]);

  function restartActivity() {
    setCompleted([]);
    setNodeDrafts({});
    setFramedAnswers([]);
    setFeedback("");
    setDrawingStart(null);
    setDrawingCurrent(null);
    onCompleteChange?.(false);
    if (persistenceKey && typeof window !== "undefined") window.sessionStorage.removeItem(persistenceKey);
  }

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
    setFramedAnswers((current) => [...current, trimSelectionWhitespace(box.text, candidate)]);
    completeStep(`interaction:${currentInteraction.id}`);
    window.getSelection()?.removeAllRanges();
  }

  function handleDrawingClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (!currentInteraction || currentInteraction.responseMode === "click") return;
    if ((event.target as HTMLElement).closest("button")) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = { x: (event.clientX - rect.left) / zoom, y: (event.clientY - rect.top) / zoom };
    if (!drawingStart) {
      setDrawingStart(point);
      setDrawingCurrent(point);
      setFeedback("Clique maintenant sur le coin opposé du rectangle.");
      return;
    }
    const left = Math.min(drawingStart.x, point.x) - 6;
    const right = Math.max(drawingStart.x, point.x) + 6;
    const top = Math.min(drawingStart.y, point.y) - 18;
    const bottom = Math.max(drawingStart.y, point.y) + 18;
    const words = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(`.tree-reader-word[data-box-id="${currentInteraction.textBoxId}"]`)).filter((word) => {
      const wordRect = word.getBoundingClientRect();
      const wordLeft = (wordRect.left - rect.left) / zoom;
      const wordRight = (wordRect.right - rect.left) / zoom;
      const wordTop = (wordRect.top - rect.top) / zoom;
      const wordBottom = (wordRect.bottom - rect.top) / zoom;
      const centerX = (wordLeft + wordRight) / 2;
      return centerX >= left && centerX <= right && wordBottom >= top && wordTop <= bottom;
    });
    const candidate = words.length ? { textBoxId: currentInteraction.textBoxId, start: Math.min(...words.map((word) => Number(word.dataset.start))), end: Math.max(...words.map((word) => Number(word.dataset.end))) } : null;
    setDrawingStart(null);
    setDrawingCurrent(null);
    verifyFraming(candidate);
  }

  function handleWordClick(event: ReactMouseEvent<HTMLElement>, boxId: string, start: number, end: number) {
    if (!currentInteraction || currentInteraction.responseMode !== "click") return;
    event.stopPropagation();
    if (currentInteraction.textBoxId !== boxId || end <= currentInteraction.start || start >= currentInteraction.end) {
      setFeedback("Ce n’est pas le bon mot. Réessaie.");
      return;
    }
    const box = textBoxes.find((item) => item.id === boxId);
    if (box) setFramedAnswers((current) => [...current, trimSelectionWhitespace(box.text, { textBoxId: boxId, start: currentInteraction.start, end: currentInteraction.end })]);
    completeStep(`interaction:${currentInteraction.id}`);
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
      <ReaderChromePortal slot="viewTools">
        <div className="tree-reader-zoom">
          <button type="button" onClick={() => setZoom((value) => Math.max(.6, value - .1))} aria-label="Réduire"><Minus size={16} /></button>
          <button type="button" onClick={() => setZoom(1)}>{Math.round(zoom * 100)} %</button>
          <button type="button" onClick={() => setZoom((value) => Math.min(2, value + .1))} aria-label="Agrandir"><Plus size={16} /></button>
        </div>
      </ReaderChromePortal>
      <ReaderChromePortal slot="instruction">
        <div className="reader-chrome-instruction-copy">
          <strong>{currentInteraction?.instruction ?? (currentNode ? (freeTreePhase ? "Identifie tous les groupes et toutes les classes de mots dans les rectangles." : "Identifie le rectangle actif.") : currentTable ? "Choisis la bonne réponse dans le tableau." : "Activité terminée!")}</strong>
          {currentInteraction && <span>{currentInteraction.responseMode === "click" ? "Clique directement sur le mot demandé." : "Clique un premier coin, puis le coin opposé pour tracer ton encadrement."}</span>}
          {feedback && <span className="reader-chrome-feedback">{feedback}</span>}
        </div>
      </ReaderChromePortal>
      <ReaderChromePortal slot="progress">
        <div className="reader-chrome-progress">
          <strong>Étape {Math.min(completed.length + 1, steps.length || 1)} sur {steps.length || 1}</strong>
          <div className="tree-reader-progress"><span style={{ width: `${steps.length ? completed.length / steps.length * 100 : 0}%` }} /></div>
        </div>
      </ReaderChromePortal>

      <div className="tree-reader-page-viewport"><div className={`tree-reader-page ${currentInteraction && currentInteraction.responseMode !== "click" ? "drawing" : ""} ${currentInteraction?.responseMode === "click" ? "clicking" : ""} ${showFullPortraitPage ? "portrait document-template" : ""}`} style={{ aspectRatio: showFullPortraitPage ? "8.5 / 11" : `1056 / ${visibleHeight}`, zoom }} onClick={handleDrawingClick} onMouseMove={(event) => { if (!drawingStart || currentInteraction?.responseMode === "click") return; const rect = event.currentTarget.getBoundingClientRect(); setDrawingCurrent({ x: (event.clientX - rect.left) / zoom, y: (event.clientY - rect.top) / zoom }); }}>
        {showFullPortraitPage && currentPage?.template === "teaching_document" && <>
          <div className="tree-analysis-document-header" style={{ left: `${currentPage.margins.left / 1056 * 100}%`, right: `${currentPage.margins.right / 1056 * 100}%`, top: `${(currentPage.header?.nameY ?? 25) / 816 * 100}%` }}>
            <div className="tree-analysis-document-header-top"><div className="tree-analysis-student-fields"><span>NOM</span><span>GROUPE</span></div><div className="tree-analysis-page-cell"><div className="tree-analysis-page-badge">{currentPageIndex + 1}</div></div></div>
            <div className="tree-analysis-document-header-bottom"><div>{currentPage.header?.activityType || "EXERCICES"}</div><div>{currentPage.header?.activityTitle || sentence.title || "Les analyses en arbre"}</div></div>
          </div>
          {(currentPage.mainTitle?.enabled ?? true) && <div className="tree-analysis-document-title-banner" style={{ left: `${(currentPage.margins.left - 53) / 1056 * 100}%`, right: `${(currentPage.margins.right - 53) / 1056 * 100}%`, top: `${82 / 816 * 100}%` }}><div className="tree-analysis-document-title-line">{currentPage.mainTitle?.prefix || "Exercices"} <span>–</span> {currentPage.mainTitle?.title || "Les analyses en arbre"}</div><div className="tree-analysis-document-title-label">{currentPage.mainTitle?.subtitle || "L’analyse des groupes de mots"}</div></div>}
          {questionBadges.filter((badge) => badge.pageId === currentPageId).map((badge) => <div key={badge.id} className="tree-analysis-question-badge reader" style={{ left: `${badge.x / 1056 * 100}%`, top: `${badge.y / 816 * 100}%` }}><span>{badge.number}</span></div>)}
        </>}
        {visibleTextBoxes.map((box) => {
          const revealed = interactions.filter((item) => item.textBoxId === box.id && completed.includes(`interaction:${item.id}`)).map((item) => ({ ...item, ...trimSelectionWhitespace(box.text, item) }));
          const boundaries = Array.from(new Set([0, box.text.length, ...revealed.flatMap((item) => [item.start, item.end])])).sort((a, b) => a - b);
          const styledSegments = boundaries.slice(0, -1).map((segmentStart, segmentIndex) => {
            const segmentEnd = boundaries[segmentIndex + 1];
            const segmentAnswers = revealed.filter((item) => item.start <= segmentStart && item.end >= segmentEnd);
            const framed = segmentAnswers.some((item) => !item.authorMark || item.authorMark === "frame");
            const colorAnswer = [...segmentAnswers].reverse().find((item) => item.authorMark === "red" || item.authorMark === "blue" || item.authorMark === "green");
            const color = colorAnswer?.authorMark === "red" ? "#d93434" : colorAnswer?.authorMark === "blue" ? "#2467d1" : colorAnswer?.authorMark === "green" ? "#22834b" : undefined;
            return { start: segmentStart, end: segmentEnd, framed, color };
          });
          const visualGroups = styledSegments.reduce<Array<{ framed: boolean; segments: typeof styledSegments }>>((groups, segment) => { const last = groups[groups.length - 1]; if (last?.framed === segment.framed) last.segments.push(segment); else groups.push({ framed: segment.framed, segments: [segment] }); return groups; }, []);
          return <div key={box.id} className="tree-reader-text" style={{ left: `${box.x / 1056 * 100}%`, top: `${(box.y - topOffset) / visibleHeight * 100}%`, width: `${box.width / 1056 * 100}%`, fontSize: `${box.fontSize / 1056 * 100}cqw`, textAlign: box.textAlign ?? "left" }}>{visualGroups.map((group, groupIndex) => <span key={`${groupIndex}-${group.segments[0]?.start}`} className={group.framed ? "tree-reader-framed" : undefined}>{group.segments.map((segment) => { let tokenOffset = segment.start; const tokens = box.text.slice(segment.start, segment.end).match(/\S+|\s+/g) ?? []; return <span key={`${segment.start}-${segment.end}`} style={{ color: segment.color }}>{tokens.map((token, tokenIndex) => { const start = tokenOffset; const end = start + token.length; tokenOffset = end; return /^\s+$/u.test(token) ? token : <span key={`${tokenIndex}-${start}`} className="tree-reader-word" data-box-id={box.id} data-start={start} data-end={end} onClick={(event) => handleWordClick(event, box.id, start, end)}>{token}</span>; })}</span>; })}</span>)}</div>;
        })}
        <svg className="tree-reader-lines" viewBox={`0 0 1056 ${visibleHeight}`} preserveAspectRatio="none">{relations.map((relation) => { const parent = visibleNodes.find((node) => node.id === relation.parentNodeId); const child = visibleNodes.find((node) => node.id === relation.childNodeId); if (!parent || !child) return null; const parentSize = nodeDimensions(parent); const childSize = nodeDimensions(child); return <line key={relation.id} x1={parent.x + parentSize.width / 2} y1={parent.y + parentSize.height + 1 - topOffset} x2={child.x + childSize.width / 2} y2={child.y - 1 - topOffset} />; })}</svg>
        {visibleNodes.map((node) => {
          const stepId = `node:${node.id}`;
          const done = completed.includes(stepId);
          const active = !done && (freeTreePhase ? currentPhaseNodeIds.includes(node.id) : currentNode?.id === node.id);
          const currentSize = nodeDimensions(node);
          return <div key={node.id} className={`tree-reader-node ${active ? "active" : ""} ${done ? "done" : ""}`} style={{ left: `${node.x / 1056 * 100}%`, top: `${(node.y - topOffset) / visibleHeight * 100}%`, width: `${currentSize.width / 1056 * 100}%`, height: `${currentSize.height / visibleHeight * 100}%` }}>{done ? <strong>{expectedNodeLabel(node)}</strong> : active ? <input aria-label="Réponse du rectangle" value={nodeDrafts[node.id] ?? ""} onClick={(event) => event.stopPropagation()} onChange={(event) => setNodeDrafts((current) => ({ ...current, [node.id]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); submitNode(node, nodeDrafts[node.id] ?? ""); } }} autoComplete="off" placeholder="?" /> : null}</div>;
        })}
        {visibleTables.map((table) => { const tableDone = completed.includes(`table:${table.id}`); return <div key={table.id} className={`tree-reader-table ${currentTable?.id === table.id ? "active" : ""}`} style={{ left: `${table.x / 1056 * 100}%`, top: `${(table.y - topOffset) / visibleHeight * 100}%`, gridTemplateColumns: `repeat(${table.columns},1fr)` }}>{table.cells.map((cell, index) => cell.columnSpan === 0 ? null : <button type="button" key={index} className={tableDone && cell.isCorrect ? "selected-correct" : ""} style={{ gridColumn: cell.columnSpan && cell.columnSpan > 1 ? `span ${cell.columnSpan}` : undefined }} disabled={currentTable?.id !== table.id} onClick={(event) => { event.stopPropagation(); if (cell.isCorrect) completeStep(`table:${table.id}`); else setFeedback("Ce n’est pas la bonne cellule."); }}>{cell.text}</button>)}</div>; })}
        {drawingStart && drawingCurrent && <div className="tree-reader-drawing-box" style={{ left: Math.min(drawingStart.x, drawingCurrent.x), top: Math.min(drawingStart.y, drawingCurrent.y), width: Math.abs(drawingCurrent.x - drawingStart.x), height: Math.abs(drawingCurrent.y - drawingStart.y) }} />}
      </div></div>

      <ReaderChromePortal slot="actions"><Button type="button" variant="secondary" onClick={restartActivity}><RotateCcw size={18} /> Recommencer</Button>{completed.length >= steps.length ? finishControl : null}</ReaderChromePortal>
    </div>
  );
}
