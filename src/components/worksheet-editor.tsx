"use client";

import { useMemo, useRef, useState } from "react";
import { AlignCenter, AlignJustify, AlignLeft, ArrowDown, ArrowUp, Check, Grid3X3, Plus, Printer, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SchoolLevel, Sentence, SentenceDifficulty, TreeAnalysisDocumentPage, TreeAnalysisQuestionBadge, TreeAnalysisScoreBox, TreeAnalysisTable, TreeAnalysisTextBox, WorksheetAnswerLines } from "@/types";

type Props = { initialSentence?: Sentence; levels: SchoolLevel[]; onSave: (sentence: Sentence) => void };
type MovableKind = "text" | "score" | "table" | "badge" | "lines";
type DragKind = MovableKind | "text-resize" | "lines-resize";
type DragState = { kind: DragKind; id: string; offsetX: number; offsetY: number } | null;

const W = 1056;
const H = 816;
const defaultPage = (id = crypto.randomUUID()): TreeAnalysisDocumentPage => ({
  id,
  orientation: "portrait",
  template: "teaching_document",
  rectanglePreset: "compact",
  margins: { top: 68, right: 121, bottom: 50, left: 121 },
  header: { nameX: 121, nameY: 25, groupX: 650, groupY: 25, fontSize: 11, lineWidth: 250, activityType: "EXERCICES", activityTitle: "Feuille d’activité", showPageBadge: true },
  mainTitle: { enabled: true, prefix: "Exercices", title: "Feuille d’activité", subtitle: "Activité" }
});
const difficultyLabels: Record<SentenceDifficulty, string> = { easy: "Facile", medium: "Moyenne", hard: "Difficile" };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const ALIGNMENT_TOLERANCE = 6;

export function WorksheetEditor({ initialSentence, levels, onSave }: Props) {
  const [title, setTitle] = useState(initialSentence?.title ?? "");
  const [levelId, setLevelId] = useState(initialSentence?.levelId ?? levels[0]?.id ?? "");
  const [difficulty, setDifficulty] = useState<SentenceDifficulty>(initialSentence?.difficulty ?? "medium");
  const [pages, setPages] = useState<TreeAnalysisDocumentPage[]>(() => initialSentence?.treeAnalysisDocumentPages?.length ? initialSentence.treeAnalysisDocumentPages.map((page) => ({ ...page, orientation: "portrait", template: "teaching_document" })) : [defaultPage("page-1")]);
  const [activePageId, setActivePageId] = useState(() => initialSentence?.treeAnalysisDocumentPages?.[0]?.id ?? "page-1");
  const [textBoxes, setTextBoxes] = useState<TreeAnalysisTextBox[]>(initialSentence?.treeAnalysisTextBoxes ?? []);
  const [scoreBoxes, setScoreBoxes] = useState<TreeAnalysisScoreBox[]>(initialSentence?.treeAnalysisScoreBoxes ?? []);
  const [tables, setTables] = useState<TreeAnalysisTable[]>(initialSentence?.treeAnalysisTables ?? []);
  const [badges, setBadges] = useState<TreeAnalysisQuestionBadge[]>(initialSentence?.treeAnalysisQuestionBadges ?? []);
  const [answerLines, setAnswerLines] = useState<WorksheetAnswerLines[]>(initialSentence?.worksheetAnswerLines ?? []);
  const [readerOrder, setReaderOrder] = useState<string[]>(initialSentence?.worksheetReaderOrder ?? []);
  const [selected, setSelected] = useState<{ kind: MovableKind; id: string } | null>(null);
  const [alignmentGuides, setAlignmentGuides] = useState<{ x?: number; y?: number }>({});
  const [printMode, setPrintMode] = useState<"student" | "answer">("student");
  const drag = useRef<DragState>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const activePage = pages.find((page) => page.id === activePageId) ?? pages[0];

  const pageSteps = useMemo(() => {
    const ids = [
      ...answerLines.filter((item) => item.pageId === activePageId).map((item) => `lines:${item.id}`),
      ...tables.filter((item) => (item.pageId ?? pages[0]?.id) === activePageId && item.cells.some((cell) => cell.isCorrect)).map((item) => `table:${item.id}`)
    ];
    return [...readerOrder.filter((id) => ids.includes(id)), ...ids.filter((id) => !readerOrder.includes(id))];
  }, [activePageId, answerLines, pages, readerOrder, tables]);

  function updatePage(patch: Partial<TreeAnalysisDocumentPage>) {
    setPages((current) => current.map((page) => page.id === activePageId ? { ...page, ...patch, orientation: "portrait", template: "teaching_document" } : page));
  }

  function addPage() { const page = defaultPage(); setPages((current) => [...current, page]); setActivePageId(page.id); }
  function addText() {
    const box: TreeAnalysisTextBox = { id: crypto.randomUUID(), pageId: activePageId, x: 121, y: 190, width: 520, height: 80, text: "Écris ton texte ici.", fontSize: 21, textAlign: "left", annotations: [] };
    setTextBoxes((current) => [...current, box]); setSelected({ kind: "text", id: box.id });
  }
  function addScore() {
    const total = Math.max(1, Math.round(Number(window.prompt("Total de points", "10")) || 10));
    const box: TreeAnalysisScoreBox = { id: crypto.randomUUID(), pageId: activePageId, x: 740, y: 190, total, size: "normal" };
    setScoreBoxes((current) => [...current, box]); setSelected({ kind: "score", id: box.id });
  }
  function addBadge() {
    const pageBadges = badges.filter((badge) => badge.pageId === activePageId);
    const badge: TreeAnalysisQuestionBadge = { id: crypto.randomUUID(), pageId: activePageId, x: 121, y: 205 + pageBadges.length * 70, number: pageBadges.length + 1 };
    setBadges((current) => [...current, badge]); setSelected({ kind: "badge", id: badge.id });
  }
  function addTable() {
    const rows = clamp(Math.round(Number(window.prompt("Nombre de rangées", "2")) || 2), 1, 8);
    const columns = clamp(Math.round(Number(window.prompt("Nombre de colonnes", "3")) || 3), 1, 8);
    const table: TreeAnalysisTable = { id: crypto.randomUUID(), pageId: activePageId, x: 180, y: 360, rows, columns, cells: Array.from({ length: rows * columns }, () => ({ text: "", isCorrect: false })) };
    setTables((current) => [...current, table]); setSelected({ kind: "table", id: table.id });
  }
  function addLines() {
    const item: WorksheetAnswerLines = { id: crypto.randomUUID(), pageId: activePageId, x: 150, y: 300, width: 760, lineCount: 2, lineSpacing: 20, answer: "", answerFontSize: 18 };
    setAnswerLines((current) => [...current, item]); setSelected({ kind: "lines", id: item.id });
  }

  function beginDrag(event: React.PointerEvent, kind: MovableKind, item: { id: string; x: number; y: number }) {
    if ((event.target as HTMLElement).closest("input,textarea,button,[contenteditable=true]")) return;
    const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return;
    drag.current = { kind, id: item.id, offsetX: (event.clientX - rect.left) * W / rect.width - item.x, offsetY: (event.clientY - rect.top) * H / rect.height - item.y };
    setSelected({ kind, id: item.id }); event.currentTarget.setPointerCapture(event.pointerId);
  }
  function beginResize(event: React.PointerEvent, kind: "text-resize" | "lines-resize", item: { id: string; width: number; height?: number }) {
    event.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return;
    drag.current = { kind, id: item.id, offsetX: (event.clientX - rect.left) * W / rect.width - item.width, offsetY: (event.clientY - rect.top) * H / rect.height - (item.height ?? 0) };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDrag(event: React.PointerEvent) {
    const state = drag.current; const rect = canvasRef.current?.getBoundingClientRect(); if (!state || !rect) return;
    let x = (event.clientX - rect.left) * W / rect.width - state.offsetX;
    let y = (event.clientY - rect.top) * H / rect.height - state.offsetY;
    if (state.kind === "text-resize") { setTextBoxes((items) => items.map((item) => item.id === state.id ? { ...item, width: clamp(x, 80, W - item.x), height: clamp(y, 32, H - item.y) } : item)); return; }
    if (state.kind === "lines-resize") { setAnswerLines((items) => items.map((item) => item.id === state.id ? { ...item, width: clamp(x, 80, W - item.x) } : item)); return; }
    if ((state.kind === "text" || state.kind === "badge" || state.kind === "lines") && !event.altKey) {
      const xCandidates = [activePage?.margins.left ?? 0];
      const yCandidates = [activePage?.margins.top ?? 0];
      if (state.kind === "text" || state.kind === "lines") {
        textBoxes.filter((item) => item.pageId === activePageId && item.id !== state.id).forEach((item) => { xCandidates.push(item.x); yCandidates.push(item.y); });
        answerLines.filter((item) => item.pageId === activePageId && item.id !== state.id).forEach((item) => { xCandidates.push(item.x); yCandidates.push(item.y); });
        badges.filter((item) => item.pageId === activePageId).forEach((item) => xCandidates.push(item.x + 16));
      } else {
        badges.filter((item) => item.pageId === activePageId && item.id !== state.id).forEach((item) => { xCandidates.push(item.x, item.x + 16); yCandidates.push(item.y, item.y + 16); });
      }
      const movingX = state.kind === "badge" ? [{ value: x, offset: 0 }, { value: x + 16, offset: 16 }] : [{ value: x, offset: 0 }];
      const movingY = state.kind === "badge" ? [{ value: y, offset: 0 }, { value: y + 16, offset: 16 }] : [{ value: y, offset: 0 }];
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
  }
  function endDrag() { drag.current = null; setAlignmentGuides({}); }
  function removeSelected() {
    if (!selected) return;
    if (selected.kind === "text") setTextBoxes((items) => items.filter((item) => item.id !== selected.id));
    if (selected.kind === "score") setScoreBoxes((items) => items.filter((item) => item.id !== selected.id));
    if (selected.kind === "table") setTables((items) => items.filter((item) => item.id !== selected.id));
    if (selected.kind === "badge") setBadges((items) => items.filter((item) => item.id !== selected.id));
    if (selected.kind === "lines") setAnswerLines((items) => items.filter((item) => item.id !== selected.id));
    setSelected(null);
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
      tags: initialSentence?.tags ?? [], corrections: [], assignedGroupIds: initialSentence?.assignedGroupIds ?? [], competitionEnabled: initialSentence?.competitionEnabled ?? false,
      assignmentStatusByGroup: initialSentence?.assignmentStatusByGroup ?? {}, assignmentProgressByGroup: initialSentence?.assignmentProgressByGroup ?? {},
      treeAnalysisDocumentPages: pages, treeAnalysisTextBoxes: textBoxes, treeAnalysisScoreBoxes: scoreBoxes, treeAnalysisTables: tables, treeAnalysisQuestionBadges: badges,
      worksheetAnswerLines: answerLines, worksheetReaderOrder: (() => { const all = [...answerLines.map((item) => `lines:${item.id}`), ...tables.filter((table) => table.cells.some((cell) => cell.isCorrect)).map((table) => `table:${table.id}`)]; return [...readerOrder.filter((id) => all.includes(id)), ...all.filter((id) => !readerOrder.includes(id))]; })(),
      createdAt: initialSentence?.createdAt ?? now, updatedAt: now
    });
  }

  const selectedText = selected?.kind === "text" ? textBoxes.find((item) => item.id === selected.id) : undefined;
  const selectedLines = selected?.kind === "lines" ? answerLines.find((item) => item.id === selected.id) : undefined;
  const selectedTable = selected?.kind === "table" ? tables.find((item) => item.id === selected.id) : undefined;

  return <div className="worksheet-editor tree-analysis-editor">
    <Card className="tree-analysis-builder-card">
      <div className="tree-analysis-builder-heading"><div><span className="eyebrow">Nouveau type d’activité</span><h2>Feuille d’activité</h2><p>Compose une feuille Lettre en portrait. Les lignes de réponse deviennent interactives dans le lecteur.</p></div><div className="tree-analysis-builder-tools"><Button type="button" variant="secondary" onClick={() => setPrintMode("student")} aria-pressed={printMode === "student"}>Aperçu élève</Button><Button type="button" variant="secondary" onClick={() => setPrintMode("answer")} aria-pressed={printMode === "answer"}><Check size={17}/> Corrigé</Button><Button type="button" variant="secondary" onClick={() => window.print()}><Printer size={17}/> Imprimer</Button><Button type="button" onClick={save}><Save size={17}/> Enregistrer</Button></div></div>
      <div className="tree-analysis-builder-meta"><label>Titre<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Niveau<select value={levelId} onChange={(event) => setLevelId(event.target.value)}>{levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></label><label>Difficulté<select value={difficulty} onChange={(event) => setDifficulty(event.target.value as SentenceDifficulty)}>{Object.entries(difficultyLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      <div className="tree-analysis-page-controls"><div>{pages.map((page,index) => <button key={page.id} type="button" className={page.id === activePageId ? "active" : ""} onClick={() => setActivePageId(page.id)}>Page {index + 1}</button>)}<button type="button" onClick={addPage}><Plus size={15}/> Page</button></div><strong>Lettre — portrait</strong>{(["top","right","bottom","left"] as const).map((side) => <label key={side}>Marge {side}<input type="number" value={activePage?.margins[side] ?? 0} onChange={(event) => updatePage({ margins: { ...activePage.margins, [side]: Number(event.target.value) } })}/></label>)}</div>
      <div className="tree-analysis-quick-add"><span>Ajouter à la page</span><Button type="button" onClick={addText}><span className="tree-analysis-add-icon">T</span> Texte</Button><Button type="button" variant="secondary" onClick={addScore}><span className="tree-analysis-add-icon">/x</span> Points</Button><Button type="button" variant="secondary" onClick={addTable}><Grid3X3 size={17}/> Tableau</Button><Button type="button" variant="secondary" onClick={addBadge}><span className="tree-analysis-add-icon">1</span> Numéro</Button><Button type="button" variant="secondary" onClick={addLines}><span className="tree-analysis-add-icon">━</span> Lignes de réponse</Button>{selected && <Button type="button" variant="secondary" onClick={removeSelected}><X size={16}/> Supprimer</Button>}</div>
      <div className="tree-analysis-document-header-controls"><label>Type d’activité<input value={activePage.header?.activityType ?? "EXERCICES"} onChange={(event) => updatePage({ header: { ...activePage.header!, activityType: event.target.value } })}/></label><label>Titre dans l’entête<input value={activePage.header?.activityTitle ?? title} onChange={(event) => updatePage({ header: { ...activePage.header!, activityTitle: event.target.value } })}/></label><label className="tree-analysis-main-title-toggle"><input type="checkbox" checked={activePage.mainTitle?.enabled ?? true} onChange={(event) => updatePage({ mainTitle: { ...(activePage.mainTitle ?? { prefix:"Exercices", title:"Feuille d’activité", subtitle:"Activité" }), enabled:event.target.checked } })}/> Afficher le grand bandeau</label>{activePage.mainTitle?.enabled && <><label>Première partie<input value={activePage.mainTitle.prefix} onChange={(event) => updatePage({ mainTitle:{...activePage.mainTitle!,prefix:event.target.value} })}/></label><label>Deuxième partie<input value={activePage.mainTitle.title} onChange={(event) => updatePage({ mainTitle:{...activePage.mainTitle!,title:event.target.value} })}/></label><label>Barre noire<input value={activePage.mainTitle.subtitle ?? ""} onChange={(event) => updatePage({ mainTitle:{...activePage.mainTitle!,subtitle:event.target.value} })}/></label></>}</div>
      {selectedText && <div className="tree-analysis-text-toolbar"><label>Taille<input type="number" min="10" max="72" value={selectedText.fontSize} onChange={(event) => setTextBoxes((items) => items.map((item) => item.id === selectedText.id ? {...item,fontSize:Number(event.target.value)} : item))}/></label><button type="button" onClick={() => setTextBoxes((items) => items.map((item) => item.id === selectedText.id ? {...item,textAlign:"left"} : item))}><AlignLeft size={17}/></button><button type="button" onClick={() => setTextBoxes((items) => items.map((item) => item.id === selectedText.id ? {...item,textAlign:"center"} : item))}><AlignCenter size={17}/></button><button type="button" onClick={() => setTextBoxes((items) => items.map((item) => item.id === selectedText.id ? {...item,textAlign:"justify"} : item))}><AlignJustify size={17}/></button><label>Largeur<input type="number" value={selectedText.width} onChange={(event) => setTextBoxes((items) => items.map((item) => item.id === selectedText.id ? {...item,width:Number(event.target.value)} : item))}/></label><label>Hauteur<input type="number" value={selectedText.height} onChange={(event) => setTextBoxes((items) => items.map((item) => item.id === selectedText.id ? {...item,height:Number(event.target.value)} : item))}/></label></div>}
      {selectedLines && <div className="worksheet-lines-toolbar"><label>Nombre de lignes<input type="number" min="1" max="12" value={selectedLines.lineCount} onChange={(event) => setAnswerLines((items) => items.map((item) => item.id === selectedLines.id ? {...item,lineCount:Number(event.target.value)} : item))}/></label><label>Interligne<input type="number" min="18" max="56" value={selectedLines.lineSpacing} onChange={(event) => setAnswerLines((items) => items.map((item) => item.id === selectedLines.id ? {...item,lineSpacing:Number(event.target.value)} : item))}/></label><label>Largeur<input type="number" min="180" max="900" value={selectedLines.width} onChange={(event) => setAnswerLines((items) => items.map((item) => item.id === selectedLines.id ? {...item,width:Number(event.target.value)} : item))}/></label><label>Taille de la réponse<input type="number" min="10" max="32" value={selectedLines.answerFontSize} onChange={(event) => setAnswerLines((items) => items.map((item) => item.id === selectedLines.id ? {...item,answerFontSize:Number(event.target.value)} : item))}/></label><label className="worksheet-answer-field">Réponse du corrigé<textarea value={selectedLines.answer} onChange={(event) => setAnswerLines((items) => items.map((item) => item.id === selectedLines.id ? {...item,answer:event.target.value} : item))}/></label></div>}
      {selectedTable && <div className="tree-analysis-text-toolbar worksheet-table-toolbar">{!(selectedTable.cells[0]?.columnSpan && selectedTable.cells[0].columnSpan > 1) && <Button type="button" variant="secondary" onClick={() => setTables((items) => items.map((table) => table.id === selectedTable.id ? { ...table, cells: table.cells.map((cell, index) => index === 0 ? { ...cell, columnSpan: table.columns } : index < table.columns ? { ...cell, columnSpan: 0 } : cell) } : table))}>Fusionner la 1re rangée</Button>}<span>Clique sur le cercle d’une cellule pour l’identifier comme bonne réponse.</span></div>}
      <div className={`tree-analysis-workspace tree-print-${printMode}`}><div className="tree-analysis-page-shell builder"><div ref={canvasRef} className="tree-analysis-page tree-analysis-canvas portrait document-template worksheet-canvas" style={{"--page-margin-top":`${activePage.margins.top/H*100}%`,"--page-margin-right":`${activePage.margins.right/W*100}%`,"--page-margin-bottom":`${activePage.margins.bottom/H*100}%`,"--page-margin-left":`${activePage.margins.left/W*100}%`} as React.CSSProperties} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onClick={(event) => { if(event.target === event.currentTarget) setSelected(null); }}>
        {alignmentGuides.x !== undefined && <div className="tree-analysis-alignment-guide vertical" style={{left:`${alignmentGuides.x/W*100}%`}}/>}
        {alignmentGuides.y !== undefined && <div className="tree-analysis-alignment-guide horizontal" style={{top:`${alignmentGuides.y/H*100}%`}}/>}
        <div className="tree-analysis-document-header" style={{left:`${activePage.margins.left/W*100}%`,right:`${activePage.margins.right/W*100}%`,top:`${(activePage.header?.nameY ?? 25)/H*100}%`}}><div className="tree-analysis-document-header-top"><div className="tree-analysis-student-fields"><span>NOM</span><span>GROUPE</span></div><div className="tree-analysis-page-cell"><div className="tree-analysis-page-badge">{pages.findIndex((page) => page.id === activePageId)+1}</div></div></div><div className="tree-analysis-document-header-bottom"><div>{activePage.header?.activityType || "EXERCICES"}</div><div>{activePage.header?.activityTitle || title || "Feuille d’activité"}</div></div></div>
        {(activePage.mainTitle?.enabled ?? true) && <div className="tree-analysis-document-title-banner" style={{left:`${(activePage.margins.left-53)/W*100}%`,right:`${(activePage.margins.right-53)/W*100}%`,top:`${82/H*100}%`}}><div className="tree-analysis-document-title-line">{activePage.mainTitle?.prefix} <span>–</span> {activePage.mainTitle?.title}</div><div className="tree-analysis-document-title-label">{activePage.mainTitle?.subtitle}</div></div>}
        {badges.filter((item) => item.pageId === activePageId).map((item) => <div key={item.id} className="tree-analysis-question-badge" style={{left:`${item.x/W*100}%`,top:`${item.y/H*100}%`}} onPointerDown={(event) => beginDrag(event,"badge",item)} onDoubleClick={() => { const value=window.prompt("Numéro",String(item.number)); if(value) setBadges((items)=>items.map((badge)=>badge.id===item.id?{...badge,number:Number(value)}:badge)); }}><span>{item.number}</span><button type="button" aria-label="Supprimer le numéro" onClick={(event)=>{event.stopPropagation();setBadges((items)=>items.filter((badge)=>badge.id!==item.id));if(selected?.id===item.id)setSelected(null);}}><X size={10}/></button></div>)}
        {textBoxes.filter((item) => item.pageId === activePageId).map((item) => <div key={item.id} className={`tree-analysis-text-box ${selected?.kind === "text" && selected.id === item.id ? "selected" : ""}`} style={{left:`${item.x/W*100}%`,top:`${item.y/H*100}%`,width:`${item.width/W*100}%`,minHeight:`${item.height/H*100}%`,fontSize:`${item.fontSize/W*100}cqw`,textAlign:item.textAlign}} onClick={() => setSelected({kind:"text",id:item.id})}>{selected?.kind==="text"&&selected.id===item.id&&<><button type="button" className="tree-analysis-text-delete" aria-label="Supprimer la boîte" onClick={(event)=>{event.stopPropagation();setTextBoxes((items)=>items.filter((box)=>box.id!==item.id));setSelected(null);}}><X size={14}/></button><span className="tree-analysis-text-resize" onPointerDown={(event)=>beginResize(event,"text-resize",item)}/><span className="tree-analysis-text-move-handle" title="Glisser pour déplacer" onPointerDown={(event)=>{event.stopPropagation();beginDrag(event,"text",item);}}/></>}<div className="tree-analysis-text-content" contentEditable suppressContentEditableWarning spellCheck onPointerDown={(event)=>{event.stopPropagation();setSelected({kind:"text",id:item.id});}} onInput={(event) => setTextBoxes((items) => items.map((box) => box.id === item.id ? {...box,text:event.currentTarget.innerText} : box))}>{item.text}</div></div>)}
        {scoreBoxes.filter((item) => (item.pageId ?? pages[0]?.id) === activePageId).map((item) => <div key={item.id} className="tree-analysis-score-box" style={{left:`${item.x/W*100}%`,top:`${item.y/H*100}%`}} onPointerDown={(event) => beginDrag(event,"score",item)} onDoubleClick={() => { const total=window.prompt("Total de points",String(item.total)); if(total===null)return; const earned=window.prompt("Points obtenus dans le corrigé (vide pour laisser une ligne)",item.earned===undefined?"":String(item.earned)); setScoreBoxes((items)=>items.map((box)=>box.id===item.id?{...box,total:Math.max(1,Number(total)||1),earned:earned?.trim()?Number(earned):undefined}:box)); }}><span>{item.earned ?? "___"} / {item.total}</span></div>)}
        {tables.filter((item) => (item.pageId ?? pages[0]?.id) === activePageId).map((table) => <div key={table.id} className={`tree-analysis-activity-table ${selected?.kind === "table" && selected.id === table.id ? "selected" : ""}`} style={{left:`${table.x/W*100}%`,top:`${table.y/H*100}%`,gridTemplateColumns:`repeat(${table.columns},minmax(0,1fr))`}} onPointerDown={(event) => beginDrag(event,"table",table)} onClick={() => setSelected({kind:"table",id:table.id})}>{table.cells.map((cell,index) => cell.columnSpan===0?null:<div key={index} className={`tree-analysis-table-cell ${cell.isCorrect?"correct":""}`} style={{gridColumn:cell.columnSpan&&cell.columnSpan>1?`span ${cell.columnSpan}`:undefined}}><textarea value={cell.text} onChange={(event) => setTables((items) => items.map((item) => item.id===table.id?{...item,cells:item.cells.map((candidate,i)=>i===index?{...candidate,text:event.target.value}:candidate)}:item))}/><button type="button" className="tree-analysis-correct-cell" onClick={() => setTables((items) => items.map((item) => item.id===table.id?{...item,cells:item.cells.map((candidate,i)=>i===index?{...candidate,isCorrect:!candidate.isCorrect}:candidate)}:item))}>{cell.isCorrect?"✓":"○"}</button></div>)}{selected?.kind==="table"&&selected.id===table.id&&<button type="button" className="tree-analysis-delete-table" aria-label="Supprimer le tableau" onClick={(event)=>{event.stopPropagation();setTables((items)=>items.filter((item)=>item.id!==table.id));setSelected(null);}}><X size={13}/></button>}</div>)}
        {answerLines.filter((item) => item.pageId === activePageId).map((item) => <div key={item.id} className={`worksheet-answer-lines ${selected?.kind === "lines" && selected.id === item.id ? "selected" : ""}`} style={{left:`${item.x/W*100}%`,top:`${item.y/H*100}%`,width:`${item.width/W*100}%`,height:`${item.lineCount*item.lineSpacing/H*100}%`}} onPointerDown={(event) => beginDrag(event,"lines",item)} onClick={() => setSelected({kind:"lines",id:item.id})}>{Array.from({length:item.lineCount},(_,index)=><span key={index} style={{top:`${(index+1)/item.lineCount*100}%`}}/>)}{printMode==="answer"&&<div className="worksheet-answer-copy" style={{fontSize:`${item.answerFontSize/W*100}cqw`,lineHeight:item.lineSpacing/item.answerFontSize}}>{item.answer}</div>}{selected?.kind==="lines"&&selected.id===item.id&&<><button type="button" className="tree-analysis-text-delete worksheet-lines-delete" aria-label="Supprimer les lignes" onClick={(event)=>{event.stopPropagation();setAnswerLines((items)=>items.filter((line)=>line.id!==item.id));setSelected(null);}}><X size={14}/></button><span className="tree-analysis-text-resize worksheet-lines-resize" onPointerDown={(event)=>beginResize(event,"lines-resize",item)}/></>}</div>)}
      </div></div></div>
    </Card>
    <Card className="tree-analysis-flow-panel worksheet-flow-panel"><div><span className="eyebrow">Déroulement du lecteur</span><h3>Ordre de révélation</h3></div><p>Les lignes de réponse et les tableaux corrigés deviennent des étapes. Elles seront présentées dans cet ordre.</p><div className="tree-analysis-phase-list">{pageSteps.map((id,index) => <div className="tree-analysis-phase" key={id}><div className="tree-analysis-phase-heading"><span>{index+1}</span><strong>{id.startsWith("lines:")?"Afficher une réponse sur les lignes":"Répondre au tableau"}</strong><button type="button" onClick={() => moveStep(id,-1)} disabled={index===0}><ArrowUp size={15}/></button><button type="button" onClick={() => moveStep(id,1)} disabled={index===pageSteps.length-1}><ArrowDown size={15}/></button></div></div>)}</div>{!pageSteps.length&&<p>Ajoute des lignes de réponse ou marque une bonne cellule dans un tableau.</p>}</Card>
  </div>;
}
