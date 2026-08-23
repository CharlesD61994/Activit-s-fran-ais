"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AlignCenter, AlignJustify, AlignLeft, ArrowDown, ArrowUp, Bold, Check, ChevronDown, ChevronUp, Grid3X3, ImagePlus, Merge, Plus, Printer, Save, Split, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SchoolLevel, Sentence, SentenceDifficulty, TreeAnalysisDocumentPage, TreeAnalysisQuestionBadge, TreeAnalysisScoreBox, TreeAnalysisTable, TreeAnalysisTableCell, TreeAnalysisTextBox, WorksheetAnswerLines, WorksheetCheckboxMark, WorksheetDimensionBand, WorksheetImage } from "@/types";
import { createWorksheetTable, isFixedWorksheetTable, normalizedColumnWidths, normalizedRowHeights, tableTemplateLabel, worksheetTableWidth, type WorksheetTableTemplate } from "@/lib/worksheet-tables";
import { worksheetDimensionAsset } from "@/lib/worksheet-dimensions";
import { worksheetTextWrap } from "@/lib/worksheet-images";
import { captureSharedTextSelection, rebaseSharedTextRange, renderSharedAnnotatedText, type SharedTextRange } from "@/components/grammar/shared-annotated-text";

type Props = { initialSentence?: Sentence; levels: SchoolLevel[]; onSave: (sentence: Sentence) => void; controlledTitle?: string; onTitleChange?: (title: string) => void };
type MovableKind = "text" | "score" | "table" | "badge" | "lines" | "check" | "band" | "image";
type DragKind = MovableKind | "text-resize" | "lines-resize" | "score-resize" | "table-resize" | "image-resize";
type DragState = { kind: DragKind; id: string; offsetX: number; offsetY: number } | null;
type SelectedItem = { kind: MovableKind; id: string };
type MarqueeState = { startX: number; startY: number; x: number; y: number };
type TableDialogState = { kind: WorksheetTableTemplate; rows: number; columns: number; maxPoints: number; dimension: WorksheetDimensionBand["dimension"] };

const W = 1056;
const H = 816;
const defaultPage = (id = crypto.randomUUID()): TreeAnalysisDocumentPage => ({
  id,
  orientation: "portrait",
  template: "teaching_document",
  rectanglePreset: "compact",
  margins: { top: 68, right: 121, bottom: 50, left: 121 },
  header: { nameX: 121, nameY: 25, groupX: 650, groupY: 25, fontSize: 11, lineWidth: 250, activityType: "EXERCICES", activityTitle: "Feuille d’activité", showPageBadge: true },
  mainTitle: { enabled: true, prefix: "Exercices", title: "Feuille d’activité", subtitle: "Activité" },
  taskCallout: { enabled: false, text: "Lis le texte narratif suivant, puis réponds aux questions des 4 dimensions de la lecture." }
});
const difficultyLabels: Record<SentenceDifficulty, string> = { easy: "Facile", medium: "Moyenne", hard: "Difficile" };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const ALIGNMENT_TOLERANCE = 6;
const WORKSHEET_TEXT_LINE_HEIGHT = 1.1;
const answerLineHeight = (item: WorksheetAnswerLines) => `${item.lineSpacing / W * 100}cqw`;

function renderedLineCenters(element: HTMLElement) {
  const root = element.getBoundingClientRect();
  const centers: number[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const value = node.textContent ?? "";
    for (let index = 0; index < value.length; index += 1) {
      if (/\s/u.test(value[index]) && value[index] !== "\u00a0") continue;
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + 1);
      const rect = range.getClientRects()[0];
      if (rect?.height) {
        const center = rect.top - root.top + rect.height / 2;
        if (!centers.some((candidate) => Math.abs(candidate - center) < 2)) centers.push(center);
      }
    }
    node = walker.nextNode();
  }
  return centers.sort((a, b) => a - b);
}
function WorksheetLineNumbers({ centers }: { centers: number[] }) {
  return <div className="worksheet-line-numbers" aria-hidden>{centers.map((top, index) => (index + 1) % 5 === 0 ? <span key={index} style={{ top: `${top}%` }}>{index + 1}</span> : null)}</div>;
}

function WorksheetEditableText({ box, wrap, onCommit, onSelect, onSelection }: { box: TreeAnalysisTextBox; wrap: ReturnType<typeof worksheetTextWrap>; onCommit: (text: string) => void; onSelect: () => void; onSelection: (range: SharedTextRange | null) => void }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [lineCenters, setLineCenters] = useState<number[]>([]);

  useLayoutEffect(() => {
    const element = contentRef.current;
    if (!element || !box.showLineNumbers) { setLineCenters([]); return; }
    const measure = () => {
      const height = Math.max(1, element.clientHeight);
      setLineCenters(renderedLineCenters(element).map((center) => center / height * 100));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [box.annotations, box.fontSize, box.height, box.showLineNumbers, box.text, box.width, wrap]);

  return <>
    {box.showLineNumbers && <WorksheetLineNumbers centers={lineCenters}/>}
    <div
      ref={contentRef}
      className={`tree-analysis-text-content ${wrap ? "worksheet-wrapped-text" : "worksheet-textarea"}`}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      onPointerDown={(event)=>{event.stopPropagation();onSelect();}}
      onInput={(event)=>onCommit(event.currentTarget.innerText.replace(/\r/g,""))}
      onMouseUp={(event)=>onSelection(captureSharedTextSelection(event.currentTarget))}
      onKeyUp={(event)=>onSelection(captureSharedTextSelection(event.currentTarget))}
    >
      {wrap && <span className={`worksheet-text-wrap-space ${wrap.side}`} contentEditable={false} style={{width:`${wrap.width/box.width*100}%`,height:`${wrap.height/box.height*100}%`,"--worksheet-wrap-top":`${wrap.marginTop/Math.max(1,wrap.height)*100}%`} as React.CSSProperties}/>}
      {renderSharedAnnotatedText(box.text, box.annotations, "tree-analysis-framed-text")}
    </div>
  </>;
}

function WorksheetTableCellEditor({ cell, onTextChange }: { cell: TreeAnalysisTableCell; onTextChange: (text: string) => void }) {
  const style = { fontSize:`${(cell.fontSize??17)/W*100}cqw`, textAlign:cell.textAlign??"center" as const, fontWeight:cell.bold?800:500, alignSelf: cell.verticalAlign === "top" ? "flex-start" : cell.verticalAlign === "bottom" ? "flex-end" : "center" };
  if (cell.role === "header" || cell.role === "total") return <div className="worksheet-table-static-cell" style={style}>{cell.text}</div>;
  return <div className="worksheet-table-editable-copy" contentEditable suppressContentEditableWarning spellCheck style={style} onBlur={(event)=>onTextChange(event.currentTarget.innerText.replace(/\r/g,""))}>{cell.text}</div>;
}

function WorksheetAnswerLinesEditor({ item, onSelect, onCommit }: { item: WorksheetAnswerLines; onSelect: () => void; onCommit: (patch: Partial<WorksheetAnswerLines>) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  function measureLineCount(element: HTMLElement) {
    const visualLines = renderedLineCenters(element).length;
    const explicitLines = element.innerText.split("\n").length;
    return Math.max(1, visualLines, explicitLines);
  }

  function commitFromElement(element: HTMLElement) {
    const answer = element.innerText.replace(/\r/g, "");
    const measuredLineCount = measureLineCount(element);
    const lineCount = answer.trim() ? clamp(Math.max(item.lineCount, measuredLineCount), 1, 30) : item.lineCount;
    onCommit({ answer, lineCount });
  }

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || document.activeElement === element || element.innerText === item.answer) return;
    element.innerText = item.answer;
  }, [item.answer]);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const measuredLineCount = measureLineCount(element);
      if (measuredLineCount > item.lineCount) onCommit({ lineCount: measuredLineCount });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [item.answerFontSize, item.lineCount, item.lineSpacing, item.width, onCommit]);

  return <div
    ref={ref}
    className="worksheet-answer-copy worksheet-answer-editor"
    contentEditable
    suppressContentEditableWarning
    spellCheck
    style={{ fontSize: `${item.answerFontSize / W * 100}cqw`, lineHeight: answerLineHeight(item), fontWeight: item.answerBold ? 800 : 400, textAlign: item.answerTextAlign ?? "left" }}
    onPointerDown={(event)=>{event.stopPropagation();onSelect();}}
    onInput={(event)=>commitFromElement(event.currentTarget)}
    onBlur={(event)=>commitFromElement(event.currentTarget)}
  />;
}

export function WorksheetEditor({ initialSentence, levels, onSave, controlledTitle, onTitleChange }: Props) {
  const [internalTitle, setInternalTitle] = useState(initialSentence?.title ?? "");
  const title = controlledTitle ?? internalTitle;
  const setTitle = onTitleChange ?? setInternalTitle;
  const [levelId, setLevelId] = useState(initialSentence?.levelId ?? levels[0]?.id ?? "");
  const [difficulty, setDifficulty] = useState<SentenceDifficulty>(initialSentence?.difficulty ?? "medium");
  const [tags, setTags] = useState<string[]>(initialSentence?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [pages, setPages] = useState<TreeAnalysisDocumentPage[]>(() => initialSentence?.treeAnalysisDocumentPages?.length ? initialSentence.treeAnalysisDocumentPages.map((page) => {
    const defaults = defaultPage(page.id);
    return { ...defaults, ...page, header: { ...defaults.header!, ...page.header }, mainTitle: { ...defaults.mainTitle!, ...page.mainTitle }, taskCallout: { ...defaults.taskCallout!, ...page.taskCallout }, orientation: "portrait", template: "teaching_document" };
  }) : [defaultPage("page-1")]);
  const [activePageId, setActivePageId] = useState(() => initialSentence?.treeAnalysisDocumentPages?.[0]?.id ?? "page-1");
  const [textBoxes, setTextBoxes] = useState<TreeAnalysisTextBox[]>(initialSentence?.treeAnalysisTextBoxes ?? []);
  const [scoreBoxes, setScoreBoxes] = useState<TreeAnalysisScoreBox[]>(initialSentence?.treeAnalysisScoreBoxes ?? []);
  const [tables, setTables] = useState<TreeAnalysisTable[]>(initialSentence?.treeAnalysisTables ?? []);
  const [badges, setBadges] = useState<TreeAnalysisQuestionBadge[]>(initialSentence?.treeAnalysisQuestionBadges ?? []);
  const [answerLines, setAnswerLines] = useState<WorksheetAnswerLines[]>(initialSentence?.worksheetAnswerLines ?? []);
  const [checkBoxes, setCheckBoxes] = useState<WorksheetCheckboxMark[]>(initialSentence?.worksheetCheckBoxes ?? []);
  const [dimensionBands, setDimensionBands] = useState<WorksheetDimensionBand[]>(initialSentence?.worksheetDimensionBands ?? []);
  const [images, setImages] = useState<WorksheetImage[]>(initialSentence?.worksheetImages ?? []);
  const [readerOrder, setReaderOrder] = useState<string[]>(initialSentence?.worksheetReaderOrder ?? []);
  const [selected, setSelected] = useState<{ kind: MovableKind; id: string } | null>(null);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const [alignmentGuides, setAlignmentGuides] = useState<{ x?: number; y?: number }>({});
  const [printMode, setPrintMode] = useState<"student" | "answer">("student");
  const [tableDialog, setTableDialog] = useState<TableDialogState | null>(null);
  const [bandDialog, setBandDialog] = useState<WorksheetDimensionBand["dimension"] | null>(null);
  const [selectedCells, setSelectedCells] = useState<number[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [headerControlsOpen, setHeaderControlsOpen] = useState(false);
  const [textSelection, setTextSelection] = useState<SharedTextRange | null>(null);
  const textSelectionRef = useRef<SharedTextRange | null>(null);
  const drag = useRef<DragState>(null);
  const marqueeRef = useRef<MarqueeState | null>(null);
  const groupOrigins = useRef<Record<string, { x: number; y: number }>>({});
  const suppressCanvasClickRef = useRef(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const activePage = pages.find((page) => page.id === activePageId) ?? pages[0];

  function updateTextSelection(range: SharedTextRange | null) {
    textSelectionRef.current = range;
    setTextSelection(range);
  }

  function selectTextBox(id: string) {
    if (selected?.kind !== "text" || selected.id !== id) updateTextSelection(null);
    setSelected({ kind: "text", id });
  }

  function commitText(box: TreeAnalysisTextBox, nextText: string) {
    setTextBoxes((items) => items.map((item) => item.id === box.id ? {
      ...item,
      text: nextText,
      annotations: item.annotations.map((annotation) => ({ ...annotation, ...rebaseSharedTextRange(item.text, nextText, annotation.start, annotation.end) })).filter((annotation) => annotation.end > annotation.start)
    } : item));
  }

  function selectedTextStyle(box: TreeAnalysisTextBox | undefined) {
    const range = textSelectionRef.current ?? textSelection;
    if (!box || !range || range.start === range.end) return { bold: box?.bold ?? false, fontScale: 1 };
    const marks = box.annotations.filter((item) => item.start <= range.start && item.end > range.start);
    return {
      bold: [...marks].reverse().find((item) => item.bold !== undefined)?.bold ?? false,
      fontScale: [...marks].reverse().find((item) => item.fontScale !== undefined)?.fontScale ?? 1
    };
  }

  function applyTextFormat(box: TreeAnalysisTextBox, patch: { bold?: boolean; fontScale?: number }) {
    const range = textSelectionRef.current ?? textSelection;
    if (!range || range.start === range.end) {
      setTextBoxes((items) => items.map((item) => item.id === box.id ? { ...item, bold: patch.bold ?? item.bold, fontSize: patch.fontScale ? item.fontSize * patch.fontScale : item.fontSize } : item));
      return;
    }
    setTextBoxes((items) => items.map((item) => item.id === box.id ? { ...item, annotations: [...item.annotations, { id: crypto.randomUUID(), start: range.start, end: range.end, ...patch }] } : item));
  }

  const pageSteps = useMemo(() => {
    const ids = answerLines.filter((item) => item.pageId === activePageId && (item.interactive !== false || Boolean(item.answer.trim()))).map((item) => `lines:${item.id}`);
    return [...readerOrder.filter((id) => ids.includes(id)), ...ids.filter((id) => !readerOrder.includes(id))];
  }, [activePageId, answerLines, readerOrder]);

  function updatePage(patch: Partial<TreeAnalysisDocumentPage>) {
    setPages((current) => current.map((page) => page.id === activePageId ? { ...page, ...patch, orientation: "portrait", template: "teaching_document" } : page));
  }

  function addPage() { const page = defaultPage(); setPages((current) => [...current, page]); setActivePageId(page.id); }
  function addText() {
    const box: TreeAnalysisTextBox = { id: crypto.randomUUID(), pageId: activePageId, x: 145, y: 190, width: 780, height: 220, text: "Écris ton texte ici.", fontSize: 20, textAlign: "left", annotations: [] };
    setTextBoxes((current) => [...current, box]); setSelected({ kind: "text", id: box.id });
  }
  function addScore() {
    const total = Math.max(1, Math.round(Number(window.prompt("Total de points", "10")) || 10));
    const box: TreeAnalysisScoreBox = { id: crypto.randomUUID(), pageId: activePageId, x: 740, y: 190, total, size: "normal", width: 120, height: 42 };
    setScoreBoxes((current) => [...current, box]); setSelected({ kind: "score", id: box.id });
  }
  function addBadge() {
    const pageBadges = badges.filter((badge) => badge.pageId === activePageId);
    const badge: TreeAnalysisQuestionBadge = { id: crypto.randomUUID(), pageId: activePageId, x: 121, y: 205 + pageBadges.length * 70, number: pageBadges.length + 1 };
    setBadges((current) => [...current, badge]); setSelected({ kind: "badge", id: badge.id });
  }
  function openTableDialog() {
    setTableDialog({ kind: "free", rows: 2, columns: 3, maxPoints: 3, dimension: "Compréhension" });
  }
  function openRubricDialog() {
    setTableDialog({ kind: "rubric", rows: 2, columns: 4, maxPoints: 3, dimension: "Compréhension" });
  }
  function addTable() {
    if (!tableDialog) return;
    const table = createWorksheetTable({
      ...tableDialog,
      rows: clamp(Math.round(tableDialog.rows), 1, 12),
      columns: clamp(Math.round(tableDialog.columns), 1, 8),
      maxPoints: clamp(Math.round(tableDialog.maxPoints), 1, 20),
      pageId: activePageId
    });
    setTables((current) => [...current, table]);
    setSelected({ kind: "table", id: table.id });
    setSelectedCells([]);
    setTableDialog(null);
  }
  function addLines() {
    const item: WorksheetAnswerLines = { id: crypto.randomUUID(), pageId: activePageId, x: 150, y: 300, width: 760, lineCount: 2, lineSpacing: 20, answer: "", answerFontSize: 18, answerTextAlign: "left" };
    setAnswerLines((current) => [...current, item]); setSelected({ kind: "lines", id: item.id });
  }
  function selectedTableTarget() {
    const table = selected?.kind === "table" ? tables.find((item) => item.id === selected.id) : undefined;
    if (!table) return null;
    const columnWidths = normalizedColumnWidths(table);
    const rowHeights = normalizedRowHeights(table);
    const cellIndex = selectedCells[0];
    if (cellIndex !== undefined) {
      const row = Math.floor(cellIndex / table.columns);
      const column = cellIndex % table.columns;
      const cell = table.cells[cellIndex];
      const x = table.x + columnWidths.slice(0, column).reduce((sum, value) => sum + value, 0);
      const y = table.y + rowHeights.slice(0, row).reduce((sum, value) => sum + value, 0);
      const width = columnWidths.slice(column, column + Math.max(1, cell?.columnSpan ?? 1)).reduce((sum, value) => sum + value, 0);
      const height = rowHeights.slice(row, row + Math.max(1, cell?.rowSpan ?? 1)).reduce((sum, value) => sum + value, 0);
      return { x, y, width, height };
    }
    return { x: table.x, y: table.y, width: worksheetTableWidth(table), height: rowHeights.reduce((sum, value) => sum + value, 0) };
  }
  function addLineInTable() {
    const target = selectedTableTarget();
    if (!target) return;
    const item: WorksheetAnswerLines = { id: crypto.randomUUID(), pageId: activePageId, x: target.x + 12, y: target.y + Math.max(20, target.height / 2), width: Math.max(45, target.width - 24), lineCount: 1, lineSpacing: 18, answer: "", answerFontSize: 18, answerTextAlign: "left" };
    setAnswerLines((current) => [...current, item]);
    setSelected({ kind: "lines", id: item.id });
  }
  function addCheckInTable() {
    const target = selectedTableTarget();
    if (!target) return;
    const item: WorksheetCheckboxMark = { id: crypto.randomUUID(), pageId: activePageId, x: target.x + 12, y: target.y + Math.max(8, target.height / 2 - 15), size: 30, checked: false };
    setCheckBoxes((current) => [...current, item]);
    setSelected({ kind: "check", id: item.id });
  }
  function addDimensionBand() {
    if (!bandDialog) return;
    const dimensions = worksheetDimensionAsset(bandDialog);
    const item: WorksheetDimensionBand = { id: crypto.randomUUID(), pageId: activePageId, x: 150, y: 280, width: dimensions.width, height: dimensions.height, dimension: bandDialog };
    setDimensionBands((current) => [...current, item]);
    setSelected({ kind: "band", id: item.id });
    setBandDialog(null);
  }
  function importImage(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = typeof reader.result === "string" ? reader.result : "";
      if (!src) return;
      const probe = new window.Image();
      probe.onload = () => {
        const width = 220;
        const height = clamp(width * probe.naturalHeight / Math.max(1, probe.naturalWidth), 80, 300);
        const item: WorksheetImage = { id: crypto.randomUUID(), pageId: activePageId, x: 150, y: 220, width, height, src, alt: file.name.replace(/\.[^.]+$/, ""), wrapText: true, layoutMode: "wrap" };
        setImages((current) => [...current, item]);
        setSelected({ kind: "image", id: item.id });
      };
      probe.src = src;
    };
    reader.readAsDataURL(file);
  }

  function movableItems() {
    return [
      ...textBoxes.filter((item) => item.pageId === activePageId).map((item) => ({ kind: "text" as const, id: item.id, x: item.x, y: item.y, width: item.width, height: item.height })),
      ...scoreBoxes.filter((item) => (item.pageId ?? pages[0]?.id) === activePageId).map((item) => ({ kind: "score" as const, id: item.id, x: item.x, y: item.y, width: item.width ?? 120, height: item.height ?? 42 })),
      ...tables.filter((item) => (item.pageId ?? pages[0]?.id) === activePageId).map((item) => ({ kind: "table" as const, id: item.id, x: item.x, y: item.y, width: worksheetTableWidth(item), height: normalizedRowHeights(item).reduce((sum, value) => sum + value, 0) })),
      ...badges.filter((item) => item.pageId === activePageId).map((item) => ({ kind: "badge" as const, id: item.id, x: item.x, y: item.y, width: 34, height: 34 })),
      ...answerLines.filter((item) => item.pageId === activePageId).map((item) => ({ kind: "lines" as const, id: item.id, x: item.x, y: item.y, width: item.width, height: item.lineCount * item.lineSpacing })),
      ...checkBoxes.filter((item) => item.pageId === activePageId).map((item) => ({ kind: "check" as const, id: item.id, x: item.x, y: item.y, width: item.size, height: item.size })),
      ...dimensionBands.filter((item) => item.pageId === activePageId).map((item) => ({ kind: "band" as const, id: item.id, x: item.x, y: item.y, width: item.width, height: item.height })),
      ...images.filter((item) => item.pageId === activePageId).map((item) => ({ kind: "image" as const, id: item.id, x: item.x, y: item.y, width: item.width, height: item.height }))
    ];
  }

  function beginMarquee(event: React.PointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (event.clientX - rect.left) * W / rect.width;
    const y = (event.clientY - rect.top) * H / rect.height;
    const next = { startX: x, startY: y, x, y };
    marqueeRef.current = next;
    setMarquee(next);
    setSelected(null);
    setSelectedItems([]);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function beginDrag(event: React.PointerEvent, kind: MovableKind, item: { id: string; x: number; y: number }) {
    if ((event.target as HTMLElement).closest("input,textarea,button,[contenteditable=true]")) return;
    const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return;
    drag.current = { kind, id: item.id, offsetX: (event.clientX - rect.left) * W / rect.width - item.x, offsetY: (event.clientY - rect.top) * H / rect.height - item.y };
    const movingSelection = selectedItems.some((candidate) => candidate.kind === kind && candidate.id === item.id) ? selectedItems : [{ kind, id: item.id }];
    setSelectedItems(movingSelection);
    groupOrigins.current = Object.fromEntries(movableItems().filter((candidate) => movingSelection.some((chosen) => chosen.kind === candidate.kind && chosen.id === candidate.id)).map((candidate) => [`${candidate.kind}:${candidate.id}`, { x: candidate.x, y: candidate.y }]));
    setSelected({ kind, id: item.id }); event.currentTarget.setPointerCapture(event.pointerId);
  }
  function beginResize(event: React.PointerEvent, kind: "text-resize" | "lines-resize" | "score-resize" | "table-resize" | "image-resize", item: { id: string; width: number; height?: number }) {
    event.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return;
    drag.current = { kind, id: item.id, offsetX: (event.clientX - rect.left) * W / rect.width - item.width, offsetY: (event.clientY - rect.top) * H / rect.height - (item.height ?? 0) };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDrag(event: React.PointerEvent) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (marqueeRef.current) {
      const next = { ...marqueeRef.current, x: (event.clientX - rect.left) * W / rect.width, y: (event.clientY - rect.top) * H / rect.height };
      marqueeRef.current = next;
      setMarquee(next);
      return;
    }
    const state = drag.current; if (!state) return;
    let x = (event.clientX - rect.left) * W / rect.width - state.offsetX;
    let y = (event.clientY - rect.top) * H / rect.height - state.offsetY;
    if (!state.kind.includes("resize") && selectedItems.length > 1) {
      const origin = groupOrigins.current[`${state.kind}:${state.id}`];
      if (origin) {
        const dx = x - origin.x; const dy = y - origin.y;
        const move = <T extends { id: string; x: number; y: number }>(items: T[], kind: MovableKind) => items.map((candidate) => { const start = groupOrigins.current[`${kind}:${candidate.id}`]; return start ? { ...candidate, x: clamp(start.x + dx, 0, W - 32), y: clamp(start.y + dy, 0, H - 24) } : candidate; });
        setTextBoxes((items) => move(items, "text")); setScoreBoxes((items) => move(items, "score")); setTables((items) => move(items, "table")); setBadges((items) => move(items, "badge")); setAnswerLines((items) => move(items, "lines")); setCheckBoxes((items) => move(items, "check")); setDimensionBands((items) => move(items, "band")); setImages((items) => move(items, "image"));
        return;
      }
    }
    if (state.kind === "text-resize") { setTextBoxes((items) => items.map((item) => item.id === state.id ? { ...item, width: clamp(x, 80, W - item.x), height: clamp(y, 32, H - item.y) } : item)); return; }
    if (state.kind === "lines-resize") { setAnswerLines((items) => items.map((item) => item.id === state.id ? { ...item, width: clamp(x, 80, W - item.x) } : item)); return; }
    if (state.kind === "score-resize") { setScoreBoxes((items) => items.map((item) => item.id === state.id ? { ...item, width: clamp(x, 54, W - item.x), height: clamp(y, 28, 100) } : item)); return; }
    if (state.kind === "image-resize") { setImages((items) => items.map((item) => item.id === state.id ? { ...item, width: clamp(x, 40, W - item.x), height: clamp(y, 40, H - item.y) } : item)); return; }
    if (state.kind === "table-resize") {
      setTables((items) => items.map((item) => {
        if (item.id !== state.id || isFixedWorksheetTable(item)) return item;
        const width = clamp(x, 160, W - item.x);
        const totalHeight = clamp(y, item.rows * 30, H - item.y);
        return { ...item, width, columnWidths: normalizedColumnWidths(item).map((value) => value / (item.width ?? 360) * width), rowHeights: Array(item.rows).fill(totalHeight / item.rows) };
      }));
      return;
    }
    if ((state.kind === "text" || state.kind === "badge" || state.kind === "lines" || state.kind === "table") && !event.altKey) {
      const xCandidates = [activePage?.margins.left ?? 0];
      const yCandidates = [activePage?.margins.top ?? 0];
      if (state.kind === "text" || state.kind === "lines") {
        textBoxes.filter((item) => item.pageId === activePageId && item.id !== state.id).forEach((item) => { xCandidates.push(item.x); yCandidates.push(item.y); });
        answerLines.filter((item) => item.pageId === activePageId && item.id !== state.id).forEach((item) => { xCandidates.push(item.x); yCandidates.push(item.y + item.lineSpacing); });
        badges.filter((item) => item.pageId === activePageId).forEach((item) => xCandidates.push(item.x + 16));
      } else {
        badges.filter((item) => item.pageId === activePageId && item.id !== state.id).forEach((item) => { xCandidates.push(item.x, item.x + 16); yCandidates.push(item.y, item.y + 16); });
      }
      if (state.kind === "table") xCandidates.push(W / 2);
      const tableWidth = state.kind === "table" ? worksheetTableWidth(tables.find((item) => item.id === state.id) ?? { kind: "free", width: 360 } as TreeAnalysisTable) : 0;
      const movingX = state.kind === "badge"
        ? [{ value: x, offset: 0 }, { value: x + 16, offset: 16 }]
        : state.kind === "text"
          ? [{ value: x + 3, offset: 3 }]
          : state.kind === "table"
            ? [{ value: x + tableWidth / 2, offset: tableWidth / 2 }]
            : [{ value: x, offset: 0 }];
      const movingY = state.kind === "badge" ? [{ value: y, offset: 0 }, { value: y + 16, offset: 16 }] : state.kind === "lines" ? [{ value: y + (answerLines.find((item)=>item.id===state.id)?.lineSpacing??0), offset: answerLines.find((item)=>item.id===state.id)?.lineSpacing??0 }] : [{ value: y, offset: 0 }];
      const xMatch = movingX.flatMap((point) => xCandidates.map((candidate) => ({ candidate, offset: point.offset, distance: Math.abs(point.value - candidate) }))).sort((a,b) => a.distance-b.distance)[0];
      const yMatch = movingY.flatMap((point) => yCandidates.map((candidate) => ({ candidate, offset: point.offset, distance: Math.abs(point.value - candidate) }))).sort((a,b) => a.distance-b.distance)[0];
      const nextGuides: { x?: number; y?: number } = {};
      if (xMatch && xMatch.distance <= ALIGNMENT_TOLERANCE) { x = xMatch.candidate - xMatch.offset; nextGuides.x = xMatch.candidate; }
      if (yMatch && yMatch.distance <= ALIGNMENT_TOLERANCE) { y = yMatch.candidate - yMatch.offset; nextGuides.y = yMatch.candidate; }
      setAlignmentGuides(nextGuides);
    } else setAlignmentGuides({});
    x = clamp(x, 0, W - 32);
    y = clamp(y, 0, H - 24);
    if (state.kind === "text") setTextBoxes((items) => items.map((item) => item.id === state.id ? { ...item, x, y } : item));
    if (state.kind === "score") setScoreBoxes((items) => items.map((item) => item.id === state.id ? { ...item, x, y } : item));
    if (state.kind === "table") setTables((items) => items.map((item) => item.id === state.id ? { ...item, x, y } : item));
    if (state.kind === "badge") setBadges((items) => items.map((item) => item.id === state.id ? { ...item, x, y } : item));
    if (state.kind === "lines") setAnswerLines((items) => items.map((item) => item.id === state.id ? { ...item, x, y } : item));
    if (state.kind === "check") setCheckBoxes((items) => items.map((item) => item.id === state.id ? { ...item, x, y } : item));
    if (state.kind === "band") setDimensionBands((items) => items.map((item) => item.id === state.id ? { ...item, x, y } : item));
    if (state.kind === "image") setImages((items) => items.map((item) => item.id === state.id ? { ...item, x, y } : item));
  }
  function endDrag() {
    if (marqueeRef.current) {
      const box = marqueeRef.current;
      const left = Math.min(box.startX, box.x); const right = Math.max(box.startX, box.x); const top = Math.min(box.startY, box.y); const bottom = Math.max(box.startY, box.y);
      const matches = movableItems().filter((item) => item.x < right && item.x + item.width > left && item.y < bottom && item.y + item.height > top).map(({ kind, id }) => ({ kind, id }));
      suppressCanvasClickRef.current = true;
      window.setTimeout(() => { suppressCanvasClickRef.current = false; }, 0);
      setSelectedItems(matches);
      setSelected(matches[0] ?? null);
      marqueeRef.current = null;
      setMarquee(null);
    }
    drag.current = null; groupOrigins.current = {}; setAlignmentGuides({});
  }
  function updateSelectedTable(patch: Partial<TreeAnalysisTable>) {
    if (!selected || selected.kind !== "table") return;
    setTables((items) => items.map((item) => item.id === selected.id ? { ...item, ...patch } : item));
  }

  function updateSelectedCells(patch: Partial<TreeAnalysisTable["cells"][number]>) {
    if (!selected || selected.kind !== "table" || !selectedCells.length) return;
    setTables((items) => items.map((table) => table.id === selected.id ? { ...table, cells: table.cells.map((cell, index) => selectedCells.includes(index) ? { ...cell, ...patch } : cell) } : table));
  }

  function selectTableCell(tableId: string, index: number, extend: boolean) {
    setSelectedCells((current) => {
      if (!extend || selected?.kind !== "table" || selected.id !== tableId || !current.length) return [index];
      const table = tables.find((item) => item.id === tableId);
      if (!table) return [index];
      const anchor = current[0];
      const startRow = Math.min(Math.floor(anchor / table.columns), Math.floor(index / table.columns));
      const endRow = Math.max(Math.floor(anchor / table.columns), Math.floor(index / table.columns));
      const startColumn = Math.min(anchor % table.columns, index % table.columns);
      const endColumn = Math.max(anchor % table.columns, index % table.columns);
      const range: number[] = [];
      for (let row = startRow; row <= endRow; row += 1) for (let column = startColumn; column <= endColumn; column += 1) range.push(row * table.columns + column);
      return range;
    });
  }

  function mergeSelectedCells() {
    if (!selectedTable || selectedCells.length < 2) return;
    const rows = selectedCells.map((index) => Math.floor(index / selectedTable.columns));
    const columns = selectedCells.map((index) => index % selectedTable.columns);
    const minRow = Math.min(...rows); const maxRow = Math.max(...rows);
    const minColumn = Math.min(...columns); const maxColumn = Math.max(...columns);
    const expected = (maxRow - minRow + 1) * (maxColumn - minColumn + 1);
    if (expected !== selectedCells.length) return;
    const anchor = minRow * selectedTable.columns + minColumn;
    setTables((items) => items.map((table) => table.id !== selectedTable.id ? table : { ...table, cells: table.cells.map((cell, index) => {
      if (!selectedCells.includes(index)) return cell;
      return index === anchor ? { ...cell, columnSpan: maxColumn - minColumn + 1, rowSpan: maxRow - minRow + 1 } : { ...cell, columnSpan: 0, rowSpan: 0 };
    }) }));
    setSelectedCells([anchor]);
  }

  function splitSelectedCell() {
    if (!selectedTable || selectedCells.length !== 1) return;
    const anchor = selectedCells[0];
    const cell = selectedTable.cells[anchor];
    const rowSpan = Math.max(1, cell.rowSpan ?? 1);
    const columnSpan = Math.max(1, cell.columnSpan ?? 1);
    const anchorRow = Math.floor(anchor / selectedTable.columns);
    const anchorColumn = anchor % selectedTable.columns;
    setTables((items) => items.map((table) => table.id !== selectedTable.id ? table : { ...table, cells: table.cells.map((candidate, index) => {
      const row = Math.floor(index / table.columns); const column = index % table.columns;
      if (row < anchorRow || row >= anchorRow + rowSpan || column < anchorColumn || column >= anchorColumn + columnSpan) return candidate;
      return { ...candidate, columnSpan: 1, rowSpan: 1 };
    }) }));
  }

  function resizeSelectedTableGrid(rows: number, columns: number) {
    if (!selectedTable) return;
    rows = clamp(rows, 1, 12); columns = clamp(columns, 1, 8);
    const nextCells = Array.from({ length: rows * columns }, (_, index) => {
      const row = Math.floor(index / columns); const column = index % columns;
      const previous = row < selectedTable.rows && column < selectedTable.columns ? selectedTable.cells[row * selectedTable.columns + column] : undefined;
      return previous ? { ...previous, columnSpan: 1, rowSpan: 1 } : { text: "", isCorrect: false, role: "text" as const, background: "white" as const, textColor: "black" as const, textAlign: "center" as const, verticalAlign: "center" as const, fontSize: 17 };
    });
    const width = selectedTable.width ?? 360;
    updateSelectedTable({ rows, columns, cells: nextCells, columnWidths: Array(columns).fill(width / columns), rowHeights: Array(rows).fill(54) });
    setSelectedCells([]);
  }

  function moveStep(id: string, direction: -1 | 1) {
    const order = [...pageSteps]; const index = order.indexOf(id); const next = index + direction;
    if (index < 0 || next < 0 || next >= order.length) return;
    [order[index], order[next]] = [order[next], order[index]];
    setReaderOrder((current) => [...current.filter((item) => !pageSteps.includes(item)), ...order]);
  }

  function save() {
    if (!title.trim() || !levelId) return;
    const now = new Date().toISOString();
    onSave({
      id: initialSentence?.id ?? crypto.randomUUID(), activityType: "worksheet", levelId, title: title.trim(), originalText: textBoxes[0]?.text ?? "", difficulty,
      tags, corrections: [], assignedGroupIds: initialSentence?.assignedGroupIds ?? [], competitionEnabled: initialSentence?.competitionEnabled ?? false,
      assignmentStatusByGroup: initialSentence?.assignmentStatusByGroup ?? {}, assignmentProgressByGroup: initialSentence?.assignmentProgressByGroup ?? {},
      treeAnalysisDocumentPages: pages, treeAnalysisTextBoxes: textBoxes, treeAnalysisScoreBoxes: scoreBoxes, treeAnalysisTables: tables, treeAnalysisQuestionBadges: badges,
      worksheetAnswerLines: answerLines, worksheetCheckBoxes: checkBoxes, worksheetDimensionBands: dimensionBands, worksheetImages: images, worksheetReaderOrder: (() => { const all = answerLines.filter((item) => item.interactive !== false || Boolean(item.answer.trim())).map((item) => `lines:${item.id}`); return [...readerOrder.filter((id) => all.includes(id)), ...all.filter((id) => !readerOrder.includes(id))]; })(),
      createdAt: initialSentence?.createdAt ?? now, updatedAt: now
    });
  }

  function addTag() {
    const value = tagInput.trim();
    if (!value) return;
    setTags((current) => current.some((tag) => tag.toLocaleLowerCase("fr-CA") === value.toLocaleLowerCase("fr-CA")) ? current : [...current, value]);
    setTagInput("");
  }

  async function printDocument() {
    if (!canvasRef.current) return;
    const previousPageId = activePageId;
    const waitForRender = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const cleanPrintClone = (clone: HTMLElement) => {
      clone.classList.add("worksheet-print-clone");
      clone.querySelectorAll(".selected,.cell-selected").forEach((element) => element.classList.remove("selected", "cell-selected"));
      clone.querySelectorAll("[contenteditable]").forEach((element) => {
        element.removeAttribute("contenteditable");
        element.removeAttribute("spellcheck");
      });
      clone.querySelectorAll([
        "button",
        ".tree-analysis-text-delete",
        ".tree-analysis-text-resize",
        ".tree-analysis-text-move-handle",
        ".tree-analysis-alignment-guide",
        ".tree-analysis-delete-table",
        ".worksheet-selection-marquee",
        ".worksheet-group-selection-outline",
        ".worksheet-text-move-edge",
        ".worksheet-table-move-edge",
        ".worksheet-table-resize",
        ".worksheet-lines-delete",
        ".worksheet-lines-resize",
        ".worksheet-checkbox-delete",
        ".worksheet-image-delete",
        ".worksheet-image-resize",
        ".worksheet-band-delete",
        ".worksheet-score-delete",
        ".worksheet-score-resize"
      ].join(",")).forEach((element) => element.remove());
    };
    document.querySelector(".worksheet-print-root")?.remove();
    document.querySelector("#worksheet-print-page-style")?.remove();
    const printStyle = document.createElement("style");
    printStyle.id = "worksheet-print-page-style";
    printStyle.textContent = "@page { size: letter portrait; margin: 0; }";
    document.head.appendChild(printStyle);
    const printRoot = document.createElement("div");
    printRoot.className = "worksheet-print-root";
    document.body.appendChild(printRoot);
    for (const page of pages) {
      setActivePageId(page.id);
      await waitForRender();
      const canvas = canvasRef.current;
      if (!canvas) continue;
      const clone = canvas.cloneNode(true) as HTMLElement;
      cleanPrintClone(clone);
      printRoot.appendChild(clone);
    }
    setActivePageId(previousPageId);
    await waitForRender();
    const cleanup = () => {
      printRoot.remove();
      printStyle.remove();
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.setTimeout(() => {
      window.print();
      window.setTimeout(cleanup, 1000);
    }, 100);
  }

  const selectedText = selected?.kind === "text" ? textBoxes.find((item) => item.id === selected.id) : undefined;
  const selectedLines = selected?.kind === "lines" ? answerLines.find((item) => item.id === selected.id) : undefined;
  const selectedTable = selected?.kind === "table" ? tables.find((item) => item.id === selected.id) : undefined;
  const selectedScore = selected?.kind === "score" ? scoreBoxes.find((item) => item.id === selected.id) : undefined;
  const selectedCheck = selected?.kind === "check" ? checkBoxes.find((item) => item.id === selected.id) : undefined;
  const selectedBand = selected?.kind === "band" ? dimensionBands.find((item) => item.id === selected.id) : undefined;
  const selectedImage = selected?.kind === "image" ? images.find((item) => item.id === selected.id) : undefined;
  const selectedInlineStyle = selectedTextStyle(selectedText);

  return <div className="worksheet-editor tree-analysis-editor">
    <Card className="tree-analysis-builder-card">
      <div className="worksheet-topbar"><div className="worksheet-title-zone"><div className="worksheet-page-tabs">{pages.map((page,index) => <button key={page.id} type="button" className={page.id === activePageId ? "active" : ""} onClick={() => setActivePageId(page.id)}>Page {index + 1}</button>)}<button type="button" onClick={addPage}><Plus size={15}/> Page</button></div></div><div className="tree-analysis-builder-tools"><Button type="button" variant="secondary" onClick={() => setPrintMode("student")} aria-pressed={printMode === "student"}>Aperçu élève</Button><Button type="button" variant="secondary" onClick={() => setPrintMode("answer")} aria-pressed={printMode === "answer"}><Check size={17}/> Corrigé</Button><Button type="button" variant="secondary" onClick={printDocument}><Printer size={17}/> Imprimer</Button><Button type="button" onClick={save}><Save size={17}/> Enregistrer</Button></div></div>
      <div className="tree-analysis-quick-add"><Button type="button" onClick={addText}><span className="tree-analysis-add-icon">T</span> Texte</Button><Button type="button" variant="secondary" onClick={addScore}><span className="tree-analysis-add-icon">/x</span> Points</Button><Button type="button" variant="secondary" onClick={openTableDialog}><Grid3X3 size={17}/> Tableau</Button><Button type="button" variant="secondary" onClick={openRubricDialog}><Grid3X3 size={17}/> Grille de notation</Button><Button type="button" variant="secondary" onClick={addBadge}><span className="tree-analysis-add-icon">1</span> Numéro</Button><Button type="button" variant="secondary" onClick={addLines}><span className="tree-analysis-add-icon">━</span> Lignes de réponse</Button><Button type="button" variant="secondary" onClick={()=>setBandDialog("Compréhension")}><span className="tree-analysis-add-icon worksheet-band-icon">C</span> Bandeau de lecture</Button><Button type="button" variant="secondary" onClick={()=>imageInputRef.current?.click()}><ImagePlus size={17}/> Image</Button><input ref={imageInputRef} className="worksheet-image-input" type="file" accept="image/*" onChange={(event)=>{importImage(event.target.files?.[0]);event.target.value="";}}/></div>
      <button type="button" className="worksheet-settings-toggle" onClick={() => setSettingsOpen((value) => !value)} aria-expanded={settingsOpen}><span>Paramètres de la feuille</span><small>{levelId ? levels.find((level)=>level.id===levelId)?.name : "Niveau"} · {difficultyLabels[difficulty]} · {tags.length} tag{tags.length>1?"s":""}</small>{settingsOpen?<ChevronUp size={18}/>:<ChevronDown size={18}/>}</button>
      {settingsOpen&&<div className="worksheet-settings-panel"><div className="tree-analysis-builder-meta worksheet-meta-grid"><label>Titre<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Niveau<select value={levelId} onChange={(event) => setLevelId(event.target.value)}>{levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></label><label>Difficulté<select value={difficulty} onChange={(event) => setDifficulty(event.target.value as SentenceDifficulty)}>{Object.entries(difficultyLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><div className="worksheet-tag-editor"><label>Tags<input value={tagInput} onChange={(event)=>setTagInput(event.target.value)} onKeyDown={(event)=>{if(event.key==="Enter"){event.preventDefault();addTag();}}} placeholder="Ex. Test sur les inférences"/></label><Button type="button" variant="secondary" onClick={addTag}>Ajouter</Button></div></div><div className="worksheet-tag-list">{tags.map((tag)=><button type="button" key={tag} onClick={()=>setTags((current)=>current.filter((item)=>item!==tag))}>{tag}<X size={13}/></button>)}</div></div>}
      <button type="button" className="worksheet-header-controls-toggle" onClick={() => setHeaderControlsOpen((value) => !value)} aria-expanded={headerControlsOpen}><span>Présentation de la page</span>{headerControlsOpen?<ChevronUp size={18}/>:<ChevronDown size={18}/>}</button>
      {headerControlsOpen&&<div className="tree-analysis-document-header-controls worksheet-page-presentation-controls">
        <section><h4>Entête</h4><label>Type d’activité<input value={activePage.header?.activityType ?? "EXERCICES"} onChange={(event) => updatePage({ header: { ...activePage.header!, activityType: event.target.value } })}/></label><label>Titre dans l’entête<input value={activePage.header?.activityTitle ?? title} onChange={(event) => updatePage({ header: { ...activePage.header!, activityTitle: event.target.value } })}/></label></section>
        <section><h4>Grand bandeau</h4><label className="tree-analysis-main-title-toggle"><input type="checkbox" checked={activePage.mainTitle?.enabled ?? true} onChange={(event) => updatePage({ mainTitle: { ...(activePage.mainTitle ?? { prefix:"Exercices", title:"Feuille d’activité", subtitle:"Activité" }), enabled:event.target.checked } })}/> Afficher le grand bandeau</label>{activePage.mainTitle?.enabled && <><label>Première partie<input value={activePage.mainTitle.prefix} onChange={(event) => updatePage({ mainTitle:{...activePage.mainTitle!,prefix:event.target.value} })}/></label><label>Deuxième partie<input value={activePage.mainTitle.title} onChange={(event) => updatePage({ mainTitle:{...activePage.mainTitle!,title:event.target.value} })}/></label><label>Barre noire<input value={activePage.mainTitle.subtitle ?? ""} onChange={(event) => updatePage({ mainTitle:{...activePage.mainTitle!,subtitle:event.target.value} })}/></label></>}</section>
        <section><h4>Total</h4><label className="tree-analysis-main-title-toggle"><input type="checkbox" checked={activePage.mainTitle?.scoreTotal !== undefined} onChange={(event)=>updatePage({mainTitle:{...(activePage.mainTitle ?? { enabled:true, prefix:"Exercices", title:"Feuille d’activité", subtitle:"Activité" }),scoreTotal:event.target.checked ? (activePage.mainTitle?.scoreTotal ?? 30) : undefined}})}/> Afficher le total dans le bandeau</label>{activePage.mainTitle?.scoreTotal !== undefined && <label>Total sur<input type="number" min="0" value={activePage.mainTitle.scoreTotal} onChange={(event)=>updatePage({mainTitle:{...activePage.mainTitle!,scoreTotal:Math.max(0,Number(event.target.value)||0)}})}/></label>}</section>
        <section><h4>Ta tâche</h4><label className="tree-analysis-main-title-toggle"><input type="checkbox" checked={activePage.taskCallout?.enabled ?? false} onChange={(event)=>updatePage({taskCallout:{...(activePage.taskCallout ?? {text:"Lis le texte narratif suivant, puis réponds aux questions des 4 dimensions de la lecture."}),enabled:event.target.checked}})}/> Afficher le bloc Ta tâche</label>{activePage.taskCallout?.enabled && <label>Consigne<textarea value={activePage.taskCallout.text} onChange={(event)=>updatePage({taskCallout:{...activePage.taskCallout!,text:event.target.value}})}/></label>}</section>
      </div>}
      {selectedText && <div className="tree-analysis-text-toolbar" onMouseDown={(event)=>{if((event.target as HTMLElement).closest("button"))event.preventDefault();}}>
        <label>Taille<input type="number" min="10" max="72" step="0.5" value={Math.round(selectedText.fontSize*selectedInlineStyle.fontScale*10)/10} onChange={(event) => {const next=Number(event.target.value);if(next>0)applyTextFormat(selectedText,{fontScale:next/selectedText.fontSize});}}/></label>
        <button type="button" className={selectedInlineStyle.bold?"active":undefined} aria-pressed={selectedInlineStyle.bold} onClick={() => applyTextFormat(selectedText,{bold:!selectedInlineStyle.bold})}><Bold size={17}/> Gras</button>
        <button type="button" onClick={() => setTextBoxes((items) => items.map((item) => item.id === selectedText.id ? {...item,textAlign:"left"} : item))}><AlignLeft size={17}/></button>
        <button type="button" onClick={() => setTextBoxes((items) => items.map((item) => item.id === selectedText.id ? {...item,textAlign:"center"} : item))}><AlignCenter size={17}/></button>
        <button type="button" onClick={() => setTextBoxes((items) => items.map((item) => item.id === selectedText.id ? {...item,textAlign:"justify"} : item))}><AlignJustify size={17}/></button>
        <label className="worksheet-checkbox"><input type="checkbox" checked={selectedText.showLineNumbers??false} onChange={(event)=>setTextBoxes((items)=>items.map((item)=>item.id===selectedText.id?{...item,showLineNumbers:event.target.checked}:item))}/> Numéroter chaque 5 lignes</label>
        <label>Largeur<input type="number" value={selectedText.width} onChange={(event) => setTextBoxes((items) => items.map((item) => item.id === selectedText.id ? {...item,width:Number(event.target.value)} : item))}/></label>
        <label>Hauteur<input type="number" value={selectedText.height} onChange={(event) => setTextBoxes((items) => items.map((item) => item.id === selectedText.id ? {...item,height:Number(event.target.value)} : item))}/></label>
      </div>}
      {selectedLines && <div className="worksheet-lines-toolbar"><label>Nombre de lignes<input type="number" min="1" max="30" value={selectedLines.lineCount} onChange={(event) => setAnswerLines((items) => items.map((item) => item.id === selectedLines.id ? {...item,lineCount:Number(event.target.value)} : item))}/></label><label>Interligne<input type="number" min="18" max="56" value={selectedLines.lineSpacing} onChange={(event) => setAnswerLines((items) => items.map((item) => item.id === selectedLines.id ? {...item,lineSpacing:Number(event.target.value)} : item))}/></label><label>Largeur<input type="number" min="80" max="900" value={selectedLines.width} onChange={(event) => setAnswerLines((items) => items.map((item) => item.id === selectedLines.id ? {...item,width:clamp(Number(event.target.value),80,900)} : item))}/></label><label>Taille de la réponse<input type="number" min="10" max="32" value={selectedLines.answerFontSize} onChange={(event) => setAnswerLines((items) => items.map((item) => item.id === selectedLines.id ? {...item,answerFontSize:Number(event.target.value)} : item))}/></label><button type="button" aria-pressed={selectedLines.answerBold ?? false} onClick={() => setAnswerLines((items) => items.map((item) => item.id === selectedLines.id ? {...item,answerBold:!item.answerBold} : item))}><Bold size={16}/> Gras</button><button type="button" aria-pressed={(selectedLines.answerTextAlign ?? "left") === "left"} onClick={() => setAnswerLines((items) => items.map((item) => item.id === selectedLines.id ? {...item,answerTextAlign:"left"} : item))}><AlignLeft size={16}/></button><button type="button" aria-pressed={selectedLines.answerTextAlign === "center"} onClick={() => setAnswerLines((items) => items.map((item) => item.id === selectedLines.id ? {...item,answerTextAlign:"center"} : item))}><AlignCenter size={16}/></button><button type="button" aria-pressed={selectedLines.answerTextAlign === "justify"} onClick={() => setAnswerLines((items) => items.map((item) => item.id === selectedLines.id ? {...item,answerTextAlign:"justify"} : item))}><AlignJustify size={16}/></button><p className="worksheet-lines-hint">En mode corrigé, écris directement sur les lignes. Le nombre de lignes augmente si la réponse déborde.</p></div>}
      {selectedCheck && <div className="tree-analysis-text-toolbar worksheet-checkbox-toolbar">
        <label className="worksheet-checkbox"><input type="checkbox" checked={selectedCheck.checked ?? false} onChange={(event)=>setCheckBoxes((items)=>items.map((item)=>item.id===selectedCheck.id?{...item,checked:event.target.checked}:item))}/> Cochée dans le corrigé</label>
        <label>Taille<input type="number" min="12" max="60" value={selectedCheck.size} onChange={(event)=>setCheckBoxes((items)=>items.map((item)=>item.id===selectedCheck.id?{...item,size:clamp(Number(event.target.value),12,60)}:item))}/></label>
      </div>}
      {selectedScore && <div className="tree-analysis-text-toolbar worksheet-score-toolbar"><label>Total<input type="number" min="1" value={selectedScore.total} onChange={(event) => setScoreBoxes((items) => items.map((item) => item.id === selectedScore.id ? {...item,total:Math.max(1,Number(event.target.value)||1)} : item))}/></label><label>Largeur<input type="number" min="54" max="400" value={selectedScore.width ?? 120} onChange={(event) => setScoreBoxes((items) => items.map((item) => item.id === selectedScore.id ? {...item,width:Number(event.target.value)} : item))}/></label><label>Hauteur<input type="number" min="28" max="100" value={selectedScore.height ?? 42} onChange={(event) => setScoreBoxes((items) => items.map((item) => item.id === selectedScore.id ? {...item,height:Number(event.target.value)} : item))}/></label></div>}
      {selectedBand && <div className="tree-analysis-text-toolbar worksheet-band-toolbar"><label>Dimension<select value={selectedBand.dimension} onChange={(event) => {const dimension=event.target.value as WorksheetDimensionBand["dimension"];const size=worksheetDimensionAsset(dimension);setDimensionBands((items) => items.map((item) => item.id === selectedBand.id ? {...item,dimension,width:size.width,height:size.height} : item));}}>{["Compréhension","Interprétation","Réaction","Appréciation"].map((item)=><option key={item}>{item}</option>)}</select></label><span>Format identique au document de référence.</span></div>}
      {selectedImage && <div className="tree-analysis-text-toolbar worksheet-image-toolbar"><label>Largeur<input type="number" min="40" max="900" value={Math.round(selectedImage.width)} onChange={(event)=>setImages((items)=>items.map((item)=>item.id===selectedImage.id?{...item,width:Number(event.target.value)}:item))}/></label><label>Hauteur<input type="number" min="40" max="700" value={Math.round(selectedImage.height)} onChange={(event)=>setImages((items)=>items.map((item)=>item.id===selectedImage.id?{...item,height:Number(event.target.value)}:item))}/></label><label>Disposition<select value={selectedImage.layoutMode??(selectedImage.wrapText?"wrap":"front")} onChange={(event)=>{const layoutMode=event.target.value as NonNullable<WorksheetImage["layoutMode"]>;setImages((items)=>items.map((item)=>item.id===selectedImage.id?{...item,layoutMode,wrapText:layoutMode==="wrap"}:item));}}><option value="wrap">Adapter le texte autour</option><option value="front">Devant le texte</option><option value="behind">Derrière le texte</option></select></label></div>}
      {selectedTable && <div className="worksheet-table-toolbar">
        <div className="worksheet-table-toolbar-row">
          {!isFixedWorksheetTable(selectedTable)&&<><Button type="button" variant="secondary" onClick={()=>resizeSelectedTableGrid(selectedTable.rows+1,selectedTable.columns)}>+ Rangée</Button><Button type="button" variant="secondary" disabled={selectedTable.rows<=1} onClick={()=>resizeSelectedTableGrid(selectedTable.rows-1,selectedTable.columns)}>− Rangée</Button><Button type="button" variant="secondary" onClick={()=>resizeSelectedTableGrid(selectedTable.rows,selectedTable.columns+1)}>+ Colonne</Button><Button type="button" variant="secondary" disabled={selectedTable.columns<=1} onClick={()=>resizeSelectedTableGrid(selectedTable.rows,selectedTable.columns-1)}>− Colonne</Button><Button type="button" variant="secondary" onClick={()=>updateSelectedTable({columnWidths:Array(selectedTable.columns).fill((selectedTable.width??360)/selectedTable.columns)})}>Égaliser colonnes</Button><Button type="button" variant="secondary" onClick={()=>updateSelectedTable({rowHeights:Array(selectedTable.rows).fill(normalizedRowHeights(selectedTable).reduce((sum,value)=>sum+value,0)/selectedTable.rows)})}>Égaliser rangées</Button><Button type="button" variant="secondary" disabled={selectedCells.length<2} onClick={mergeSelectedCells}><Merge size={16}/> Fusionner</Button><Button type="button" variant="secondary" disabled={selectedCells.length!==1} onClick={splitSelectedCell}><Split size={16}/> Séparer</Button></>}
          <Button type="button" variant="secondary" onClick={addLineInTable}>+ Ligne réponse</Button>
          <Button type="button" variant="secondary" onClick={addCheckInTable}>+ Case</Button>
        </div>
        {selectedCells.length>0&&<div className="worksheet-cell-toolbar"><label>Fond<select value={selectedTable.cells[selectedCells[0]]?.background??"white"} onChange={(event)=>updateSelectedCells({background:event.target.value as "white"|"gray"|"black",textColor:event.target.value==="black"?"white":"black"})}><option value="white">Blanc</option><option value="gray">Gris</option><option value="black">Noir</option></select></label><label>Alignement<select value={selectedTable.cells[selectedCells[0]]?.textAlign??"center"} onChange={(event)=>updateSelectedCells({textAlign:event.target.value as "left"|"center"|"right"})}><option value="left">Gauche</option><option value="center">Centre</option><option value="right">Droite</option></select></label><label>Vertical<select value={selectedTable.cells[selectedCells[0]]?.verticalAlign??"center"} onChange={(event)=>updateSelectedCells({verticalAlign:event.target.value as "top"|"center"|"bottom"})}><option value="top">Haut</option><option value="center">Centre</option><option value="bottom">Bas</option></select></label><label>Bordure<select value={selectedTable.cells[selectedCells[0]]?.borderWidth??1} onChange={(event)=>updateSelectedCells({borderWidth:Number(event.target.value) as 0|1|2|3})}><option value="0">Aucune</option><option value="1">Normale</option><option value="2">Épaisse</option><option value="3">Très épaisse</option></select></label><label>Taille<input type="number" min="9" max="32" value={selectedTable.cells[selectedCells[0]]?.fontSize??17} onChange={(event)=>updateSelectedCells({fontSize:Number(event.target.value)})}/></label><label className="worksheet-checkbox"><input type="checkbox" checked={selectedTable.cells[selectedCells[0]]?.bold??false} onChange={(event)=>updateSelectedCells({bold:event.target.checked})}/> Gras</label></div>}
      </div>}
      {tableDialog&&<div className="worksheet-dialog-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)setTableDialog(null);}}><div className="worksheet-dialog" role="dialog" aria-modal="true" aria-labelledby="worksheet-table-title"><div className="worksheet-dialog-heading"><div><span className="eyebrow">Ajouter à la page</span><h3 id="worksheet-table-title">{["compact_rubric","rubric"].includes(tableDialog.kind)?"Créer une grille de notation":"Créer un tableau pédagogique"}</h3></div><button type="button" onClick={()=>setTableDialog(null)} aria-label="Fermer"><X size={20}/></button></div><label>Modèle<select value={tableDialog.kind} onChange={(event)=>setTableDialog((current)=>current?{...current,kind:event.target.value as WorksheetTableTemplate}:current)}>{((["compact_rubric","rubric"].includes(tableDialog.kind)?["compact_rubric","rubric"]:["free","structured","choice","sequence","association"]) as WorksheetTableTemplate[]).map((kind)=><option key={kind} value={kind}>{tableTemplateLabel(kind)}</option>)}</select></label>{!["choice","compact_rubric","rubric"].includes(tableDialog.kind)&&<label>Nombre de rangées<input type="number" min="1" max="12" value={tableDialog.rows} onChange={(event)=>setTableDialog((current)=>current?{...current,rows:Number(event.target.value)}:current)}/></label>}{!["structured","sequence","association","compact_rubric"].includes(tableDialog.kind)&&<label>{tableDialog.kind==="rubric"?"Nombre de niveaux":"Nombre de colonnes"}<input type="number" min="1" max="8" value={tableDialog.columns} onChange={(event)=>setTableDialog((current)=>current?{...current,columns:Number(event.target.value)}:current)}/></label>}{["compact_rubric","rubric"].includes(tableDialog.kind)&&<><label>Dimension<select value={tableDialog.dimension} onChange={(event)=>setTableDialog((current)=>current?{...current,dimension:event.target.value as WorksheetDimensionBand["dimension"]}:current)}>{["Compréhension","Interprétation","Réaction","Appréciation"].map((item)=><option key={item}>{item}</option>)}</select></label><label>Maximum de points<input type="number" min="1" max="20" value={tableDialog.maxPoints} onChange={(event)=>setTableDialog((current)=>current?{...current,maxPoints:Number(event.target.value)}:current)}/></label></>}<p>{["compact_rubric","rubric"].includes(tableDialog.kind)?"La grille reprend les dimensions fixes du document de référence; seul son contenu est modifiable.":"Le modèle sera entièrement modifiable après son insertion."}</p><div className="worksheet-dialog-actions"><Button type="button" variant="secondary" onClick={()=>setTableDialog(null)}>Annuler</Button><Button type="button" onClick={addTable}><Grid3X3 size={17}/> Ajouter le tableau</Button></div></div></div>}
      {bandDialog&&<div className="worksheet-dialog-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)setBandDialog(null);}}><div className="worksheet-dialog worksheet-band-dialog" role="dialog" aria-modal="true" aria-labelledby="worksheet-band-title"><div className="worksheet-dialog-heading"><div><span className="eyebrow">Bandeau de lecture</span><h3 id="worksheet-band-title">Choisir la dimension</h3></div><button type="button" onClick={()=>setBandDialog(null)} aria-label="Fermer"><X size={20}/></button></div><div className="worksheet-band-choices">{(["Compréhension","Interprétation","Réaction","Appréciation"] as WorksheetDimensionBand["dimension"][]).map((dimension)=><button key={dimension} type="button" className={bandDialog===dimension?"active":""} onClick={()=>setBandDialog(dimension)}><Image src={worksheetDimensionAsset(dimension).src} alt={dimension} width={worksheetDimensionAsset(dimension).width} height={worksheetDimensionAsset(dimension).height} unoptimized/></button>)}</div><div className="worksheet-dialog-actions"><Button type="button" variant="secondary" onClick={()=>setBandDialog(null)}>Annuler</Button><Button type="button" onClick={addDimensionBand}>Ajouter le bandeau</Button></div></div></div>}
      <div className={`tree-analysis-workspace tree-print-${printMode}`}><div className="tree-analysis-page-shell builder"><div ref={canvasRef} className="tree-analysis-page tree-analysis-canvas portrait document-template worksheet-canvas" style={{"--page-margin-top":`${activePage.margins.top/H*100}%`,"--page-margin-right":`${activePage.margins.right/W*100}%`,"--page-margin-bottom":`${activePage.margins.bottom/H*100}%`,"--page-margin-left":`${activePage.margins.left/W*100}%`} as React.CSSProperties} onPointerDown={beginMarquee} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onClick={(event) => { if(suppressCanvasClickRef.current)return; if(event.target === event.currentTarget&&!marquee) {setSelected(null);setSelectedItems([]);} }}>
        {alignmentGuides.x !== undefined && <div className="tree-analysis-alignment-guide vertical" style={{left:`${alignmentGuides.x/W*100}%`}}/>}
        {alignmentGuides.y !== undefined && <div className="tree-analysis-alignment-guide horizontal" style={{top:`${alignmentGuides.y/H*100}%`}}/>}
        {marquee&&<div className="worksheet-selection-marquee" style={{left:`${Math.min(marquee.startX,marquee.x)/W*100}%`,top:`${Math.min(marquee.startY,marquee.y)/H*100}%`,width:`${Math.abs(marquee.x-marquee.startX)/W*100}%`,height:`${Math.abs(marquee.y-marquee.startY)/H*100}%`}}/>}
        {selectedItems.length>1&&movableItems().filter((item)=>selectedItems.some((chosen)=>chosen.kind===item.kind&&chosen.id===item.id)).map((item)=><div key={`${item.kind}:${item.id}`} className="worksheet-group-selection-outline" style={{left:`${item.x/W*100}%`,top:`${item.y/H*100}%`,width:`${item.width/W*100}%`,height:`${item.height/H*100}%`}}/>)}
        <div className="tree-analysis-document-header" style={{left:`${activePage.margins.left/W*100}%`,right:`${activePage.margins.right/W*100}%`,top:`${(activePage.header?.nameY ?? 25)/H*100}%`}}><div className="tree-analysis-document-header-top"><div className="tree-analysis-student-fields"><span>NOM</span><span>GROUPE</span></div><div className="tree-analysis-page-cell"><div className="tree-analysis-page-badge">{pages.findIndex((page) => page.id === activePageId)+1}</div></div></div><div className="tree-analysis-document-header-bottom"><div>{activePage.header?.activityType || "EXERCICES"}</div><div>{activePage.header?.activityTitle || title || "Feuille d’activité"}</div></div></div>
        {(activePage.mainTitle?.enabled ?? true) && <div className="tree-analysis-document-title-banner" style={{left:`${(activePage.margins.left-53)/W*100}%`,right:`${(activePage.margins.right-53)/W*100}%`,top:`${76/H*100}%`}}><div className="tree-analysis-document-title-line">{activePage.mainTitle?.prefix} <span>–</span> {activePage.mainTitle?.title}</div><div className="tree-analysis-document-title-label">{activePage.mainTitle?.subtitle}</div>{activePage.mainTitle?.scoreTotal!==undefined&&<div className="worksheet-main-title-score"><span>Total&nbsp;:</span><span className="worksheet-main-title-score-box"><b>/{activePage.mainTitle.scoreTotal}</b></span></div>}</div>}
        {activePage.taskCallout?.enabled && <div className="worksheet-task-callout" style={{left:`${(activePage.margins.left-10)/W*100}%`,right:`${(activePage.margins.right-53)/W*100}%`,top:`${160/H*100}%`}}><Image className="worksheet-task-label-image" src="/worksheet-assets/ta-tache.png" alt="TA TÂCHE" width={80} height={32} unoptimized/><span className="worksheet-task-arrow" aria-hidden/><p>{activePage.taskCallout.text}</p></div>}
        {badges.filter((item) => item.pageId === activePageId).map((item) => <div key={item.id} className="tree-analysis-question-badge" style={{left:`${item.x/W*100}%`,top:`${item.y/H*100}%`}} onPointerDown={(event) => beginDrag(event,"badge",item)} onDoubleClick={() => { const value=window.prompt("Numéro",String(item.number)); if(value) setBadges((items)=>items.map((badge)=>badge.id===item.id?{...badge,number:Number(value)}:badge)); }}><span>{item.number}</span><button type="button" aria-label="Supprimer le numéro" onClick={(event)=>{event.stopPropagation();setBadges((items)=>items.filter((badge)=>badge.id!==item.id));if(selected?.id===item.id)setSelected(null);}}><X size={10}/></button></div>)}
        {textBoxes.filter((item) => item.pageId === activePageId).map((item) => <div key={item.id} className={`tree-analysis-text-box worksheet-text-box ${selected?.kind === "text" && selected.id === item.id ? "selected" : ""}`} style={{left:`${item.x/W*100}%`,top:`${item.y/H*100}%`,width:`${item.width/W*100}%`,height:`${item.height/H*100}%`,fontSize:`${item.fontSize/W*100}cqw`,fontWeight:item.bold?800:400,textAlign:item.textAlign,"--worksheet-text-line-height":WORKSHEET_TEXT_LINE_HEIGHT} as React.CSSProperties} onPointerDown={(event)=>beginDrag(event,"text",item)} onClick={() => selectTextBox(item.id)}>{selected?.kind==="text"&&selected.id===item.id&&<><button type="button" className="tree-analysis-text-delete" aria-label="Supprimer la boîte" onClick={(event)=>{event.stopPropagation();setTextBoxes((items)=>items.filter((box)=>box.id!==item.id));setSelected(null);}}><X size={14}/></button><span className="tree-analysis-text-resize" onPointerDown={(event)=>beginResize(event,"text-resize",item)}/><span className="worksheet-text-move-edge top" onPointerDown={(event)=>beginDrag(event,"text",item)}/><span className="worksheet-text-move-edge right" onPointerDown={(event)=>beginDrag(event,"text",item)}/><span className="worksheet-text-move-edge bottom" onPointerDown={(event)=>beginDrag(event,"text",item)}/><span className="worksheet-text-move-edge left" onPointerDown={(event)=>beginDrag(event,"text",item)}/></>}<WorksheetEditableText box={item} wrap={worksheetTextWrap(item,images)} onSelect={()=>selectTextBox(item.id)} onSelection={updateTextSelection} onCommit={(text)=>commitText(item,text)}/></div>)}
        {images.filter((item)=>item.pageId===activePageId).map((item)=>{const mode=item.layoutMode??(item.wrapText?"wrap":"front");return <div key={item.id} className={`worksheet-page-image layout-${mode} ${selected?.kind==="image"&&selected.id===item.id?"selected":""}`} style={{left:`${item.x/W*100}%`,top:`${item.y/H*100}%`,width:`${item.width/W*100}%`,height:`${item.height/H*100}%`}} onPointerDown={(event)=>beginDrag(event,"image",item)} onClick={()=>setSelected({kind:"image",id:item.id})}><Image src={item.src} alt={item.alt} fill sizes="50vw" unoptimized/>{selected?.kind==="image"&&selected.id===item.id&&<><button type="button" className="tree-analysis-text-delete worksheet-image-delete" aria-label="Supprimer l’image" onClick={(event)=>{event.stopPropagation();setImages((items)=>items.filter((image)=>image.id!==item.id));setSelected(null);}}><X size={14}/></button><span className="tree-analysis-text-resize worksheet-image-resize" onPointerDown={(event)=>beginResize(event,"image-resize",item)}/></>}</div>;})}
        {scoreBoxes.filter((item) => (item.pageId ?? pages[0]?.id) === activePageId).map((item) => <div key={item.id} className={`tree-analysis-score-box worksheet-score-box ${selected?.kind==="score"&&selected.id===item.id?"selected":""}`} style={{left:`${item.x/W*100}%`,top:`${item.y/H*100}%`,width:`${(item.width??120)/W*100}%`,height:`${(item.height??42)/H*100}%`,fontSize:`${Math.max(12,Math.min((item.height??42)*.46,(item.width??120)/(String(item.total).length+5)))/W*100}cqw`}} onPointerDown={(event) => beginDrag(event,"score",item)} onClick={()=>setSelected({kind:"score",id:item.id})} onDoubleClick={() => { const total=window.prompt("Total de points",String(item.total)); if(total===null)return; const earned=window.prompt("Points obtenus dans le corrigé (vide pour laisser une ligne)",item.earned===undefined?"":String(item.earned)); setScoreBoxes((items)=>items.map((box)=>box.id===item.id?{...box,total:Math.max(1,Number(total)||1),earned:earned?.trim()?Number(earned):undefined}:box)); }}><span>{item.earned ?? "___"} / {item.total}</span>{selected?.kind==="score"&&selected.id===item.id&&<><button type="button" className="tree-analysis-text-delete worksheet-score-delete" aria-label="Supprimer les points" onClick={(event)=>{event.stopPropagation();setScoreBoxes((items)=>items.filter((box)=>box.id!==item.id));setSelected(null);}}><X size={13}/></button><span className="tree-analysis-text-resize worksheet-score-resize" onPointerDown={(event)=>beginResize(event,"score-resize",{...item,width:item.width??120,height:item.height??42})}/></>}</div>)}
        {dimensionBands.filter((item)=>item.pageId===activePageId).map((item)=>{const asset=worksheetDimensionAsset(item.dimension);return <div key={item.id} className={`worksheet-dimension-band ${selected?.kind==="band"&&selected.id===item.id?"selected":""}`} style={{left:`${item.x/W*100}%`,top:`${item.y/H*100}%`,width:`${asset.width/W*100}%`,height:`${asset.height/H*100}%`}} onPointerDown={(event)=>beginDrag(event,"band",item)} onClick={()=>setSelected({kind:"band",id:item.id})}><Image src={asset.src} alt={item.dimension} width={asset.width} height={asset.height} unoptimized/>{selected?.kind==="band"&&selected.id===item.id&&<button type="button" className="tree-analysis-text-delete worksheet-band-delete" onClick={(event)=>{event.stopPropagation();setDimensionBands((items)=>items.filter((band)=>band.id!==item.id));setSelected(null);}}><X size={13}/></button>}</div>;})}
        {tables.filter((item) => (item.pageId ?? pages[0]?.id) === activePageId).map((table) => {const tableWidth=worksheetTableWidth(table);return <div key={table.id} className={`tree-analysis-activity-table worksheet-activity-table ${isFixedWorksheetTable(table)?"fixed-format":""} ${selected?.kind === "table" && selected.id === table.id ? "selected" : ""}`} style={{left:`${table.x/W*100}%`,top:`${table.y/H*100}%`,width:`${tableWidth/W*100}%`,gridTemplateColumns:normalizedColumnWidths(table).map((value)=>`${value/tableWidth}fr`).join(" "),gridTemplateRows:normalizedRowHeights(table).map((value)=>`${value/W*100}cqw`).join(" ")}} onPointerDown={(event) => beginDrag(event,"table",table)} onClick={() => {setSelected({kind:"table",id:table.id});if(selected?.id!==table.id)setSelectedCells([]);}}>{table.cells.map((cell,index) => cell.columnSpan===0?null:<div key={index} className={`tree-analysis-table-cell worksheet-table-cell ${cell.isCorrect?"correct":""} ${selected?.id===table.id&&selectedCells.includes(index)?"cell-selected":""} role-${cell.role??"text"} background-${cell.background??"white"}`} style={{gridColumn:cell.columnSpan&&cell.columnSpan>1?`span ${cell.columnSpan}`:undefined,gridRow:cell.rowSpan&&cell.rowSpan>1?`span ${cell.rowSpan}`:undefined,color:cell.textColor??(cell.background==="black"?"white":"black"),alignItems:cell.verticalAlign==="top"?"flex-start":cell.verticalAlign==="bottom"?"flex-end":"center",justifyContent:cell.textAlign==="left"?"flex-start":cell.textAlign==="right"?"flex-end":"center",borderRightWidth:cell.borderWidth??1,borderBottomWidth:cell.borderWidth??1}} onClick={(event)=>{event.stopPropagation();selectTableCell(table.id,index,event.shiftKey);setSelected({kind:"table",id:table.id});}}><WorksheetTableCellEditor cell={cell} onTextChange={(text)=>setTables((items)=>items.map((item)=>item.id===table.id?{...item,cells:item.cells.map((candidate,i)=>i===index?{...candidate,text}:candidate)}:item))}/></div>)}{selected?.kind==="table"&&selected.id===table.id&&<><button type="button" className="tree-analysis-delete-table" aria-label="Supprimer le tableau" onClick={(event)=>{event.stopPropagation();setTables((items)=>items.filter((item)=>item.id!==table.id));setSelected(null);}}><X size={13}/></button><span className="worksheet-table-move-edge top" onPointerDown={(event)=>beginDrag(event,"table",table)}/><span className="worksheet-table-move-edge right" onPointerDown={(event)=>beginDrag(event,"table",table)}/><span className="worksheet-table-move-edge bottom" onPointerDown={(event)=>beginDrag(event,"table",table)}/><span className="worksheet-table-move-edge left" onPointerDown={(event)=>beginDrag(event,"table",table)}/>{!isFixedWorksheetTable(table)&&<span className="tree-analysis-text-resize worksheet-table-resize" onPointerDown={(event)=>beginResize(event,"table-resize",{id:table.id,width:tableWidth,height:normalizedRowHeights(table).reduce((sum,value)=>sum+value,0)})}/>}</>}</div>;})}
        {answerLines.filter((item) => item.pageId === activePageId).map((item) => <div key={item.id} className={`worksheet-answer-lines ${item.interactive===false&&!item.answer.trim()?"static":""} ${selected?.kind === "lines" && selected.id === item.id ? "selected" : ""}`} style={{left:`${item.x/W*100}%`,top:`${item.y/H*100}%`,width:`${item.width/W*100}%`,height:`${item.lineCount*item.lineSpacing/H*100}%`}} onPointerDown={(event) => beginDrag(event,"lines",item)} onClick={() => setSelected({kind:"lines",id:item.id})}>{Array.from({length:item.lineCount},(_,index)=><span key={index} style={{top:`${(index+1)/item.lineCount*100}%`}}/>)}{printMode==="answer"&&<WorksheetAnswerLinesEditor item={item} onSelect={()=>setSelected({kind:"lines",id:item.id})} onCommit={(patch)=>setAnswerLines((items)=>items.map((line)=>line.id===item.id?{...line,...patch,interactive:patch.answer?.trim()?true:line.interactive}:line))}/>} {selected?.kind==="lines"&&selected.id===item.id&&<><button type="button" className="tree-analysis-text-delete worksheet-lines-delete" aria-label="Supprimer les lignes" onClick={(event)=>{event.stopPropagation();setAnswerLines((items)=>items.filter((line)=>line.id!==item.id));setSelected(null);}}><X size={14}/></button><span className="tree-analysis-text-resize worksheet-lines-resize" onPointerDown={(event)=>beginResize(event,"lines-resize",item)}/></>}</div>)}
        {checkBoxes.filter((item) => item.pageId === activePageId).map((item) => <div key={item.id} role="button" tabIndex={0} className={`worksheet-checkbox-mark ${selected?.kind==="check"&&selected.id===item.id?"selected":""} ${printMode==="answer"&&item.checked?"checked":""}`} style={{left:`${item.x/W*100}%`,top:`${item.y/H*100}%`,width:`${item.size/W*100}%`,height:`${item.size/H*100}%`,fontSize:`${item.size/W*100}cqw`}} onPointerDown={(event)=>beginDrag(event,"check",item)} onClick={(event)=>{event.stopPropagation();setSelected({kind:"check",id:item.id});}} onDoubleClick={(event)=>{event.stopPropagation();setCheckBoxes((items)=>items.map((box)=>box.id===item.id?{...box,checked:!box.checked}:box));}} aria-label="Case à cocher">{selected?.kind==="check"&&selected.id===item.id&&<span className="tree-analysis-text-delete worksheet-checkbox-delete" onPointerDown={(event)=>event.stopPropagation()} onClick={(event)=>{event.stopPropagation();setCheckBoxes((items)=>items.filter((box)=>box.id!==item.id));setSelected(null);}}><X size={10}/></span>}</div>)}
      </div></div></div>
    </Card>
    <Card className="tree-analysis-flow-panel worksheet-flow-panel"><div><span className="eyebrow">Déroulement du lecteur</span><h3>Ordre de révélation</h3></div><p>Les lignes de réponse interactives deviennent des étapes. Les lignes et cases ajoutées dans les tableaux restent des repères visuels.</p><div className="tree-analysis-phase-list">{pageSteps.map((id,index) => <div className="tree-analysis-phase" key={id}><div className="tree-analysis-phase-heading"><span>{index+1}</span><strong>Afficher une réponse sur les lignes</strong><button type="button" onClick={() => moveStep(id,-1)} disabled={index===0}><ArrowUp size={15}/></button><button type="button" onClick={() => moveStep(id,1)} disabled={index===pageSteps.length-1}><ArrowDown size={15}/></button></div></div>)}</div>{!pageSteps.length&&<p>Ajoute des lignes de réponse interactives si tu veux révéler une réponse dans le lecteur.</p>}</Card>
  </div>;
}
