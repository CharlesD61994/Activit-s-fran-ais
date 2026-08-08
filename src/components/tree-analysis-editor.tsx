"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  ArrowRight,
  Check,
  Eye,
  Grid3X3,
  Link2,
  Maximize2,
  Minimize2,
  Plus,
  Printer,
  Save,
  Trash2,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type {
  ClassGroup,
  SchoolLevel,
  Sentence,
  SentenceDifficulty,
  TreeAnalysisNode,
  TreeAnalysisPageConfig,
  TreeAnalysisPhrase,
  TreeAnalysisRelation,
  TreeAnalysisScoreBox,
  TreeAnalysisTable,
  WordClass,
  WordGroupType
} from "@/types";

type Props = {
  initialSentence?: Sentence;
  levels: SchoolLevel[];
  groups: ClassGroup[];
  onSave: (sentence: Sentence) => void;
};

const PAGE: TreeAnalysisPageConfig = {
  pageSize: "letter",
  orientation: "landscape",
  logicalWidth: 1056,
  logicalHeight: 816,
  marginX: 0,
  marginTop: 0,
  sentenceTop: 28,
  sentenceFontSize: 25,
  sentenceFontFamily: "Arial, Helvetica, sans-serif",
  sentenceFontWeight: 400
};

const MAX_NODE_WIDTH = 72;
const MIN_NODE_WIDTH = 48;
const GRID = 8;
const TREE_TOP = 100;
const TREE_BOTTOM = PAGE.logicalHeight - PAGE.marginTop;
const MIN_SENTENCE_FONT_SIZE = 18;
const MAX_SENTENCE_FONT_SIZE = 96;
const SENTENCE_RIGHT_MARGIN = 20;

const difficultyLabels: Record<SentenceDifficulty, string> = {
  easy: "Facile",
  medium: "Moyenne",
  hard: "Difficile"
};

const groupLabels: Record<WordGroupType, string> = {
  GN: "GN",
  GV: "GV",
  GAdj: "GAdj",
  GAdv: "GAdv",
  GPrep: "GPrép"
};

const wordClassLabels: Record<WordClass, string> = {
  noun: "N",
  determiner: "Dét",
  verb: "V",
  preposition: "Prép",
  adverb: "Adv",
  adjective: "Adj",
  pronoun: "Pron",
  conjunction: "Conj",
  interjection: "Interj"
};

function getNodeLabel(node: TreeAnalysisNode) {
  if (node.wordClass) return wordClassLabels[node.wordClass];
  if (node.groupType) return groupLabels[node.groupType];
  return "Case…";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function snap(value: number) {
  return Math.round(value / GRID) * GRID;
}

export function TreeAnalysisEditor({
  initialSentence,
  levels,
  groups,
  onSave
}: Props) {
  const [step, setStep] = useState<1 | 2>(2);
  const [title, setTitle] = useState(initialSentence?.title ?? "");
  const [levelId, setLevelId] = useState(
    initialSentence?.levelId ?? levels[0]?.id ?? ""
  );
  const [difficulty, setDifficulty] =
    useState<SentenceDifficulty>(
      initialSentence?.difficulty ?? "medium"
    );
  const [originalText, setOriginalText] = useState(
    initialSentence?.originalText ?? ""
  );
  const [assignedGroupIds] = useState<string[]>(
    initialSentence?.assignedGroupIds ?? []
  );
  const [nodes, setNodes] = useState<TreeAnalysisNode[]>(
    initialSentence?.treeAnalysisNodes ?? []
  );
  const [relations, setRelations] = useState<TreeAnalysisRelation[]>(
    initialSentence?.treeAnalysisRelations ?? []
  );
  const [scoreBoxes, setScoreBoxes] = useState<TreeAnalysisScoreBox[]>(
    initialSentence?.treeAnalysisScoreBoxes ?? []
  );
  const [tables, setTables] = useState<TreeAnalysisTable[]>(
    initialSentence?.treeAnalysisTables ?? []
  );
  const [phrases, setPhrases] = useState<TreeAnalysisPhrase[]>(() => {
    if (initialSentence?.treeAnalysisPhrases?.length) return initialSentence.treeAnalysisPhrases;
    if (!initialSentence?.originalText) return [];
    return [{
      id: "primary-phrase",
      text: initialSentence.originalText,
      x: 8,
      y: 72,
      fontSize: initialSentence.treeAnalysisPage?.sentenceFontSize ?? 25,
      nodeWidth: initialSentence.treeAnalysisPage?.nodeWidth ?? 72,
      nodeHeight: initialSentence.treeAnalysisPage?.nodeHeight ?? 44
    }];
  });
  const [activePhraseId, setActivePhraseId] = useState<string | null>(() => initialSentence?.treeAnalysisPhrases?.[0]?.id ?? (initialSentence?.originalText ? "primary-phrase" : null));
  const [phraseModalOpen, setPhraseModalOpen] = useState(false);
  const [phraseDraft, setPhraseDraft] = useState("");
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const [wordCenters, setWordCenters] = useState<number[]>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [linkingParentId, setLinkingParentId] = useState<string | null>(
    null
  );
  const [printMode, setPrintMode] = useState<"student" | "answer">("answer");
  const measureRef = useRef<HTMLSpanElement>(null);
  const wordRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const builderRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    kind: "node" | "score" | "table" | "phrase";
    itemId: string;
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
    nodePositions?: Array<{ id: string; x: number; y: number }>;
  } | null>(null);

  const availableWidth =
    PAGE.logicalWidth - PAGE.marginX * 2;

  useEffect(() => {
    const measure = () => {
      setMeasuredWidth(
        measureRef.current?.getBoundingClientRect().width ?? 0
      );
    };

    measure();
    document.fonts?.ready.then(measure).catch(() => undefined);
  }, [originalText]);

  const trimmed = originalText.trim();
  const sentenceWords = useMemo(
    () => (trimmed ? trimmed.split(/\s+/u) : []),
    [trimmed]
  );
  const targetSentenceWidth =
    PAGE.logicalWidth - PAGE.marginX - SENTENCE_RIGHT_MARGIN;
  const idealSentenceFontSize = measuredWidth
    ? PAGE.sentenceFontSize * (targetSentenceWidth / measuredWidth)
    : PAGE.sentenceFontSize;
  const effectiveSentenceFontSize = clamp(
    idealSentenceFontSize,
    MIN_SENTENCE_FONT_SIZE,
    MAX_SENTENCE_FONT_SIZE
  );
  const renderedSentenceWidth =
    measuredWidth * (effectiveSentenceFontSize / PAGE.sentenceFontSize);
  const ratio = renderedSentenceWidth / targetSentenceWidth;
  const fits = Boolean(trimmed) && renderedSentenceWidth <= targetSentenceWidth;
  const nearLimit = fits && idealSentenceFontSize < MIN_SENTENCE_FONT_SIZE;
  const sentenceFontSizeCqw = `${(effectiveSentenceFontSize / PAGE.logicalWidth) * 100}cqw`;
  const wordCount = trimmed ? trimmed.split(/\s+/u).length : 1;
  const nodeGap = 8;
  const calculatedNodeWidth = Math.floor(
    (availableWidth - nodeGap * Math.max(0, wordCount - 1)) / wordCount
  );
  const nodeWidth = clamp(calculatedNodeWidth, MIN_NODE_WIDTH, MAX_NODE_WIDTH);
  const nodeHeight = Math.round(nodeWidth * 0.61);
  const boxesFitOnOneRow = calculatedNodeWidth >= MIN_NODE_WIDTH;

  useEffect(() => {
    setNodes((currentNodes) => {
      let changed = false;
      const printableNodes = currentNodes.map((node) => {
        const x = clamp(
          node.x,
          PAGE.marginX,
          PAGE.logicalWidth - PAGE.marginX - nodeWidth
        );
        const y = clamp(node.y, TREE_TOP, TREE_BOTTOM - nodeHeight);
        if (x === node.x && y === node.y) return node;
        changed = true;
        return { ...node, x, y };
      });
      return changed ? printableNodes : currentNodes;
    });
  }, [nodeHeight, nodeWidth]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || step !== 2) {
      setWordCenters([]);
      return;
    }

    const measureWords = () => {
      const canvasRect = canvas.getBoundingClientRect();
      const scaleX = PAGE.logicalWidth / canvasRect.width;
      setWordCenters(
        sentenceWords.map((_, index) => {
          const wordRect = wordRefs.current[index]?.getBoundingClientRect();
          return wordRect
            ? (wordRect.left - canvasRect.left + wordRect.width / 2) * scaleX
            : 0;
        })
      );
    };

    measureWords();
    document.fonts?.ready.then(measureWords).catch(() => undefined);
    const observer = new ResizeObserver(measureWords);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [effectiveSentenceFontSize, sentenceWords, step]);

  const status = useMemo(() => {
    if (!trimmed) {
      return {
        tone: "neutral",
        text: "Écris une phrase pour vérifier sa largeur."
      };
    }
    if (!fits) {
      return {
        tone: "error",
        text: "Phrase trop longue pour être imprimée sur une seule ligne."
      };
    }
    if (nearLimit) {
      return {
        tone: "warning",
        text: `La phrase sera réduite automatiquement à ${effectiveSentenceFontSize.toFixed(1)} pt.`
      };
    }
    return {
      tone: "success",
      text: "La phrase tient sur une ligne."
    };
  }, [effectiveSentenceFontSize, fits, nearLimit, trimmed]);

  const compatibleGroups = groups.filter(
    (group) => group.levelId === levelId
  );

  const allNodesConfigured =
    nodes.length > 0 &&
    nodes.every((node) => Boolean(node.groupType || node.wordClass));
  const editingNode = nodes.find((node) => node.id === editingNodeId);

  function getNodeDimensions(node: TreeAnalysisNode) {
    const phrase = phrases.find((item) => item.id === node.phraseId);
    return { width: phrase?.nodeWidth ?? nodeWidth, height: phrase?.nodeHeight ?? nodeHeight };
  }

  function addNode() {
    const phrase = phrases.find((item) => item.id === activePhraseId) ?? phrases[0];
    const currentNodeWidth = phrase?.nodeWidth ?? nodeWidth;
    const currentNodeHeight = phrase?.nodeHeight ?? nodeHeight;
    const index = nodes.length;
    const columns = Math.max(1, Math.floor(availableWidth / (currentNodeWidth + 24)));
    const x = clamp(
      snap((index % columns) * (currentNodeWidth + 24)),
      PAGE.marginX,
      PAGE.logicalWidth - PAGE.marginX - currentNodeWidth
    );
    const y = clamp(
      snap((phrase?.y ?? 70) + 70 + Math.floor(index / columns) * (currentNodeHeight + 36)),
      TREE_TOP,
      TREE_BOTTOM - currentNodeHeight
    );

    const node: TreeAnalysisNode = {
      id: crypto.randomUUID(),
      x,
      y,
      phraseId: phrase?.id
    };

    setNodes((current) => [...current, node]);
    setSelectedNodeIds([node.id]);
    setLinkingParentId(null);
    setAddMenuOpen(false);
  }

  function addPhrase() {
    const text = phraseDraft.trim();
    if (!text) return;
    const wordCountForPhrase = text.split(/\s+/u).length;
    const phraseNodeWidth = clamp(Math.floor((PAGE.logicalWidth - 8 * Math.max(0, wordCountForPhrase - 1)) / wordCountForPhrase), 48, 72);
    const estimatedWidthAt25 = Math.max(1, text.length * 12.5);
    const fontSize = clamp(25 * ((PAGE.logicalWidth - 20) / estimatedWidthAt25), 18, 96);
    const phrase: TreeAnalysisPhrase = {
      id: crypto.randomUUID(), text, x: 8,
      y: phrases.length === 0 ? 72 : Math.min(phrases[phrases.length - 1].y + 250, 650),
      fontSize,
      nodeWidth: phraseNodeWidth,
      nodeHeight: Math.round(phraseNodeWidth * .61)
    };
    setPhrases((current) => [...current, phrase]);
    setActivePhraseId(phrase.id);
    setPhraseDraft("");
    setPhraseModalOpen(false);
  }

  function addScoreBox() {
    const rawTotal = window.prompt("Total de points", "1");
    if (rawTotal === null) return;
    const total = Math.max(1, Math.round(Number(rawTotal) || 1));
    setScoreBoxes((current) => [...current, { id: crypto.randomUUID(), x: 24, y: 160, total }]);
    setAddMenuOpen(false);
  }

  function addActivityTable() {
    const rawRows = window.prompt("Nombre de rangées", "2");
    if (rawRows === null) return;
    const rawColumns = window.prompt("Nombre de colonnes", "3");
    if (rawColumns === null) return;
    const rows = clamp(Math.round(Number(rawRows) || 2), 1, 8);
    const columns = clamp(Math.round(Number(rawColumns) || 3), 1, 8);
    setTables((current) => [...current, {
      id: crypto.randomUUID(), x: 80, y: 420, rows, columns,
      cells: Array.from({ length: rows * columns }, () => ({ text: "", isCorrect: false }))
    }]);
    setAddMenuOpen(false);
  }

  function startItemDrag(event: React.PointerEvent<HTMLElement>, kind: "score" | "table" | "phrase", item: { id: string; x: number; y: number }) {
    if (kind !== "phrase" && (event.target as HTMLElement).closest("input,textarea,button")) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    dragRef.current = {
      kind, itemId: item.id,
      width: kind === "score" ? 90 : kind === "table" ? 360 : 1000,
      height: kind === "score" ? 60 : kind === "table" ? 120 : 60,
      offsetX: (event.clientX - rect.left) * (PAGE.logicalWidth / rect.width) - item.x,
      offsetY: (event.clientY - rect.top) * (PAGE.logicalHeight / rect.height) - item.y
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  async function toggleFullscreen() {
    if (!document.fullscreenElement) await builderRef.current?.requestFullscreen();
    else await document.exitFullscreen();
  }

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  function updateNode(
    nodeId: string,
    patch: Partial<TreeAnalysisNode>
  ) {
    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId ? { ...node, ...patch } : node
      )
    );
  }

  function deleteNode(nodeId: string) {
    setNodes((current) =>
      current.filter((node) => node.id !== nodeId)
    );
    setRelations((current) =>
      current.filter(
        (relation) =>
          relation.parentNodeId !== nodeId &&
          relation.childNodeId !== nodeId
      )
    );
    setSelectedNodeIds((current) => current.filter((id) => id !== nodeId));
    setLinkingParentId((current) =>
      current === nodeId ? null : current
    );
  }

  function handleNodePointerDown(
    event: React.PointerEvent<HTMLDivElement>,
    node: TreeAnalysisNode
  ) {
    if (
      (event.target as HTMLElement).closest(
        "select,button,.tree-node-actions"
      )
    ) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = PAGE.logicalWidth / rect.width;
    const scaleY = PAGE.logicalHeight / rect.height;
    let dragIds = selectedNodeIds.includes(node.id) ? selectedNodeIds : [node.id];

    if (event.shiftKey) {
      if (selectedNodeIds.includes(node.id)) {
        setSelectedNodeIds((current) => current.filter((id) => id !== node.id));
        return;
      }
      dragIds = [...selectedNodeIds, node.id];
      setSelectedNodeIds(dragIds);
    } else if (!selectedNodeIds.includes(node.id)) {
      setSelectedNodeIds([node.id]);
    }

    dragRef.current = {
      kind: "node",
      itemId: node.id,
      width: getNodeDimensions(node).width,
      height: getNodeDimensions(node).height,
      nodePositions: nodes
        .filter((item) => dragIds.includes(item.id))
        .map((item) => ({ id: item.id, x: item.x, y: item.y })),
      offsetX:
        (event.clientX - rect.left) * scaleX - node.x,
      offsetY:
        (event.clientY - rect.top) * scaleY - node.y
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleCanvasPointerMove(
    event: React.PointerEvent<HTMLDivElement>
  ) {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!drag || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = PAGE.logicalWidth / rect.width;
    const scaleY = PAGE.logicalHeight / rect.height;

    let logicalX =
      (event.clientX - rect.left) * scaleX - drag.offsetX;
    const logicalY =
      (event.clientY - rect.top) * scaleY - drag.offsetY;

    const closestWordCenter = drag.kind === "node" ? wordCenters.reduce<number | null>(
      (closest, center) => {
        const nodeCenter = logicalX + drag.width / 2;
        if (Math.abs(center - nodeCenter) > 18) return closest;
        if (closest === null) return center;
        return Math.abs(center - nodeCenter) < Math.abs(closest - nodeCenter)
          ? center
          : closest;
      },
      null
    ) : null;
    if (closestWordCenter !== null) {
      logicalX = closestWordCenter - drag.width / 2;
    }

    if (drag.kind === "score") {
      setScoreBoxes((current) => current.map((box) =>
        box.id === drag.itemId
          ? { ...box, x: clamp(snap(logicalX), 0, PAGE.logicalWidth - 90), y: clamp(snap(logicalY), TREE_TOP, TREE_BOTTOM - 60) }
          : box
      ));
      return;
    }

    if (drag.kind === "table") {
      setTables((current) => current.map((table) =>
        table.id === drag.itemId
          ? { ...table, x: clamp(snap(logicalX), 0, PAGE.logicalWidth - 360), y: clamp(snap(logicalY), TREE_TOP, TREE_BOTTOM - table.rows * 50) }
          : table
      ));
      return;
    }

    if (drag.kind === "phrase") {
      setPhrases((current) => current.map((phrase) =>
        phrase.id === drag.itemId
          ? { ...phrase, x: clamp(logicalX, 0, PAGE.logicalWidth - drag.width), y: clamp(logicalY, 52, PAGE.logicalHeight - drag.height) }
          : phrase
      ));
      return;
    }

    const primaryStart = drag.nodePositions?.find((item) => item.id === drag.itemId);
    if (!primaryStart) return;
    const nextPrimaryX = closestWordCenter === null ? snap(logicalX) : logicalX;
    const nextPrimaryY = snap(logicalY);
    const deltaX = nextPrimaryX - primaryStart.x;
    const deltaY = nextPrimaryY - primaryStart.y;
    const positions = new Map(drag.nodePositions?.map((item) => [item.id, item]));
    setNodes((current) => current.map((node) => {
      const start = positions.get(node.id);
      if (!start) return node;
      const size = getNodeDimensions(node);
      return {
        ...node,
        x: clamp(start.x + deltaX, PAGE.marginX, PAGE.logicalWidth - PAGE.marginX - size.width),
        y: clamp(start.y + deltaY, TREE_TOP, TREE_BOTTOM - size.height)
      };
    }));
  }

  function stopDragging() {
    dragRef.current = null;
  }

  function handleNodeKeyDown(
    event: React.KeyboardEvent<HTMLDivElement>,
    node: TreeAnalysisNode
  ) {
    const movement = event.shiftKey ? GRID * 4 : GRID;
    const directions: Record<string, { x: number; y: number }> = {
      ArrowLeft: { x: -movement, y: 0 },
      ArrowRight: { x: movement, y: 0 },
      ArrowUp: { x: 0, y: -movement },
      ArrowDown: { x: 0, y: movement }
    };
    const direction = directions[event.key];

    if (direction) {
      event.preventDefault();
      updateNode(node.id, {
        x: clamp(node.x + direction.x, PAGE.marginX, PAGE.logicalWidth - PAGE.marginX - nodeWidth),
        y: clamp(node.y + direction.y, TREE_TOP, TREE_BOTTOM - nodeHeight)
      });
      return;
    }

    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteNode(node.id);
    }
  }

  function startLink(nodeId: string) {
    setLinkingParentId(nodeId);
  }

  function chooseLinkTarget(childId: string) {
    if (!linkingParentId || childId === linkingParentId) return;

    const exists = relations.some(
      (relation) =>
        relation.parentNodeId === linkingParentId &&
        relation.childNodeId === childId
    );

    if (!exists) {
      setRelations((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          parentNodeId: linkingParentId,
          childNodeId: childId
        }
      ]);
    }

    setLinkingParentId(null);
    setSelectedNodeIds([childId]);
  }

  function removeRelation(relationId: string) {
    setRelations((current) =>
      current.filter((relation) => relation.id !== relationId)
    );
  }

  function saveActivity() {
    if (!phrases.length || !title.trim() || !levelId) return;
    const now = new Date().toISOString();

    onSave({
      id: initialSentence?.id ?? crypto.randomUUID(),
      activityType: "tree_analysis",
      levelId,
      title: title.trim(),
      originalText: phrases[0]?.text ?? "",
      difficulty,
      tags: initialSentence?.tags ?? [],
      corrections: [],
      treeAnalysisPage: {
        ...PAGE,
        sentenceFontSize: effectiveSentenceFontSize,
        nodeWidth,
        nodeHeight
      },
      treeAnalysisNodes: nodes,
      treeAnalysisRelations: relations,
      treeAnalysisScoreBoxes: scoreBoxes,
      treeAnalysisTables: tables,
      treeAnalysisPhrases: phrases,
      assignedGroupIds,
      competitionEnabled:
        initialSentence?.competitionEnabled ?? false,
      assignmentStatusByGroup:
        initialSentence?.assignmentStatusByGroup ?? {},
      assignmentProgressByGroup:
        initialSentence?.assignmentProgressByGroup ?? {},
      createdAt: initialSentence?.createdAt ?? now,
      updatedAt: now
    });
  }

  return (
    <div className="tree-analysis-editor">
      <span
        ref={measureRef}
        className="tree-analysis-measure"
        aria-hidden="true"
      >
        {trimmed || " "}
      </span>

      <div className="tree-analysis-stepper" aria-label="Progression">
        <span className={step === 1 ? "active" : "done"}>
          <b>{step === 1 ? "1" : <Check size={14} />}</b>
          Phrase
        </span>
        <i />
        <span className={step === 2 ? "active" : ""}>
          <b>2</b>
          Arbre
        </span>
      </div>

      {step === 1 ? (
        <>
          <Card className="editor-section-card">
            <span className="eyebrow">Étape 1 sur 2</span>
            <h2>Phrase</h2>
            <p className="editor-help">
              La phrase doit tenir sur une seule ligne d’une feuille
              Lettre 8½ × 11 en orientation paysage.
            </p>

            <div className="form-grid">
              <label>
                Titre
                <input
                  value={title}
                  onChange={(event) =>
                    setTitle(event.target.value)
                  }
                  placeholder="Ex. Analyse de la phrase 1"
                />
              </label>
              <label>
                Niveau
                <select
                  value={levelId}
                  onChange={(event) =>
                    setLevelId(event.target.value)
                  }
                >
                  {levels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Difficulté
                <select
                  value={difficulty}
                  onChange={(event) =>
                    setDifficulty(
                      event.target.value as SentenceDifficulty
                    )
                  }
                >
                  {Object.entries(difficultyLabels).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    )
                  )}
                </select>
              </label>
            </div>

            <label className="tree-analysis-sentence-field">
              Phrase à analyser
              <textarea
                rows={3}
                value={originalText}
                onChange={(event) =>
                  setOriginalText(
                    event.target.value.replace(/[\r\n]+/g, " ")
                  )
                }
                placeholder="Écris la phrase qui apparaîtra au haut de la feuille."
              />
            </label>

            <div
              className={`tree-analysis-width-status ${status.tone}`}
              role="status"
            >
              {status.tone === "success" && <Check size={18} />}
              <span>{status.text}</span>
              {trimmed && (
                <small>
                  {Math.min(Math.round(ratio * 100), 999)} % de la
                  largeur imprimable
                </small>
              )}
            </div>
          </Card>

          <Card className="tree-analysis-preview-card">
            <div className="tree-analysis-preview-heading">
              <div>
                <span className="eyebrow">Aperçu impression</span>
                <h2>Lettre 8½ × 11 — paysage</h2>
              </div>
              <Printer size={21} />
            </div>

            <div className="tree-analysis-page-shell">
              <div className="tree-analysis-page">
                <div className="tree-analysis-safe-area">
                  <div
                    className={`tree-analysis-preview-sentence ${
                      trimmed && !fits ? "overflowing" : ""
                    }`}
                    style={{ fontSize: sentenceFontSizeCqw }}
                  >
                    {trimmed || "Ta phrase apparaîtra ici."}
                  </div>
                  <div className="tree-analysis-future-area">
                    <span>Futur espace de l’arbre</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <div className="tree-analysis-actions">
            <span>
              {compatibleGroups.length} groupe
              {compatibleGroups.length !== 1 ? "s" : ""} compatible
              {compatibleGroups.length !== 1 ? "s" : ""} avec ce niveau
            </span>
            <Button
              type="button"
              disabled={!fits || !title.trim() || !levelId}
              onClick={() => setStep(2)}
            >
              Continuer vers l’arbre
              <ArrowRight size={17} />
            </Button>
          </div>
        </>
      ) : (
        <>
          <div ref={builderRef} className={`tree-analysis-builder-host ${isFullscreen ? "fullscreen" : ""}`}>
          <Card className="tree-analysis-builder-card">
            <div className="tree-analysis-builder-heading">
              <div>
                <span className="eyebrow">Étape 2 sur 2</span>
                <h2>Construction de l’arbre</h2>
                <p>
                  Ajoute des rectangles, place-les librement sur la
                  feuille, puis double-clique sur un rectangle pour choisir
                  son type, le relier ou le supprimer. Utilise Maj + clic
                  pour sélectionner plusieurs rectangles.
                </p>
              </div>
              <div className="tree-analysis-builder-tools">
                <Button type="button" onClick={() => setAddMenuOpen(true)}>
                  <Plus size={17} />
                  Ajouter un élément
                </Button>
                <Button type="button" variant="secondary" onClick={() => setPhraseModalOpen(true)}>
                  <Plus size={17} />
                  Ajouter une phrase
                </Button>
                <Button type="button" variant="secondary" onClick={toggleFullscreen}>
                  {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                  {isFullscreen ? "Quitter le plein écran" : "Plein écran"}
                </Button>
                {linkingParentId && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setLinkingParentId(null)}
                  >
                    <X size={17} />
                    Annuler la liaison
                  </Button>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPrintMode("student")}
                  aria-pressed={printMode === "student"}
                >
                  <Eye size={17} />
                  Aperçu élève
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPrintMode("answer")}
                  aria-pressed={printMode === "answer"}
                >
                  <Check size={17} />
                  Corrigé
                </Button>
                <Button type="button" variant="secondary" onClick={() => window.print()}>
                  <Printer size={17} />
                  Imprimer
                </Button>
              </div>
            </div>

            <div className="tree-analysis-builder-meta">
              <label>Titre<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Titre de l’activité" /></label>
              <label>Niveau<select value={levelId} onChange={(event) => setLevelId(event.target.value)}>{levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></label>
            </div>

            {linkingParentId && (
              <div className="tree-analysis-link-hint">
                <Link2 size={17} />
                Clique maintenant sur le rectangle enfant.
              </div>
            )}

            <div className={`tree-analysis-box-size ${boxesFitOnOneRow ? "success" : "warning"}`}>
              Cases uniformes : {nodeWidth} × {nodeHeight} — calculées pour {wordCount} mot{wordCount > 1 ? "s" : ""}.
            </div>

            <div className={`tree-analysis-workspace tree-print-${printMode}`}>
              <div className="tree-analysis-page-shell builder">
                <div
                ref={canvasRef}
                className={`tree-analysis-page tree-analysis-canvas ${
                  linkingParentId ? "linking" : ""
                }`}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={stopDragging}
                onPointerCancel={stopDragging}
                onClick={(event) => {
                  if (event.target === event.currentTarget) {
                    setSelectedNodeIds([]);
                  }
                }}
              >
                <div className="tree-analysis-print-safe-guide" />

                <div className="tree-analysis-name-line">Nom : <span /></div>
                {phrases.map((phrase) => (
                  <button
                    type="button"
                    key={phrase.id}
                    className={`tree-analysis-builder-sentence ${activePhraseId === phrase.id ? "active" : ""}`}
                    style={{ left: `${(phrase.x / PAGE.logicalWidth) * 100}%`, top: `${(phrase.y / PAGE.logicalHeight) * 100}%`, fontSize: `${(phrase.fontSize / PAGE.logicalWidth) * 100}cqw` }}
                    onClick={() => setActivePhraseId(phrase.id)}
                    onPointerDown={(event) => {
                      setActivePhraseId(phrase.id);
                      startItemDrag(event, "phrase", phrase);
                    }}
                  >
                    {phrase.text}
                  </button>
                ))}

                <svg
                  className="tree-analysis-lines"
                  viewBox={`0 0 ${PAGE.logicalWidth} ${PAGE.logicalHeight}`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {relations.map((relation) => {
                    const parent = nodes.find(
                      (node) => node.id === relation.parentNodeId
                    );
                    const child = nodes.find(
                      (node) => node.id === relation.childNodeId
                    );

                    if (!parent || !child) return null;

                    const parentSize = getNodeDimensions(parent);
                    const childSize = getNodeDimensions(child);

                    return (
                      <line
                        key={relation.id}
                        x1={parent.x + parentSize.width / 2}
                        y1={parent.y + parentSize.height}
                        x2={child.x + childSize.width / 2}
                        y2={child.y}
                      />
                    );
                  })}
                </svg>

                {nodes.map((node) => {
                  const selected = selectedNodeIds.includes(node.id);
                  const linkingParent =
                    linkingParentId === node.id;
                  const currentNodeSize = getNodeDimensions(node);

                  return (
                    <div
                      key={node.id}
                      className={`tree-analysis-node ${
                        selected ? "selected" : ""
                      } ${
                        linkingParent ? "linking-parent" : ""
                      }`}
                      style={{
                        left: `${(node.x / PAGE.logicalWidth) * 100}%`,
                        top: `${(node.y / PAGE.logicalHeight) * 100}%`,
                        width: `${(currentNodeSize.width / PAGE.logicalWidth) * 100}%`,
                        height: `${(currentNodeSize.height / PAGE.logicalHeight) * 100}%`
                      }}
                      onPointerDown={(event) =>
                        handleNodePointerDown(event, node)
                      }
                      onKeyDown={(event) => handleNodeKeyDown(event, node)}
                      tabIndex={0}
                      role="button"
                      aria-label={`${node.groupType || node.wordClass ? getNodeLabel(node) : "Case non configurée"}. Déplaçable.`}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (
                          linkingParentId &&
                          linkingParentId !== node.id
                        ) {
                          chooseLinkTarget(node.id);
                        } else if (!event.shiftKey) {
                          setSelectedNodeIds([node.id]);
                        }
                      }}
                      onDoubleClick={(event) => {
                        event.stopPropagation();
                        setSelectedNodeIds([node.id]);
                        setEditingNodeId(node.id);
                      }}
                    >
                      <strong>{getNodeLabel(node)}</strong>
                    </div>
                  );
                })}
                {scoreBoxes.map((box) => (
                  <div
                    key={box.id}
                    className="tree-analysis-score-box"
                    style={{ left: `${(box.x / PAGE.logicalWidth) * 100}%`, top: `${(box.y / PAGE.logicalHeight) * 100}%` }}
                    onPointerDown={(event) => startItemDrag(event, "score", box)}
                    onDoubleClick={() => {
                      const value = window.prompt("Total de points", String(box.total));
                      if (value !== null) setScoreBoxes((current) => current.map((item) => item.id === box.id ? { ...item, total: Math.max(1, Math.round(Number(value) || 1)) } : item));
                    }}
                  >
                    /{box.total}
                    <button type="button" onClick={() => setScoreBoxes((current) => current.filter((item) => item.id !== box.id))} aria-label="Supprimer la boîte"><X size={13} /></button>
                  </div>
                ))}
                {tables.map((table) => (
                  <div
                    key={table.id}
                    className="tree-analysis-activity-table"
                    style={{ left: `${(table.x / PAGE.logicalWidth) * 100}%`, top: `${(table.y / PAGE.logicalHeight) * 100}%`, gridTemplateColumns: `repeat(${table.columns}, minmax(0, 1fr))` }}
                    onPointerDown={(event) => startItemDrag(event, "table", table)}
                  >
                    <button type="button" className="tree-analysis-merge-row" onClick={() => setTables((current) => current.map((item) => item.id === table.id ? { ...item, cells: item.cells.map((cell, index) => index === 0 ? { ...cell, columnSpan: table.columns } : index < table.columns ? { ...cell, columnSpan: 0 } : cell) } : item))}>Fusionner la 1re rangée</button>
                    {table.cells.map((cell, cellIndex) => cell.columnSpan === 0 ? null : (
                      <div key={cellIndex} className={`tree-analysis-table-cell ${cell.isCorrect ? "correct" : ""} ${cell.columnSpan && cell.columnSpan > 1 ? "merged" : ""}`} style={{ gridColumn: cell.columnSpan && cell.columnSpan > 1 ? `span ${cell.columnSpan}` : undefined }}>
                        <textarea
                          value={cell.text}
                          aria-label={`Cellule ${cellIndex + 1}`}
                          onChange={(event) => setTables((current) => current.map((item) => item.id === table.id ? { ...item, cells: item.cells.map((itemCell, index) => index === cellIndex ? { ...itemCell, text: event.target.value } : itemCell) } : item))}
                        />
                        <button
                          type="button"
                          className="tree-analysis-correct-cell"
                          onClick={() => setTables((current) => current.map((item) => item.id === table.id ? { ...item, cells: item.cells.map((itemCell, index) => index === cellIndex ? { ...itemCell, isCorrect: !itemCell.isCorrect } : itemCell) } : item))}
                          title="Marquer comme bonne réponse"
                        >
                          {cell.isCorrect ? "✓" : "○"}
                        </button>
                      </div>
                    ))}
                    <button type="button" className="tree-analysis-delete-table" onClick={() => setTables((current) => current.filter((item) => item.id !== table.id))} aria-label="Supprimer le tableau"><X size={13} /></button>
                  </div>
                ))}
                </div>
              </div>

              {editingNode && (
                <div
                  className="tree-analysis-modal-backdrop"
                  role="presentation"
                  onMouseDown={(event) => {
                    if (event.target === event.currentTarget) setEditingNodeId(null);
                  }}
                >
                  <aside
                    className="tree-analysis-inspector tree-analysis-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Modifier le rectangle"
                  >
                    <div className="tree-analysis-modal-heading">
                      <div>
                        <span className="eyebrow">Rectangle</span>
                        <h3>Que veux-tu faire?</h3>
                      </div>
                      <button type="button" onClick={() => setEditingNodeId(null)} aria-label="Fermer">
                        <X size={18} />
                      </button>
                    </div>
                    <div className="tree-analysis-node-kind" role="group" aria-label="Type de case">
                      <button
                        type="button"
                        className={!editingNode.wordClass ? "active" : ""}
                        onClick={() => updateNode(editingNode.id, { wordClass: undefined })}
                      >
                        Groupe de mots
                      </button>
                      <button
                        type="button"
                        className={editingNode.wordClass ? "active" : ""}
                        onClick={() => updateNode(editingNode.id, {
                          groupType: undefined,
                          wordClass: editingNode.wordClass ?? "noun"
                        })}
                      >
                        Classe de mots
                      </button>
                    </div>

                    {editingNode.wordClass ? (
                      <label>
                        Classe de mots
                        <select
                          value={editingNode.wordClass}
                          onChange={(event) => updateNode(editingNode.id, {
                            groupType: undefined,
                            wordClass: event.target.value as WordClass
                          })}
                        >
                          {(Object.keys(wordClassLabels) as WordClass[]).map((wordClass) => (
                            <option key={wordClass} value={wordClass}>{wordClassLabels[wordClass]}</option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <label>
                        Type du groupe
                        <select
                          value={editingNode.groupType ?? ""}
                          onChange={(event) => updateNode(editingNode.id, {
                            wordClass: undefined,
                            groupType: (event.target.value || undefined) as WordGroupType | undefined
                          })}
                        >
                          <option value="">Choisir…</option>
                          {(Object.keys(groupLabels) as WordGroupType[]).map((groupType) => (
                            <option key={groupType} value={groupType}>{groupLabels[groupType]}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    <div className="tree-analysis-modal-actions">
                      <Button type="button" onClick={() => {
                        startLink(editingNode.id);
                        setEditingNodeId(null);
                      }}>
                        <Link2 size={17} />
                        Relier à un enfant
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => {
                        deleteNode(editingNode.id);
                        setEditingNodeId(null);
                      }}>
                        <Trash2 size={17} />
                        Supprimer
                      </Button>
                    </div>
                  </aside>
                </div>
              )}
              {addMenuOpen && (
                <div className="tree-analysis-modal-backdrop" role="presentation" onMouseDown={(event) => {
                  if (event.target === event.currentTarget) setAddMenuOpen(false);
                }}>
                  <aside className="tree-analysis-inspector tree-analysis-modal" role="dialog" aria-modal="true" aria-label="Ajouter un élément">
                    <div className="tree-analysis-modal-heading">
                      <div>
                        <span className="eyebrow">Ajouter</span>
                        <h3>Choisis un élément</h3>
                      </div>
                      <button type="button" onClick={() => setAddMenuOpen(false)} aria-label="Fermer"><X size={18} /></button>
                    </div>
                    <div className="tree-analysis-add-options">
                      <button type="button" onClick={addNode}><span className="tree-analysis-add-icon">□</span><strong>Rectangle</strong><small>Groupe ou classe de mots</small></button>
                      <button type="button" onClick={addScoreBox}><span className="tree-analysis-add-icon">/x</span><strong>Boîte de points</strong><small>Affiche un total comme /12</small></button>
                      <button type="button" onClick={addActivityTable}><Grid3X3 size={25} /><strong>Tableau d’activité</strong><small>Rangées, colonnes et réponses</small></button>
                    </div>
                  </aside>
                </div>
              )}
              {phraseModalOpen && (
                <div className="tree-analysis-modal-backdrop" role="presentation" onMouseDown={(event) => {
                  if (event.target === event.currentTarget) setPhraseModalOpen(false);
                }}>
                  <aside className="tree-analysis-inspector tree-analysis-modal" role="dialog" aria-modal="true" aria-label="Ajouter une phrase">
                    <div className="tree-analysis-modal-heading">
                      <div><span className="eyebrow">Phrase</span><h3>Ajouter une phrase à analyser</h3></div>
                      <button type="button" onClick={() => setPhraseModalOpen(false)} aria-label="Fermer"><X size={18} /></button>
                    </div>
                    <label>Phrase<textarea rows={4} value={phraseDraft} onChange={(event) => setPhraseDraft(event.target.value.replace(/[\r\n]+/g, " "))} autoFocus /></label>
                    <p>La police et les rectangles seront adaptés automatiquement au nombre de mots de cette phrase.</p>
                    <Button type="button" disabled={!phraseDraft.trim()} onClick={addPhrase}>Ajouter la phrase</Button>
                  </aside>
                </div>
              )}
            </div>

            {relations.length > 0 && (
              <div className="tree-analysis-relations-list">
                <span className="eyebrow">Liaisons</span>
                <div>
                  {relations.map((relation) => {
                    const parent = nodes.find(
                      (node) => node.id === relation.parentNodeId
                    );
                    const child = nodes.find(
                      (node) => node.id === relation.childNodeId
                    );

                    return (
                      <button
                        type="button"
                        key={relation.id}
                        onClick={() => removeRelation(relation.id)}
                        title="Supprimer cette liaison"
                      >
                        {parent ? getNodeLabel(parent) : "Case"}{" "}
                        →{" "}
                        {child ? getNodeLabel(child) : "Case"}
                        <X size={13} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>
          </div>

          <div className="tree-analysis-actions">
            <span>
              {nodes.length === 0
                ? "Ajoute au moins un rectangle."
                : !boxesFitOnOneRow
                  ? "La phrase contient trop de mots pour conserver des cases assez grandes sur une seule rangée."
                : !allNodesConfigured
                  ? "Choisis un groupe ou une classe de mots pour chaque case."
                  : `${nodes.length} rectangle${nodes.length > 1 ? "s" : ""} prêt${nodes.length > 1 ? "s" : ""}.`}
            </span>
            <Button
              type="button"
              onClick={saveActivity}
              disabled={!phrases.length || !title.trim() || !levelId || (nodes.length > 0 && !allNodesConfigured)}
            >
              <Save size={17} />
              Enregistrer l’activité
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
