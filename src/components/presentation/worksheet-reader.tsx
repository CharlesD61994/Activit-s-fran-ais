"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReaderChromePortal } from "@/components/presentation/reader-chrome";
import type { Sentence, TreeAnalysisTable, TreeAnalysisTableCell, TreeAnalysisTextBox, WorksheetAnswerLines } from "@/types";
import { isFixedWorksheetTable, normalizedColumnWidths, normalizedRowHeights, worksheetTableWidth } from "@/lib/worksheet-tables";
import { worksheetDimensionAsset } from "@/lib/worksheet-dimensions";
import { worksheetTextWrap } from "@/lib/worksheet-images";
import { renderSharedAnnotatedText } from "@/components/grammar/shared-annotated-text";

type Props = {
  sentence: Sentence;
  persistenceKey?: string;
  finishControl?: ReactNode;
  onCompleteChange?: (complete: boolean) => void;
};
const W = 1056;
const H = 816;
const answerLineHeight = (item: WorksheetAnswerLines) => `${item.lineSpacing / W * 100}cqw`;
const WORKSHEET_TEXT_LINE_HEIGHT = 1.1;

function ReaderText({ box, wrap }: { box: TreeAnalysisTextBox; wrap: ReturnType<typeof worksheetTextWrap> }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [lineCenters, setLineCenters] = useState<number[]>([]);
  useLayoutEffect(() => {
    const element = contentRef.current;
    if (!element || !box.showLineNumbers) { setLineCenters([]); return; }
    const measure = () => {
      const root = element.getBoundingClientRect();
      const centers: number[] = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const value = node.textContent ?? "";
        for (let index = 0; index < value.length; index += 1) {
          if (/\s/u.test(value[index]) && value[index] !== "\u00a0") continue;
          const range = document.createRange();
          range.setStart(node, index); range.setEnd(node, index + 1);
          const rect = range.getClientRects()[0];
          if (rect?.height) {
            const center = rect.top - root.top + rect.height / 2;
            if (!centers.some((candidate) => Math.abs(candidate - center) < 2)) centers.push(center);
          }
        }
        node = walker.nextNode();
      }
      setLineCenters(centers.sort((a,b)=>a-b));
    };
    measure();
    const observer = new ResizeObserver(measure); observer.observe(element);
    return () => observer.disconnect();
  }, [box.annotations, box.fontSize, box.height, box.showLineNumbers, box.text, box.width, wrap]);
  return <>{box.showLineNumbers&&<div className="worksheet-line-numbers" aria-hidden>{lineCenters.map((top,index)=>(index+1)%5===0?<span key={index} style={{top}}>{index+1}</span>:null)}</div>}<div ref={contentRef} className="worksheet-reader-text-content">{wrap && <span className={`worksheet-text-wrap-space ${wrap.side}`} style={{ width: `${wrap.width / box.width * 100}%`, height: `${wrap.height / box.height * 100}%`, "--worksheet-wrap-top": `${wrap.marginTop / Math.max(1, wrap.height) * 100}%` } as React.CSSProperties}/>}<>{renderSharedAnnotatedText(box.text,box.annotations,"tree-analysis-framed-text")}</></div></>;
}

function ReaderCell({ cell }: { cell: TreeAnalysisTableCell }) {
  return <span className="worksheet-reader-cell-copy"><span>{cell.text}</span></span>;
}

export function WorksheetReader({ sentence, persistenceKey, finishControl, onCompleteChange }: Props) {
  const pages = useMemo(() => sentence.treeAnalysisDocumentPages ?? [], [sentence.treeAnalysisDocumentPages]);
  const textBoxes = useMemo(() => sentence.treeAnalysisTextBoxes ?? [], [sentence.treeAnalysisTextBoxes]);
  const scoreBoxes = useMemo(() => sentence.treeAnalysisScoreBoxes ?? [], [sentence.treeAnalysisScoreBoxes]);
  const tables = useMemo(() => sentence.treeAnalysisTables ?? [], [sentence.treeAnalysisTables]);
  const badges = useMemo(() => sentence.treeAnalysisQuestionBadges ?? [], [sentence.treeAnalysisQuestionBadges]);
  const lines = useMemo(() => sentence.worksheetAnswerLines ?? [], [sentence.worksheetAnswerLines]);
  const checkBoxes = useMemo(() => sentence.worksheetCheckBoxes ?? [], [sentence.worksheetCheckBoxes]);
  const bands = useMemo(() => sentence.worksheetDimensionBands ?? [], [sentence.worksheetDimensionBands]);
  const images = useMemo(() => sentence.worksheetImages ?? [], [sentence.worksheetImages]);
  const availableSteps = useMemo(() => lines.filter((item) => item.interactive !== false || Boolean(item.answer.trim())).map((item) => `lines:${item.id}`), [lines]);
  const steps = useMemo(() => [...(sentence.worksheetReaderOrder ?? []).filter((id) => availableSteps.includes(id)), ...availableSteps.filter((id) => !(sentence.worksheetReaderOrder ?? []).includes(id))], [availableSteps, sentence.worksheetReaderOrder]);
  const [completed, setCompleted] = useState<string[]>([]);
  const [revealedCells, setRevealedCells] = useState<string[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [hydrated, setHydrated] = useState(false);
  const page = pages[pageIndex] ?? pages[0];
  const pageId = page?.id;
  const currentStep = steps.find((id) => !completed.includes(id));

  useEffect(() => {
    if (!persistenceKey || typeof window === "undefined") { setHydrated(true); return; }
    try {
      const raw = window.sessionStorage.getItem(persistenceKey);
      if (raw) {
        const saved = JSON.parse(raw) as { completed?: string[]; revealedCells?: string[]; pageIndex?: number };
        setCompleted(saved.completed ?? []);
        setRevealedCells(saved.revealedCells ?? []);
        setPageIndex(saved.pageIndex ?? 0);
      }
    } catch { window.sessionStorage.removeItem(persistenceKey); }
    setHydrated(true);
  }, [persistenceKey, sentence.id]);

  useEffect(() => {
    if (hydrated && persistenceKey && typeof window !== "undefined") window.sessionStorage.setItem(persistenceKey, JSON.stringify({ completed, revealedCells, pageIndex }));
  }, [completed, hydrated, pageIndex, persistenceKey, revealedCells]);

  useEffect(() => {
    if (!hydrated) return;
    onCompleteChange?.(completed.length >= steps.length);
  }, [completed.length, hydrated, onCompleteChange, steps.length]);

  function toggleStep(id: string) { setCompleted((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]); }
  function toggleCell(table: TreeAnalysisTable, index: number) {
    const cell = table.cells[index];
    if (cell?.role === "answer_line" || cell?.role === "checkbox") return;
    if (!cell || (!cell.isCorrect && !cell.answer?.trim())) return;
    const key = `${table.id}:${index}`;
    setRevealedCells((current) => {
      const next = current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
      const targets = table.cells.map((candidate, targetIndex) => candidate.isCorrect || Boolean(candidate.answer?.trim()) ? targetIndex : -1).filter((targetIndex) => targetIndex >= 0);
      const done = targets.length > 0 && targets.every((targetIndex) => next.includes(`${table.id}:${targetIndex}`));
      const stepId = `table:${table.id}`;
      setCompleted((items) => done ? (items.includes(stepId) ? items : [...items, stepId]) : items.filter((item) => item !== stepId));
      return next;
    });
  }
  function restart() {
    setCompleted([]); setRevealedCells([]); setPageIndex(0); setZoom(1);
    onCompleteChange?.(steps.length === 0);
    if (persistenceKey && typeof window !== "undefined") window.sessionStorage.removeItem(persistenceKey);
  }

  return <div className="worksheet-reader tree-reader">
    <ReaderChromePortal slot="instruction"><div className="worksheet-reader-top-tools"><Button type="button" variant="secondary" onClick={restart}><RotateCcw size={18}/> Recommencer</Button><div className="tree-reader-zoom"><button type="button" onClick={() => setZoom((value) => Math.max(.6, Number((value - .1).toFixed(1))))}><Minus size={17}/></button><button type="button" onClick={() => setZoom(1)}>{Math.round(zoom * 100)} %</button><button type="button" onClick={() => setZoom((value) => Math.min(1.5, Number((value + .1).toFixed(1))))}><Plus size={17}/></button></div>{pages.length > 1 && <div className="worksheet-page-navigation"><button type="button" disabled={pageIndex === 0} onClick={() => setPageIndex((value) => value - 1)}><ChevronLeft size={17}/></button><strong>Page {pageIndex + 1} / {pages.length}</strong><button type="button" disabled={pageIndex >= pages.length - 1} onClick={() => setPageIndex((value) => value + 1)}><ChevronRight size={17}/></button></div>}{completed.length >= steps.length ? finishControl : null}</div></ReaderChromePortal>
    {page && <div className="tree-reader-page-viewport"><div className="tree-reader-page portrait document-template worksheet-reader-page" style={{ aspectRatio: "8.5 / 11", zoom }}>
      <div className="tree-analysis-document-header" style={{ left: `${page.margins.left / W * 100}%`, right: `${page.margins.right / W * 100}%`, top: `${(page.header?.nameY ?? 25) / H * 100}%` }}><div className="tree-analysis-document-header-top"><div className="tree-analysis-student-fields"><span>NOM</span><span>GROUPE</span></div><div className="tree-analysis-page-cell"><div className="tree-analysis-page-badge">{pageIndex + 1}</div></div></div><div className="tree-analysis-document-header-bottom"><div>{page.header?.activityType || "EXERCICES"}</div><div>{page.header?.activityTitle || sentence.title}</div></div></div>
      {(page.mainTitle?.enabled ?? true) && <div className="tree-analysis-document-title-banner" style={{ left: `${(page.margins.left - 53) / W * 100}%`, right: `${(page.margins.right - 53) / W * 100}%`, top: `${76 / H * 100}%` }}><div className="tree-analysis-document-title-line">{page.mainTitle?.prefix} <span>–</span> {page.mainTitle?.title}</div><div className="tree-analysis-document-title-label">{page.mainTitle?.subtitle}</div>{page.mainTitle?.scoreTotal !== undefined && <div className="worksheet-main-title-score"><span>Total&nbsp;:</span><span className="worksheet-main-title-score-box"><b>/{page.mainTitle.scoreTotal}</b></span></div>}</div>}
      {page.taskCallout?.enabled && <div className="worksheet-task-callout" style={{ left: `${(page.margins.left - 10) / W * 100}%`, right: `${(page.margins.right - 53) / W * 100}%`, top: `${160 / H * 100}%` }}><Image className="worksheet-task-label-image" src="/worksheet-assets/ta-tache.png" alt="TA TÂCHE" width={80} height={32} unoptimized/><span className="worksheet-task-arrow" aria-hidden/><p>{page.taskCallout.text}</p></div>}
      {badges.filter((item) => item.pageId === pageId).map((item) => <div key={item.id} className="tree-analysis-question-badge reader" style={{ left: `${item.x / W * 100}%`, top: `${item.y / H * 100}%` }}><span>{item.number}</span></div>)}
      {textBoxes.filter((item) => item.pageId === pageId).map((item) => <div key={item.id} className="tree-reader-text worksheet-reader-text" style={{ left: `${item.x / W * 100}%`, top: `${item.y / H * 100}%`, width: `${item.width / W * 100}%`, height: `${item.height / H * 100}%`, fontSize: `${item.fontSize / W * 100}cqw`, fontWeight: item.bold ? 800 : 400, textAlign: item.textAlign ?? "left", "--worksheet-text-line-height": WORKSHEET_TEXT_LINE_HEIGHT } as React.CSSProperties}><ReaderText box={item} wrap={worksheetTextWrap(item, images)}/></div>)}
      {images.filter((item) => item.pageId === pageId).map((item) => { const mode = item.layoutMode ?? (item.wrapText ? "wrap" : "front"); return <div key={item.id} className={`worksheet-page-image reader layout-${mode}`} style={{ left: `${item.x / W * 100}%`, top: `${item.y / H * 100}%`, width: `${item.width / W * 100}%`, height: `${item.height / H * 100}%` }}><Image src={item.src} alt={item.alt} fill sizes="50vw" unoptimized/></div>; })}
      {scoreBoxes.filter((item) => (item.pageId ?? pages[0]?.id) === pageId).map((item) => <div key={item.id} className="tree-analysis-score-box worksheet-score-box" style={{ left: `${item.x / W * 100}%`, top: `${item.y / H * 100}%`, width: `${(item.width ?? 120) / W * 100}%`, height: `${(item.height ?? 42) / H * 100}%`, fontSize: `${Math.max(12, Math.min((item.height ?? 42) * .46, (item.width ?? 120) / (String(item.total).length + 5))) / W * 100}cqw` }}><span>{item.earned ?? "___"} / {item.total}</span></div>)}
      {bands.filter((item) => item.pageId === pageId).map((item) => { const asset = worksheetDimensionAsset(item.dimension); return <div key={item.id} className="worksheet-dimension-band reader" style={{ left: `${item.x / W * 100}%`, top: `${item.y / H * 100}%`, width: `${asset.width / W * 100}%`, height: `${asset.height / H * 100}%` }}><Image src={asset.src} alt={item.dimension} width={asset.width} height={asset.height} unoptimized/></div>; })}
      {tables.filter((item) => (item.pageId ?? pages[0]?.id) === pageId).map((table) => {
        const stepId = `table:${table.id}`; const interactive = table.cells.some((cell) => cell.isCorrect || Boolean(cell.answer?.trim())); const width = worksheetTableWidth(table);
        return <div key={table.id} className={`tree-reader-table worksheet-reader-table ${isFixedWorksheetTable(table) ? "fixed-format" : ""} ${interactive && currentStep === stepId ? "active" : ""}`} style={{ left: `${table.x / W * 100}%`, top: `${table.y / H * 100}%`, width: `${width / W * 100}%`, gridTemplateColumns: normalizedColumnWidths(table).map((value) => `${value / width}fr`).join(" "), gridTemplateRows: normalizedRowHeights(table).map((value) => `${value / W * 100}cqw`).join(" ") }}>
          {table.cells.map((cell, index) => { if (cell.columnSpan === 0) return null; const revealed = revealedCells.includes(`${table.id}:${index}`); const cellInteractive = Boolean(cell.isCorrect || cell.answer?.trim()); return <button key={index} type="button" className={`${revealed && cell.isCorrect ? "selected-correct" : ""} role-${cell.role ?? "text"} background-${cell.background ?? "white"}`} style={{ gridColumn: cell.columnSpan && cell.columnSpan > 1 ? `span ${cell.columnSpan}` : undefined, gridRow: cell.rowSpan && cell.rowSpan > 1 ? `span ${cell.rowSpan}` : undefined, color: cell.textColor ?? (cell.background === "black" ? "white" : "black"), fontSize: `${(cell.fontSize ?? 17) / W * 100}cqw`, fontWeight: cell.bold ? 800 : 500, textAlign: cell.textAlign ?? "center", justifyContent: cell.textAlign === "left" ? "flex-start" : cell.textAlign === "right" ? "flex-end" : "center", alignItems: cell.verticalAlign === "top" ? "flex-start" : cell.verticalAlign === "bottom" ? "flex-end" : "center", borderRightWidth: cell.borderWidth ?? 1, borderBottomWidth: cell.borderWidth ?? 1 }} disabled={!cellInteractive} onClick={() => toggleCell(table, index)}><ReaderCell cell={cell}/></button>; })}
        </div>;
      })}
      {lines.filter((item) => item.pageId === pageId).map((item) => { const stepId = `lines:${item.id}`; const revealed = completed.includes(stepId); const staticLine = item.interactive === false && !item.answer.trim(); const style = { left: `${item.x / W * 100}%`, top: `${item.y / H * 100}%`, width: `${item.width / W * 100}%`, height: `${item.lineCount * item.lineSpacing / H * 100}%` }; const rules = Array.from({ length: item.lineCount }, (_, index) => <span key={index} style={{ top: `${(index + 1) / item.lineCount * 100}%` }}/>); if (staticLine) return <div key={item.id} className="worksheet-answer-lines reader static" style={style}>{rules}</div>; return <button key={item.id} type="button" className="worksheet-answer-lines reader" style={style} onClick={() => toggleStep(stepId)}>{rules}{revealed && <div className="worksheet-answer-copy" style={{ fontSize: `${item.answerFontSize / W * 100}cqw`, lineHeight: answerLineHeight(item), fontWeight: item.answerBold ? 800 : 400, textAlign: item.answerTextAlign ?? "left" }}>{item.answer}</div>}</button>; })}
      {checkBoxes.filter((item) => item.pageId === pageId).map((item) => <div key={item.id} className={`worksheet-checkbox-mark reader ${item.checked ? "checked" : ""}`} style={{ left: `${item.x / W * 100}%`, top: `${item.y / H * 100}%`, width: `${item.size / W * 100}%`, height: `${item.size / H * 100}%`, fontSize: `${item.size / W * 100}cqw` }}/>)}
    </div></div>}
  </div>;
}
