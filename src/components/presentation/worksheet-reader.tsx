"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReaderChromePortal } from "@/components/presentation/reader-chrome";
import type { Sentence, TreeAnalysisTableCell, TreeAnalysisTextBox } from "@/types";
import { isFixedWorksheetTable, normalizedColumnWidths, normalizedRowHeights, tableHasInteraction, worksheetTableWidth } from "@/lib/worksheet-tables";
import { worksheetDimensionAsset } from "@/lib/worksheet-dimensions";
import { worksheetTextWrap } from "@/lib/worksheet-images";

type Props = { sentence: Sentence; persistenceKey?: string; finishControl?: ReactNode };
const W = 1056;
const H = 816;

function WorksheetReaderText({ box, wrap }: { box: TreeAnalysisTextBox; wrap: ReturnType<typeof worksheetTextWrap> }) {
  return <>{wrap&&<span className={`worksheet-text-wrap-space ${wrap.side}`} style={{width:`${wrap.width/box.width*100}%`,height:`${wrap.height/box.height*100}%`,marginTop:`${wrap.marginTop/box.height*100}%`}}/>}{box.text}</>;
}

function WorksheetReaderCell({ cell, revealed }: { cell: TreeAnalysisTableCell; revealed: boolean }) {
  return <span className="worksheet-reader-cell-copy"><span>{cell.text}</span>{revealed&&cell.answer&&<span className="worksheet-cell-revealed-answer">{cell.answer}</span>}</span>;
}

export function WorksheetReader({ sentence, persistenceKey, finishControl }: Props) {
  const pages = useMemo(() => sentence.treeAnalysisDocumentPages ?? [], [sentence.treeAnalysisDocumentPages]);
  const textBoxes = useMemo(() => sentence.treeAnalysisTextBoxes ?? [], [sentence.treeAnalysisTextBoxes]);
  const scoreBoxes = useMemo(() => sentence.treeAnalysisScoreBoxes ?? [], [sentence.treeAnalysisScoreBoxes]);
  const tables = useMemo(() => sentence.treeAnalysisTables ?? [], [sentence.treeAnalysisTables]);
  const badges = useMemo(() => sentence.treeAnalysisQuestionBadges ?? [], [sentence.treeAnalysisQuestionBadges]);
  const lines = useMemo(() => sentence.worksheetAnswerLines ?? [], [sentence.worksheetAnswerLines]);
  const dimensionBands = useMemo(() => sentence.worksheetDimensionBands ?? [], [sentence.worksheetDimensionBands]);
  const images = useMemo(() => sentence.worksheetImages ?? [], [sentence.worksheetImages]);
  const availableSteps = useMemo(() => [
    ...lines.map((item) => `lines:${item.id}`),
    ...tables.filter(tableHasInteraction).map((table) => `table:${table.id}`)
  ], [lines, tables]);
  const steps = useMemo(() => [...(sentence.worksheetReaderOrder ?? []).filter((id) => availableSteps.includes(id)), ...availableSteps.filter((id) => !(sentence.worksheetReaderOrder ?? []).includes(id))], [availableSteps, sentence.worksheetReaderOrder]);
  const [completed, setCompleted] = useState<string[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [hydrated, setHydrated] = useState(false);
  const currentPage = pages[pageIndex] ?? pages[0];
  const currentPageId = currentPage?.id;
  const currentStep = steps.find((id) => !completed.includes(id));

  useEffect(() => {
    if (!persistenceKey || typeof window === "undefined") { setHydrated(true); return; }
    try { const raw = window.sessionStorage.getItem(persistenceKey); if (raw) { const saved = JSON.parse(raw) as { completed?: string[]; pageIndex?: number }; setCompleted(saved.completed ?? []); setPageIndex(saved.pageIndex ?? 0); } } catch { window.sessionStorage.removeItem(persistenceKey); }
    setHydrated(true);
  }, [persistenceKey, sentence.id]);
  useEffect(() => { if (hydrated && persistenceKey && typeof window !== "undefined") window.sessionStorage.setItem(persistenceKey, JSON.stringify({ completed, pageIndex })); }, [completed, hydrated, pageIndex, persistenceKey]);
  useEffect(() => {
    if (!currentStep) return;
    const id = currentStep.split(":")[1];
    const pageId = currentStep.startsWith("lines:") ? lines.find((item) => item.id === id)?.pageId : tables.find((item) => item.id === id)?.pageId;
    const index = pages.findIndex((page) => page.id === pageId); if (index >= 0) setPageIndex(index);
  }, [currentStep, lines, pages, tables]);

  function complete(id: string) { setCompleted((items) => items.includes(id) ? items : [...items, id]); }
  function toggleComplete(id: string) { setCompleted((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]); }
  function restart() { setCompleted([]); setPageIndex(0); setZoom(1); if (persistenceKey && typeof window !== "undefined") window.sessionStorage.removeItem(persistenceKey); }

  return <div className="worksheet-reader tree-reader">
    <ReaderChromePortal slot="instruction"><div className="worksheet-reader-top-tools"><Button type="button" variant="secondary" onClick={restart}><RotateCcw size={18}/> Recommencer</Button><div className="tree-reader-zoom" aria-label="Zoom de la feuille"><button type="button" onClick={()=>setZoom((value)=>Math.max(.6,Number((value-.1).toFixed(1))))} aria-label="Dézoomer"><Minus size={17}/></button><button type="button" onClick={()=>setZoom(1)}>{Math.round(zoom*100)} %</button><button type="button" onClick={()=>setZoom((value)=>Math.min(1.5,Number((value+.1).toFixed(1))))} aria-label="Zoomer"><Plus size={17}/></button></div>{pages.length>1&&<div className="worksheet-page-navigation"><button type="button" disabled={pageIndex===0} onClick={() => setPageIndex((value)=>value-1)}><ChevronLeft size={17}/></button><strong>Page {pageIndex+1} / {Math.max(1,pages.length)}</strong><button type="button" disabled={pageIndex>=pages.length-1} onClick={() => setPageIndex((value)=>value+1)}><ChevronRight size={17}/></button></div>}{completed.length >= steps.length ? finishControl : null}</div></ReaderChromePortal>
    {currentPage && <div className="tree-reader-page-viewport"><div className="tree-reader-page portrait document-template worksheet-reader-page" style={{aspectRatio:"8.5 / 11",zoom}}>
      <div className="tree-analysis-document-header" style={{left:`${currentPage.margins.left/W*100}%`,right:`${currentPage.margins.right/W*100}%`,top:`${(currentPage.header?.nameY??25)/H*100}%`}}><div className="tree-analysis-document-header-top"><div className="tree-analysis-student-fields"><span>NOM</span><span>GROUPE</span></div><div className="tree-analysis-page-cell"><div className="tree-analysis-page-badge">{pageIndex+1}</div></div></div><div className="tree-analysis-document-header-bottom"><div>{currentPage.header?.activityType||"EXERCICES"}</div><div>{currentPage.header?.activityTitle||sentence.title}</div></div></div>
      {(currentPage.mainTitle?.enabled??true)&&<div className="tree-analysis-document-title-banner" style={{left:`${(currentPage.margins.left-53)/W*100}%`,right:`${(currentPage.margins.right-53)/W*100}%`,top:`${82/H*100}%`}}><div className="tree-analysis-document-title-line">{currentPage.mainTitle?.prefix} <span>–</span> {currentPage.mainTitle?.title}</div><div className="tree-analysis-document-title-label">{currentPage.mainTitle?.subtitle}</div></div>}
      {badges.filter((item)=>item.pageId===currentPageId).map((item)=><div key={item.id} className="tree-analysis-question-badge reader" style={{left:`${item.x/W*100}%`,top:`${item.y/H*100}%`}}><span>{item.number}</span></div>)}
      {textBoxes.filter((item)=>item.pageId===currentPageId).map((item)=><div key={item.id} className="tree-reader-text worksheet-reader-text" style={{left:`${item.x/W*100}%`,top:`${item.y/H*100}%`,width:`${item.width/W*100}%`,height:`${item.height/H*100}%`,fontSize:`${item.fontSize/W*100}cqw`,textAlign:item.textAlign??"left"}}><WorksheetReaderText box={item} wrap={worksheetTextWrap(item,images)}/></div>)}
      {images.filter((item)=>item.pageId===currentPageId).map((item)=><div key={item.id} className="worksheet-page-image reader" style={{left:`${item.x/W*100}%`,top:`${item.y/H*100}%`,width:`${item.width/W*100}%`,height:`${item.height/H*100}%`}}><Image src={item.src} alt={item.alt} fill sizes="50vw" unoptimized/></div>)}
      {scoreBoxes.filter((item)=>(item.pageId??pages[0]?.id)===currentPageId).map((item)=><div key={item.id} className="tree-analysis-score-box worksheet-score-box" style={{left:`${item.x/W*100}%`,top:`${item.y/H*100}%`,width:`${(item.width??120)/W*100}%`,height:`${(item.height??42)/H*100}%`,fontSize:`${Math.max(12,Math.min((item.height??42)*.46,(item.width??120)/(String(item.total).length+5)))/W*100}cqw`}}><span>{item.earned??"___"} / {item.total}</span></div>)}
      {dimensionBands.filter((item)=>item.pageId===currentPageId).map((item)=>{const asset=worksheetDimensionAsset(item.dimension);return <div key={item.id} className="worksheet-dimension-band reader" style={{left:`${item.x/W*100}%`,top:`${item.y/H*100}%`,width:`${asset.width/W*100}%`,height:`${asset.height/H*100}%`}}><Image src={asset.src} alt={item.dimension} width={asset.width} height={asset.height} unoptimized/></div>;})}
      {tables.filter((item)=>(item.pageId??pages[0]?.id)===currentPageId).map((table)=>{const stepId=`table:${table.id}`;const done=completed.includes(stepId);const interactive=tableHasInteraction(table);const tableWidth=worksheetTableWidth(table);return <div key={table.id} className={`tree-reader-table worksheet-reader-table ${isFixedWorksheetTable(table)?"fixed-format":""} ${interactive&&currentStep===stepId?"active":""}`} style={{left:`${table.x/W*100}%`,top:`${table.y/H*100}%`,width:`${tableWidth/W*100}%`,gridTemplateColumns:normalizedColumnWidths(table).map((value)=>`${value/tableWidth}fr`).join(" "),gridTemplateRows:normalizedRowHeights(table).map((value)=>`${value/W*100}cqw`).join(" ")}}>{table.cells.map((cell,index)=>cell.columnSpan===0?null:<button key={index} type="button" className={`${done&&cell.isCorrect?"selected-correct":""} role-${cell.role??"text"} background-${cell.background??"white"}`} style={{gridColumn:cell.columnSpan&&cell.columnSpan>1?`span ${cell.columnSpan}`:undefined,gridRow:cell.rowSpan&&cell.rowSpan>1?`span ${cell.rowSpan}`:undefined,color:cell.textColor??(cell.background==="black"?"white":"black"),fontSize:`${(cell.fontSize??17)/W*100}cqw`,fontWeight:cell.bold?800:500,textAlign:cell.textAlign??"center",justifyContent:cell.textAlign==="left"?"flex-start":cell.textAlign==="right"?"flex-end":"center",alignItems:cell.verticalAlign==="top"?"flex-start":cell.verticalAlign==="bottom"?"flex-end":"center",borderRightWidth:cell.borderWidth??2,borderBottomWidth:cell.borderWidth??2}} disabled={!interactive||(currentStep!==stepId&&!done)} onClick={()=>{if(done)toggleComplete(stepId);else if(cell.isCorrect||cell.answer?.trim())complete(stepId)}}>{cell.role==="choice"&&<span className="worksheet-choice-mark">{done&&cell.isCorrect?"☑":"□"}</span>}<WorksheetReaderCell cell={cell} revealed={done}/></button>)}</div>})}
      {lines.filter((item)=>item.pageId===currentPageId).map((item)=>{const stepId=`lines:${item.id}`;const revealed=completed.includes(stepId);return <button key={item.id} type="button" className={`worksheet-answer-lines reader ${currentStep===stepId?"active":""}`} style={{left:`${item.x/W*100}%`,top:`${item.y/H*100}%`,width:`${item.width/W*100}%`,height:`${item.lineCount*item.lineSpacing/H*100}%`}} disabled={currentStep!==stepId&&!revealed} onClick={()=>toggleComplete(stepId)}>{Array.from({length:item.lineCount},(_,index)=><span key={index} style={{top:`${(index+1)/item.lineCount*100}%`}}/>)}{revealed&&<div className="worksheet-answer-copy" style={{fontSize:`${item.answerFontSize/W*100}cqw`,lineHeight:item.lineSpacing/item.answerFontSize}}>{item.answer}</div>}</button>})}
    </div></div>}
  </div>;
}
