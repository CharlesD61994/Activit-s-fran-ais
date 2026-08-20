"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AlignCenter, AlignJustify, AlignLeft, ArrowDown, ArrowUp, Check, Grid3X3, Merge, Plus, Printer, Save, Split, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SchoolLevel, Sentence, SentenceDifficulty, TreeAnalysisDocumentPage, TreeAnalysisQuestionBadge, TreeAnalysisScoreBox, TreeAnalysisTable, TreeAnalysisTextBox, WorksheetAnswerLines, WorksheetDimensionBand, WorksheetTableCellRole } from "@/types";
import { createWorksheetTable, isFixedWorksheetTable, normalizedColumnWidths, normalizedRowHeights, tableHasInteraction, tableTemplateLabel, worksheetTableWidth, type WorksheetTableTemplate } from "@/lib/worksheet-tables";
import { worksheetDimensionAsset } from "@/lib/worksheet-dimensions";

type Props = { initialSentence?: Sentence; levels: SchoolLevel[]; onSave: (sentence: Sentence) => void };
type MovableKind = "text" | "score" | "table" | "badge" | "lines" | "band";
type DragKind = MovableKind | "text-resize" | "lines-resize" | "score-resize" | "table-resize";
type DragState = { kind: DragKind; id: string; offsetX: number; offsetY: number } | null;
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
  const [dimensionBands, setDimensionBands] = useState<WorksheetDimensionBand[]>(initialSentence?.worksheetDimensionBands ?? []);
  const [readerOrder, setReaderOrder] = useState<string[]>(initialSentence?.worksheetReaderOrder ?? []);
  const [selected, setSelected] = useState<{ kind: MovableKind; id: string } | null>(null);
  const [alignmentGuides, setAlignmentGuides] = useState<{ x?: number; y?: number }>({});
  const [printMode, setPrintMode] = useState<"student" | "answer">("student");
  const [tableDialog, setTableDialog] = useState<TableDialogState | null>(null);
  const [selectedCells, setSelectedCells] = useState<number[]>([]);
  const drag = useRef<DragState>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const activePage = pages.find((page) => page.id === activePageId) ?? pages[0];

  const pageSteps = useMemo(() => {
    const ids = [
      ...answerLines.filter((item) => item.pageId === activePageId).map((item) => `lines:${item.id}`),
      ...tables.filter((item) => (item.pageId ?? pages[0]?.id) === activePageId && tableHasInteraction(item)).map((item) => `table:${item.id}`)
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
    const item: WorksheetAnswerLines = { id: crypto.randomUUID(), pageId: activePageId, x: 150, y: 300, width: 760, lineCount: 2, lineSpacing: 20, answer: "", answerFontSize: 18 };
    setAnswerLines((current) => [...current, item]); setSelected({ kind: "lines", id: item.id });
  }
  function addDimensionBand() {
    const dimension = (window.prompt("Dimension de la lecture", "Compréhension") ?? "Compréhension").trim();
    const normalized = (["Compréhension", "Interprétation", "Réaction", "Appréciation"] as const).find((item) => item.toLocaleLowerCase("fr") === dimension.toLocaleLowerCase("fr")) ?? "Compréhension";
    const dimensions = worksheetDimensionAsset(normalized);
    const item: WorksheetDimensionBand = { id: crypto.randomUUID(), pageId: activePageId, x: 150, y: 280, width: dimensions.width, height: dimensions.height, dimension: normalized };
    setDimensionBands((current) => [...current, item]);
    setSelected({ kind: "band", id: item.id });
  }

  function beginDrag(event: React.PointerEvent, kind: MovableKind, item: { id: string; x: number; y: number }) {
    if ((event.target as HTMLElement).closest("input,textarea,button,[contenteditable=true]")) return;
    const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return;
    drag.current = { kind, id: item.id, offsetX: (event.clientX - rect.left) * W / rect.width - item.x, offsetY: (event.clientY - rect.top) * H / rect.height - item.y };
    setSelected({ kind, id: item.id }); event.currentTarget.setPointerCapture(event.pointerId);
  }
  function beginResize(event: React.PointerEvent, kind: "text-resize" | "lines-resize" | "score-resize" | "table-resize", item: { id: string; width: number; height?: number }) {
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
    if (state.kind === "score-resize") { setScoreBoxes((items) => items.map((item) => item.id === state.id ? { ...item, width: clamp(x, 54, W - item.x), height: clamp(y, 28, 100) } : item)); return; }
    if (state.kind === "table-resize") {
      setTables((items) => items.map((item) => {
        if (item.id !== state.id || isFixedWorksheetTable(item)) return item;
        const width = clamp(x, 160, W - item.x);
        const totalHeight = clamp(y, item.rows * 30, H - item.y);
        return { ...item, width, columnWidths: normalizedColumnWidths(item).map((value) => value / (item.width ?? 360) * width), rowHeights: Array(item.rows).fill(totalHeight / item.rows) };
      }));
      return;
    }
    if ((state.kind === "text" || state.kind === "badge" || state.kind === "lines") && !event.altKey) {
      const xCandidates = [activePage?.margins.left ?? 0];
      const yCandidates = [activePage?.margins.top ?? 0];
      if (state.kind === "text" || state.kind === "lines") {
        textBoxes.filter((item) => item.pageId === activePageId && item.id !== state.id).forEach((item) => { xCandidates.push(item.x); yCandidates.push(item.y); });
        answerLines.filter((item) => item.pageId === activePageId && item.id !== state.id).forEach((item) => { xCandidates.push(item.x); yCandidates.push(item.y + item.lineSpacing); });
        badges.filter((item) => item.pageId === activePageId).forEach((item) => xCandidates.push(item.x + 16));
      } else {
        badges.filter((item) => item.pageId === activePageId && item.id !== state.id).forEach((item) => { xCandidates.push(item.x, item.x + 16); yCandidates.push(item.y, item.y + 16); });
      }
      const movingX = state.kind === "badge" ? [{ value: x, offset: 0 }, { value: x + 16, offset: 16 }] : [{ value: x, offset: 0 }];
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
    if (state.kind === "band") setDimensionBands((items) => items.map((item) => item.id === state.id ? { ...item, x, y } : item));
  }
  function endDrag() { drag.current = null; setAlignmentGuides({}); }
  function removeSelected() {
    if (!selected) return;
    if (selected.kind === "text") setTextBoxes((items) => items.filter((item) => item.id !== selected.id));
    if (selected.kind === "score") setScoreBoxes((items) => items.filter((item) => item.id !== selected.id));
    if (selected.kind === "table") setTables((items) => items.filter((item) => item.id !== selected.id));
    if (selected.kind === "badge") setBadges((items) => items.filter((item) => item.id !== selected.id));
    if (selected.kind === "lines") setAnswerLines((items) => items.filter((item) => item.id !== selected.id));
    if (selected.kind === "band") setDimensionBands((items) => items.filter((item) => item.id !== selected.id));
    setSelected(null);
  }

  function updateSelectedTable(patch: Partial<TreeAnalysisTable>) {
    if (!selected || selected.kind !== "table") return;
    setTables((items) => items.map((item) => item.id === selected.id ? { ...item, ...patch } : item));
  }

  function updateSelectedCells(patch: Partial<TreeAnalysisTable["cells"][number]>) {
    if (!selected || selected.kind !== "table" || !selectedCells.length) return;
    setTables((items) => items.map((table) => table.id === selected.id ? { ...table, cells: table.cells.map((cell, index) => selectedCells.includes(index) ? { ...cell, ...patch } : cell) } : table));
  }

  function selectTableCell(index: number, extend: boolean) {
    setSelectedCells((current) => {
      if (!extend || !current.length) return [index];
      const table = tables.find((item) => item.id === selected?.id);
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
      tags: initialSentence?.tags ?? [], corrections: [], assignedGroupIds: initialSentence?.assignedGroupIds ?? [], competitionEnabled: initialSentence?.competitionEnabled ?? false,
      assignmentStatusByGroup: initialSentence?.assignmentStatusByGroup ?? {}, assignmentProgressByGroup: initialSentence?.assignmentProgressByGroup ?? {},
      treeAnalysisDocumentPages: pages, treeAnalysisTextBoxes: textBoxes, treeAnalysisScoreBoxes: scoreBoxes, treeAnalysisTables: tables, treeAnalysisQuestionBadges: badges,
      worksheetAnswerLines: answerLines, worksheetDimensionBands: dimensionBands, worksheetReaderOrder: (() => { const all = [...answerLines.map((item) => `lines:${item.id}`), ...tables.filter(tableHasInteraction).map((table) => `table:${table.id}`)]; return [...readerOrder.filter((id) => all.includes(id)), ...all.filter((id) => !readerOrder.includes(id))]; })(),
      createdAt: initialSentence?.createdAt ?? now, updatedAt: now
    });
  }

  const selectedText = selected?.kind === "text" ? textBoxes.find((item) => item.id === selected.id) : undefined;
  const selectedLines = selected?.kind === "lines" ? answerLines.find((item) => item.id === selected.id) : undefined;
  const selectedTable = selected?.kind === "table" ? tables.find((item) => item.id === selected.id) : undefined;
  const selectedScore = selected?.kind === "score" ? scoreBoxes.find((item) => item.id === selected.id) : undefined;
  const selectedBand = selected?.kind === "band" ? dimensionBands.find((item) => item.id === selected.id) : undefined;

  return <div className="worksheet-editor tree-analysis-editor">
    <Card className="tree-analysis-builder-card">
      <div className="tree-analysis-builder-heading"><div><span className="eyebrow">Nouveau type d’activité</span><h2>Feuille d’activité</h2><p>Compose une feuille Lettre en portrait. Les lignes de réponse deviennent interactives dans le lecteur.</p></div><div className="tree-analysis-builder-tools"><Button type="button" variant="secondary" onClick={() => setPrintMode("student")} aria-pressed={printMode === "student"}>Aperçu élève</Button><Button type="button" variant="secondary" onClick={() => setPrintMode("answer")} aria-pressed={printMode === "answer"}><Check size={17}/> Corrigé</Button><Button type="button" variant="secondary" onClick={() => window.print()}><Printer size={17}/> Imprimer</Button><Button type="button" onClick={save}><Save size={17}/> Enregistrer</Button></div></div>
      <div className="tree-analysis-builder-meta"><label>Titre<input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Niveau<select value={levelId} onChange={(event) => setLevelId(event.target.value)}>{levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></label><label>Difficulté<select value={difficulty} onChange={(event) => setDifficulty(event.target.value as SentenceDifficulty)}>{Object.entries(difficultyLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      <div className="tree-analysis-page-controls"><div>{pages.map((page,index) => <button key={page.id} type="button" className={page.id === activePageId ? "active" : ""} onClick={() => setActivePageId(page.id)}>Page {index + 1}</button>)}<button type="button" onClick={addPage}><Plus size={15}/> Page</button></div><strong>Lettre — portrait</strong>{(["top","right","bottom","left"] as const).map((side) => <label key={side}>Marge {side}<input type="number" value={activePage?.margins[side] ?? 0} onChange={(event) => updatePage({ margins: { ...activePage.margins, [side]: Number(event.target.value) } })}/></label>)}</div>
      <div className="tree-analysis-quick-add"><span>Ajouter à la page</span><Button type="button" onClick={addText}><span className="tree-analysis-add-icon">T</span> Texte</Button><Button type="button" variant="secondary" onClick={addScore}><span className="tree-analysis-add-icon">/x</span> Points</Button><Button type="button" variant="secondary" onClick={openTableDialog}><Grid3X3 size={17}/> Tableau</Button><Button type="button" variant="secondary" onClick={addBadge}><span className="tree-analysis-add-icon">1</span> Numéro</Button><Button type="button" variant="secondary" onClick={addLines}><span className="tree-analysis-add-icon">━</span> Lignes de réponse</Button><Button type="button" variant="secondary" onClick={addDimensionBand}><span className="tree-analysis-add-icon worksheet-band-icon">C</span> Bandeau de lecture</Button>{selected && <Button type="button" variant="secondary" onClick={removeSelected}><X size={16}/> Supprimer</Button>}</div>
      <div className="tree-analysis-document-header-controls"><label>Type d’activité<input value={activePage.header?.activityType ?? "EXERCICES"} onChange={(event) => updatePage({ header: { ...activePage.header!, activityType: event.target.value } })}/></label><label>Titre dans l’entête<input value={activePage.header?.activityTitle ?? title} onChange={(event) => updatePage({ header: { ...activePage.header!, activityTitle: event.target.value } })}/></label><label className="tree-analysis-main-title-toggle"><input type="checkbox" checked={activePage.mainTitle?.enabled ?? true} onChange={(event) => updatePage({ mainTitle: { ...(activePage.mainTitle ?? { prefix:"Exercices", title:"Feuille d’activité", subtitle:"Activité" }), enabled:event.target.checked } })}/> Afficher le grand bandeau</label>{activePage.mainTitle?.enabled && <><label>Première partie<input value={activePage.mainTitle.prefix} onChange={(event) => updatePage({ mainTitle:{...activePage.mainTitle!,prefix:event.target.value} })}/></label><label>Deuxième partie<input value={activePage.mainTitle.title} onChange={(event) => updatePage({ mainTitle:{...activePage.mainTitle!,title:event.target.value} })}/></label><label>Barre noire<input value={activePage.mainTitle.subtitle ?? ""} onChange={(event) => updatePage({ mainTitle:{...activePage.mainTitle!,subtitle:event.target.value} })}/></label></>}</div>
      {selectedText && <div className="tree-analysis-text-toolbar"><label>Taille<input type="number" min="10" max="72" value={selectedText.fontSize} onChange={(event) => setTextBoxes((items) => items.map((item) => item.id === selectedText.id ? {...item,fontSize:Number(event.target.value)} : item))}/></label><button type="button" onClick={() => setTextBoxes((items) => items.map((item) => item.id === selectedText.id ? {...item,textAlign:"left"} : item))}><AlignLeft size={17}/></button><button type="button" onClick={() => setTextBoxes((items) => items.map((item) => item.id === selectedText.id ? {...item,textAlign:"center"} : item))}><AlignCenter size={17}/></button><button type="button" onClick={() => setTextBoxes((items) => items.map((item) => item.id === selectedText.id ? {...item,textAlign:"justify"} : item))}><AlignJustify size={17}/></button><label>Largeur<input type="number" value={selectedText.width} onChange={(event) => setTextBoxes((items) => items.map((item) => item.id === selectedText.id ? {...item,width:Number(event.target.value)} : item))}/></label><label>Hauteur<input type="number" value={selectedText.height} onChange={(event) => setTextBoxes((items) => items.map((item) => item.id === selectedText.id ? {...item,height:Number(event.target.value)} : item))}/></label></div>}
      {selectedLines && <div className="worksheet-lines-toolbar"><label>Nombre de lignes<input type="number" min="1" max="12" value={selectedLines.lineCount} onChange={(event) => setAnswerLines((items) => items.map((item) => item.id === selectedLines.id ? {...item,lineCount:Number(event.target.value)} : item))}/></label><label>Interligne<input type="number" min="18" max="56" value={selectedLines.lineSpacing} onChange={(event) => setAnswerLines((items) => items.map((item) => item.id === selectedLines.id ? {...item,lineSpacing:Number(event.target.value)} : item))}/></label><label>Largeur<input type="number" min="80" max="900" value={selectedLines.width} onChange={(event) => setAnswerLines((items) => items.map((item) => item.id === selectedLines.id ? {...item,width:clamp(Number(event.target.value),80,900)} : item))}/></label><label>Taille de la réponse<input type="number" min="10" max="32" value={selectedLines.answerFontSize} onChange={(event) => setAnswerLines((items) => items.map((item) => item.id === selectedLines.id ? {...item,answerFontSize:Number(event.target.value)} : item))}/></label><label className="worksheet-answer-field">Réponse du corrigé<textarea value={selectedLines.answer} onChange={(event) => setAnswerLines((items) => items.map((item) => item.id === selectedLines.id ? {...item,answer:event.target.value} : item))}/></label></div>}
      {selectedScore && <div className="tree-analysis-text-toolbar worksheet-score-toolbar"><label>Total<input type="number" min="1" value={selectedScore.total} onChange={(event) => setScoreBoxes((items) => items.map((item) => item.id === selectedScore.id ? {...item,total:Math.max(1,Number(event.target.value)||1)} : item))}/></label><label>Largeur<input type="number" min="54" max="400" value={selectedScore.width ?? 120} onChange={(event) => setScoreBoxes((items) => items.map((item) => item.id === selectedScore.id ? {...item,width:Number(event.target.value)} : item))}/></label><label>Hauteur<input type="number" min="28" max="100" value={selectedScore.height ?? 42} onChange={(event) => setScoreBoxes((items) => items.map((item) => item.id === selectedScore.id ? {...item,height:Number(event.target.value)} : item))}/></label></div>}
      {selectedBand && <div className="tree-analysis-text-toolbar worksheet-band-toolbar"><label>Dimension<select value={selectedBand.dimension} onChange={(event) => {const dimension=event.target.value as WorksheetDimensionBand["dimension"];const size=worksheetDimensionAsset(dimension);setDimensionBands((items) => items.map((item) => item.id === selectedBand.id ? {...item,dimension,width:size.width,height:size.height} : item));}}>{["Compréhension","Interprétation","Réaction","Appréciation"].map((item)=><option key={item}>{item}</option>)}</select></label><span>Format identique au document de référence.</span></div>}
      {selectedTable && <div className="worksheet-table-toolbar">
        <div className="worksheet-table-toolbar-row"><strong>{tableTemplateLabel(selectedTable.kind ?? "free")}</strong>{isFixedWorksheetTable(selectedTable)?<span>Dimensions fixes du document de référence. Le contenu demeure modifiable.</span>:<><label>Largeur<input type="number" min="160" max="900" value={Math.round(selectedTable.width ?? 360)} onChange={(event) => {const width=Number(event.target.value);updateSelectedTable({width,columnWidths:normalizedColumnWidths(selectedTable).map((value)=>value/(selectedTable.width??360)*width)});}}/></label><Button type="button" variant="secondary" onClick={()=>resizeSelectedTableGrid(selectedTable.rows+1,selectedTable.columns)}>+ Rangée</Button><Button type="button" variant="secondary" disabled={selectedTable.rows<=1} onClick={()=>resizeSelectedTableGrid(selectedTable.rows-1,selectedTable.columns)}>− Rangée</Button><Button type="button" variant="secondary" onClick={()=>resizeSelectedTableGrid(selectedTable.rows,selectedTable.columns+1)}>+ Colonne</Button><Button type="button" variant="secondary" disabled={selectedTable.columns<=1} onClick={()=>resizeSelectedTableGrid(selectedTable.rows,selectedTable.columns-1)}>− Colonne</Button><Button type="button" variant="secondary" onClick={()=>updateSelectedTable({columnWidths:Array(selectedTable.columns).fill((selectedTable.width??360)/selectedTable.columns)})}>Égaliser les colonnes</Button><Button type="button" variant="secondary" onClick={()=>updateSelectedTable({rowHeights:Array(selectedTable.rows).fill(normalizedRowHeights(selectedTable).reduce((sum,value)=>sum+value,0)/selectedTable.rows)})}>Égaliser les rangées</Button><Button type="button" variant="secondary" disabled={selectedCells.length<2} onClick={mergeSelectedCells}><Merge size={16}/> Fusionner</Button><Button type="button" variant="secondary" disabled={selectedCells.length!==1} onClick={splitSelectedCell}><Split size={16}/> Séparer</Button><span>Sélectionne une cellule, puis Maj+clic pour sélectionner une zone.</span></>}</div>
        {!isFixedWorksheetTable(selectedTable)&&<div className="worksheet-table-dimensions">{normalizedColumnWidths(selectedTable).map((width,index)=><label key={index}>Col. {index+1}<input type="number" min="36" value={Math.round(width)} onChange={(event)=>{const widths=normalizedColumnWidths(selectedTable);widths[index]=Math.max(36,Number(event.target.value));updateSelectedTable({columnWidths:widths,width:widths.reduce((sum,value)=>sum+value,0)});}}/></label>)}{normalizedRowHeights(selectedTable).map((height,index)=><label key={`r-${index}`}>Rangée {index+1}<input type="number" min="28" value={Math.round(height)} onChange={(event)=>{const heights=normalizedRowHeights(selectedTable);heights[index]=Math.max(28,Number(event.target.value));updateSelectedTable({rowHeights:heights});}}/></label>)}</div>}
        {selectedCells.length>0&&<div className="worksheet-cell-toolbar"><label>Type<select value={selectedTable.cells[selectedCells[0]]?.role??"text"} onChange={(event)=>updateSelectedCells({role:event.target.value as WorksheetTableCellRole})}>{[["text","Texte"],["answer","Réponse à révéler"],["choice","Choix de réponse"],["order","Numéro d’ordre"],["score","Points"],["criterion","Critère"],["total","Total /x"],["header","Titre noir"]].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Fond<select value={selectedTable.cells[selectedCells[0]]?.background??"white"} onChange={(event)=>updateSelectedCells({background:event.target.value as "white"|"gray"|"black",textColor:event.target.value==="black"?"white":"black"})}><option value="white">Blanc</option><option value="gray">Gris</option><option value="black">Noir</option></select></label><label>Alignement<select value={selectedTable.cells[selectedCells[0]]?.textAlign??"center"} onChange={(event)=>updateSelectedCells({textAlign:event.target.value as "left"|"center"|"right"})}><option value="left">Gauche</option><option value="center">Centre</option><option value="right">Droite</option></select></label><label>Vertical<select value={selectedTable.cells[selectedCells[0]]?.verticalAlign??"center"} onChange={(event)=>updateSelectedCells({verticalAlign:event.target.value as "top"|"center"|"bottom"})}><option value="top">Haut</option><option value="center">Centre</option><option value="bottom">Bas</option></select></label><label>Bordure<select value={selectedTable.cells[selectedCells[0]]?.borderWidth??2} onChange={(event)=>updateSelectedCells({borderWidth:Number(event.target.value) as 0|1|2|3})}><option value="0">Aucune</option><option value="1">Fine</option><option value="2">Normale</option><option value="3">Épaisse</option></select></label><label>Taille<input type="number" min="9" max="32" value={selectedTable.cells[selectedCells[0]]?.fontSize??17} onChange={(event)=>updateSelectedCells({fontSize:Number(event.target.value)})}/></label><label className="worksheet-checkbox"><input type="checkbox" checked={selectedTable.cells[selectedCells[0]]?.bold??false} onChange={(event)=>updateSelectedCells({bold:event.target.checked})}/> Gras</label><label className="worksheet-checkbox"><input type="checkbox" checked={selectedTable.cells[selectedCells[0]]?.isCorrect??false} onChange={(event)=>updateSelectedCells({isCorrect:event.target.checked})}/> Bonne réponse</label>{["answer","order"].includes(selectedTable.cells[selectedCells[0]]?.role??"")&&<label className="worksheet-cell-answer">Réponse du corrigé<input value={selectedTable.cells[selectedCells[0]]?.answer??""} onChange={(event)=>updateSelectedCells({answer:event.target.value})}/></label>}</div>}
      </div>}
      {tableDialog&&<div className="worksheet-dialog-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)setTableDialog(null);}}><div className="worksheet-dialog" role="dialog" aria-modal="true" aria-labelledby="worksheet-table-title"><div className="worksheet-dialog-heading"><div><span className="eyebrow">Ajouter à la page</span><h3 id="worksheet-table-title">Créer un tableau pédagogique</h3></div><button type="button" onClick={()=>setTableDialog(null)} aria-label="Fermer"><X size={20}/></button></div><label>Modèle<select value={tableDialog.kind} onChange={(event)=>setTableDialog((current)=>current?{...current,kind:event.target.value as WorksheetTableTemplate}:current)}>{(["free","structured","choice","sequence","association","compact_rubric","rubric"] as WorksheetTableTemplate[]).map((kind)=><option key={kind} value={kind}>{tableTemplateLabel(kind)}</option>)}</select></label>{!["choice","compact_rubric","rubric"].includes(tableDialog.kind)&&<label>Nombre de rangées<input type="number" min="1" max="12" value={tableDialog.rows} onChange={(event)=>setTableDialog((current)=>current?{...current,rows:Number(event.target.value)}:current)}/></label>}{!["structured","sequence","association","compact_rubric"].includes(tableDialog.kind)&&<label>{tableDialog.kind==="rubric"?"Nombre de niveaux":"Nombre de colonnes"}<input type="number" min="1" max="8" value={tableDialog.columns} onChange={(event)=>setTableDialog((current)=>current?{...current,columns:Number(event.target.value)}:current)}/></label>}{["compact_rubric","rubric"].includes(tableDialog.kind)&&<><label>Dimension<select value={tableDialog.dimension} onChange={(event)=>setTableDialog((current)=>current?{...current,dimension:event.target.value as WorksheetDimensionBand["dimension"]}:current)}>{["Compréhension","Interprétation","Réaction","Appréciation"].map((item)=><option key={item}>{item}</option>)}</select></label><label>Maximum de points<input type="number" min="1" max="20" value={tableDialog.maxPoints} onChange={(event)=>setTableDialog((current)=>current?{...current,maxPoints:Number(event.target.value)}:current)}/></label></>}<p>{["compact_rubric","rubric"].includes(tableDialog.kind)?"La grille reprend les dimensions fixes du document de référence; seul son contenu est modifiable.":"Le modèle sera entièrement modifiable après son insertion."}</p><div className="worksheet-dialog-actions"><Button type="button" variant="secondary" onClick={()=>setTableDialog(null)}>Annuler</Button><Button type="button" onClick={addTable}><Grid3X3 size={17}/> Ajouter le tableau</Button></div></div></div>}
      <div className={`tree-analysis-workspace tree-print-${printMode}`}><div className="tree-analysis-page-shell builder"><div ref={canvasRef} className="tree-analysis-page tree-analysis-canvas portrait document-template worksheet-canvas" style={{"--page-margin-top":`${activePage.margins.top/H*100}%`,"--page-margin-right":`${activePage.margins.right/W*100}%`,"--page-margin-bottom":`${activePage.margins.bottom/H*100}%`,"--page-margin-left":`${activePage.margins.left/W*100}%`} as React.CSSProperties} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onClick={(event) => { if(event.target === event.currentTarget) setSelected(null); }}>
        {alignmentGuides.x !== undefined && <div className="tree-analysis-alignment-guide vertical" style={{left:`${alignmentGuides.x/W*100}%`}}/>}
        {alignmentGuides.y !== undefined && <div className="tree-analysis-alignment-guide horizontal" style={{top:`${alignmentGuides.y/H*100}%`}}/>}
        <div className="tree-analysis-document-header" style={{left:`${activePage.margins.left/W*100}%`,right:`${activePage.margins.right/W*100}%`,top:`${(activePage.header?.nameY ?? 25)/H*100}%`}}><div className="tree-analysis-document-header-top"><div className="tree-analysis-student-fields"><span>NOM</span><span>GROUPE</span></div><div className="tree-analysis-page-cell"><div className="tree-analysis-page-badge">{pages.findIndex((page) => page.id === activePageId)+1}</div></div></div><div className="tree-analysis-document-header-bottom"><div>{activePage.header?.activityType || "EXERCICES"}</div><div>{activePage.header?.activityTitle || title || "Feuille d’activité"}</div></div></div>
        {(activePage.mainTitle?.enabled ?? true) && <div className="tree-analysis-document-title-banner" style={{left:`${(activePage.margins.left-53)/W*100}%`,right:`${(activePage.margins.right-53)/W*100}%`,top:`${82/H*100}%`}}><div className="tree-analysis-document-title-line">{activePage.mainTitle?.prefix} <span>–</span> {activePage.mainTitle?.title}</div><div className="tree-analysis-document-title-label">{activePage.mainTitle?.subtitle}</div></div>}
        {badges.filter((item) => item.pageId === activePageId).map((item) => <div key={item.id} className="tree-analysis-question-badge" style={{left:`${item.x/W*100}%`,top:`${item.y/H*100}%`}} onPointerDown={(event) => beginDrag(event,"badge",item)} onDoubleClick={() => { const value=window.prompt("Numéro",String(item.number)); if(value) setBadges((items)=>items.map((badge)=>badge.id===item.id?{...badge,number:Number(value)}:badge)); }}><span>{item.number}</span><button type="button" aria-label="Supprimer le numéro" onClick={(event)=>{event.stopPropagation();setBadges((items)=>items.filter((badge)=>badge.id!==item.id));if(selected?.id===item.id)setSelected(null);}}><X size={10}/></button></div>)}
        {textBoxes.filter((item) => item.pageId === activePageId).map((item) => <div key={item.id} className={`tree-analysis-text-box worksheet-text-box ${selected?.kind === "text" && selected.id === item.id ? "selected" : ""}`} style={{left:`${item.x/W*100}%`,top:`${item.y/H*100}%`,width:`${item.width/W*100}%`,height:`${item.height/H*100}%`,fontSize:`${item.fontSize/W*100}cqw`,textAlign:item.textAlign}} onClick={() => setSelected({kind:"text",id:item.id})}>{selected?.kind==="text"&&selected.id===item.id&&<><button type="button" className="tree-analysis-text-delete" aria-label="Supprimer la boîte" onClick={(event)=>{event.stopPropagation();setTextBoxes((items)=>items.filter((box)=>box.id!==item.id));setSelected(null);}}><X size={14}/></button><span className="tree-analysis-text-resize" onPointerDown={(event)=>beginResize(event,"text-resize",item)}/><span className="tree-analysis-text-move-handle" title="Glisser pour déplacer" onPointerDown={(event)=>{event.stopPropagation();beginDrag(event,"text",item);}}/></>}<textarea className="tree-analysis-text-content worksheet-textarea" spellCheck value={item.text} onPointerDown={(event)=>{event.stopPropagation();setSelected({kind:"text",id:item.id});}} onChange={(event) => setTextBoxes((items) => items.map((box) => box.id === item.id ? {...box,text:event.target.value} : box))}/></div>)}
        {scoreBoxes.filter((item) => (item.pageId ?? pages[0]?.id) === activePageId).map((item) => <div key={item.id} className={`tree-analysis-score-box worksheet-score-box ${selected?.kind==="score"&&selected.id===item.id?"selected":""}`} style={{left:`${item.x/W*100}%`,top:`${item.y/H*100}%`,width:`${(item.width??120)/W*100}%`,height:`${(item.height??42)/H*100}%`,fontSize:`${Math.max(12,Math.min((item.height??42)*.46,(item.width??120)/(String(item.total).length+5)))/W*100}cqw`}} onPointerDown={(event) => beginDrag(event,"score",item)} onClick={()=>setSelected({kind:"score",id:item.id})} onDoubleClick={() => { const total=window.prompt("Total de points",String(item.total)); if(total===null)return; const earned=window.prompt("Points obtenus dans le corrigé (vide pour laisser une ligne)",item.earned===undefined?"":String(item.earned)); setScoreBoxes((items)=>items.map((box)=>box.id===item.id?{...box,total:Math.max(1,Number(total)||1),earned:earned?.trim()?Number(earned):undefined}:box)); }}><span>{item.earned ?? "___"} / {item.total}</span>{selected?.kind==="score"&&selected.id===item.id&&<><button type="button" className="tree-analysis-text-delete worksheet-score-delete" aria-label="Supprimer les points" onClick={(event)=>{event.stopPropagation();setScoreBoxes((items)=>items.filter((box)=>box.id!==item.id));setSelected(null);}}><X size={13}/></button><span className="tree-analysis-text-resize worksheet-score-resize" onPointerDown={(event)=>beginResize(event,"score-resize",{...item,width:item.width??120,height:item.height??42})}/></>}</div>)}
        {dimensionBands.filter((item)=>item.pageId===activePageId).map((item)=>{const asset=worksheetDimensionAsset(item.dimension);return <div key={item.id} className={`worksheet-dimension-band ${selected?.kind==="band"&&selected.id===item.id?"selected":""}`} style={{left:`${item.x/W*100}%`,top:`${item.y/H*100}%`,width:`${asset.width/W*100}%`,height:`${asset.height/H*100}%`}} onPointerDown={(event)=>beginDrag(event,"band",item)} onClick={()=>setSelected({kind:"band",id:item.id})}><Image src={asset.src} alt={item.dimension} width={asset.width} height={asset.height} unoptimized/>{selected?.kind==="band"&&selected.id===item.id&&<button type="button" className="tree-analysis-text-delete worksheet-band-delete" onClick={(event)=>{event.stopPropagation();setDimensionBands((items)=>items.filter((band)=>band.id!==item.id));setSelected(null);}}><X size={13}/></button>}</div>;})}
        {tables.filter((item) => (item.pageId ?? pages[0]?.id) === activePageId).map((table) => {const tableWidth=worksheetTableWidth(table);return <div key={table.id} className={`tree-analysis-activity-table worksheet-activity-table ${isFixedWorksheetTable(table)?"fixed-format":""} ${selected?.kind === "table" && selected.id === table.id ? "selected" : ""}`} style={{left:`${table.x/W*100}%`,top:`${table.y/H*100}%`,width:`${tableWidth/W*100}%`,gridTemplateColumns:normalizedColumnWidths(table).map((value)=>`${value/tableWidth}fr`).join(" "),gridTemplateRows:normalizedRowHeights(table).map((value)=>`${value/W*100}cqw`).join(" ")}} onPointerDown={(event) => beginDrag(event,"table",table)} onClick={() => {setSelected({kind:"table",id:table.id});if(selected?.id!==table.id)setSelectedCells([]);}}>{table.cells.map((cell,index) => cell.columnSpan===0?null:<div key={index} className={`tree-analysis-table-cell worksheet-table-cell ${cell.isCorrect?"correct":""} ${selected?.id===table.id&&selectedCells.includes(index)?"cell-selected":""} role-${cell.role??"text"} background-${cell.background??"white"}`} style={{gridColumn:cell.columnSpan&&cell.columnSpan>1?`span ${cell.columnSpan}`:undefined,gridRow:cell.rowSpan&&cell.rowSpan>1?`span ${cell.rowSpan}`:undefined,color:cell.textColor??(cell.background==="black"?"white":"black"),alignItems:cell.verticalAlign==="top"?"start":cell.verticalAlign==="bottom"?"end":"center",borderRightWidth:cell.borderWidth??2,borderBottomWidth:cell.borderWidth??2}} onClick={(event)=>{event.stopPropagation();setSelected({kind:"table",id:table.id});selectTableCell(index,event.shiftKey);}}><textarea value={cell.text} style={{fontSize:`${(cell.fontSize??17)/W*100}cqw`,textAlign:cell.textAlign??"center",fontWeight:cell.bold?800:500}} onChange={(event) => setTables((items) => items.map((item) => item.id===table.id?{...item,cells:item.cells.map((candidate,i)=>i===index?{...candidate,text:event.target.value}:candidate)}:item))}/>{cell.role==="choice"&&<span className="worksheet-choice-mark">□</span>}{printMode==="answer"&&cell.answer&&<span className="worksheet-cell-answer-copy">{cell.answer}</span>}</div>)}{selected?.kind==="table"&&selected.id===table.id&&<><button type="button" className="tree-analysis-delete-table" aria-label="Supprimer le tableau" onClick={(event)=>{event.stopPropagation();setTables((items)=>items.filter((item)=>item.id!==table.id));setSelected(null);}}><X size={13}/></button>{!isFixedWorksheetTable(table)&&<span className="tree-analysis-text-resize worksheet-table-resize" onPointerDown={(event)=>beginResize(event,"table-resize",{id:table.id,width:tableWidth,height:normalizedRowHeights(table).reduce((sum,value)=>sum+value,0)})}/>}</>}</div>;})}
        {answerLines.filter((item) => item.pageId === activePageId).map((item) => <div key={item.id} className={`worksheet-answer-lines ${selected?.kind === "lines" && selected.id === item.id ? "selected" : ""}`} style={{left:`${item.x/W*100}%`,top:`${item.y/H*100}%`,width:`${item.width/W*100}%`,height:`${item.lineCount*item.lineSpacing/H*100}%`}} onPointerDown={(event) => beginDrag(event,"lines",item)} onClick={() => setSelected({kind:"lines",id:item.id})}>{Array.from({length:item.lineCount},(_,index)=><span key={index} style={{top:`${(index+1)/item.lineCount*100}%`}}/>)}{printMode==="answer"&&<div className="worksheet-answer-copy" style={{fontSize:`${item.answerFontSize/W*100}cqw`,lineHeight:item.lineSpacing/item.answerFontSize}}>{item.answer}</div>}{selected?.kind==="lines"&&selected.id===item.id&&<><button type="button" className="tree-analysis-text-delete worksheet-lines-delete" aria-label="Supprimer les lignes" onClick={(event)=>{event.stopPropagation();setAnswerLines((items)=>items.filter((line)=>line.id!==item.id));setSelected(null);}}><X size={14}/></button><span className="tree-analysis-text-resize worksheet-lines-resize" onPointerDown={(event)=>beginResize(event,"lines-resize",item)}/></>}</div>)}
      </div></div></div>
    </Card>
    <Card className="tree-analysis-flow-panel worksheet-flow-panel"><div><span className="eyebrow">Déroulement du lecteur</span><h3>Ordre de révélation</h3></div><p>Les lignes de réponse et les tableaux corrigés deviennent des étapes. Elles seront présentées dans cet ordre.</p><div className="tree-analysis-phase-list">{pageSteps.map((id,index) => <div className="tree-analysis-phase" key={id}><div className="tree-analysis-phase-heading"><span>{index+1}</span><strong>{id.startsWith("lines:")?"Afficher une réponse sur les lignes":"Répondre au tableau"}</strong><button type="button" onClick={() => moveStep(id,-1)} disabled={index===0}><ArrowUp size={15}/></button><button type="button" onClick={() => moveStep(id,1)} disabled={index===pageSteps.length-1}><ArrowDown size={15}/></button></div></div>)}</div>{!pageSteps.length&&<p>Ajoute des lignes de réponse ou marque une bonne cellule dans un tableau.</p>}</Card>
  </div>;
}
