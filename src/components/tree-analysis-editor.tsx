"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
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
import { captureSharedTextSelection, groupSharedTextMarks, rebaseSharedTextRange, renderSharedAnnotatedText } from "@/components/grammar/shared-annotated-text";
import { GrammarInteractionModal } from "@/components/grammar/grammar-interaction-modal";
import { sentenceFunctionOptions } from "@/lib/grammar-definitions";
import { Card } from "@/components/ui/card";
import type {
  ClassGroup,
  SchoolLevel,
  Sentence,
  SentenceDifficulty,
  TreeAnalysisNode,
  TreeAnalysisPageConfig,
  TreeAnalysisDocumentPage,
  TreeAnalysisQuestionBadge,
  TreeAnalysisPhrase,
  TreeAnalysisRelation,
  TreeAnalysisScoreBox,
  TreeAnalysisTable,
  TreeAnalysisTextBox,
  TreeAnalysisInteraction,
  TreeAnalysisFlow,
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
const ALIGNMENT_TOLERANCE = 8;

const FREE_PAGE = (id = crypto.randomUUID()): TreeAnalysisDocumentPage => ({ id, orientation: "landscape", template: "free", rectanglePreset: "normal", margins: { top: 24, right: 24, bottom: 24, left: 24 }, header: { nameX: 12, nameY: 18, groupX: 430, groupY: 18, fontSize: 20, lineWidth: 260 } });
const TEACHING_PAGE = (id = crypto.randomUUID()): TreeAnalysisDocumentPage => ({
  id,
  orientation: "portrait",
  template: "teaching_document",
  rectanglePreset: "compact",
  // Logical coordinates corresponding to the Word document's physical margins.
  margins: { top: 68, right: 121, bottom: 50, left: 121 },
  header: { nameX: 121, nameY: 25, groupX: 650, groupY: 25, fontSize: 11, lineWidth: 250, activityType: "EXERCICES", activityTitle: "Les analyses en arbre", showPageBadge: true },
  mainTitle: { enabled: true, prefix: "Exercices", title: "Les analyses en arbre", subtitle: "L’analyse des groupes de mots" },
  readerMode: "groups_then_tree"
});

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
const DEFAULT_PHASE_ORDER = ["groups", "nuclei", "linked_nodes", "functions", "remaining_nodes", "tables"] as const;
type ReaderPhase = typeof DEFAULT_PHASE_ORDER[number];
const phaseLabels: Record<ReaderPhase, string> = { groups: "Encadrer les groupes", nuclei: "Encadrer les noyaux", linked_nodes: "Remplir les rectangles associés", functions: "Identifier les fonctions", remaining_nodes: "Compléter le reste de l’arbre", tables: "Répondre aux tableaux" };

function getNodeLabel(node: TreeAnalysisNode) {
  if (node.wordClass) return wordClassLabels[node.wordClass];
  if (node.groupType) return groupLabels[node.groupType];
  return "Case…";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function trimTextRange(text: string, range: { start: number; end: number }) {
  let start = range.start;
  let end = range.end;
  while (start < end && /\s/u.test(text[start])) start += 1;
  while (end > start && /\s/u.test(text[end - 1])) end -= 1;
  return { start, end };
}

function snap(value: number) {
  return Math.round(value / GRID) * GRID;
}

const rebaseTextRange = rebaseSharedTextRange;

function rebaseTextAnnotations(box: TreeAnalysisTextBox, nextText: string) {
  return box.annotations.map((annotation) => ({ ...annotation, ...rebaseTextRange(box.text, nextText, annotation.start, annotation.end) })).filter((annotation) => annotation.end > annotation.start);
}

function renderTextBoxContent(box: TreeAnalysisTextBox) {
  return renderSharedAnnotatedText(box.text, box.annotations, "tree-analysis-framed-text");
}

function pagePrintScaleX(page: TreeAnalysisDocumentPage | undefined) {
  return (page?.orientation ?? "landscape") === "portrait" ? 816 / PAGE.logicalWidth : 1;
}

function logicalFontToPoints(fontSize: number, page: TreeAnalysisDocumentPage | undefined) {
  return Math.round(fontSize * pagePrintScaleX(page) * .75 * 10) / 10;
}

function pointsToLogicalFont(points: number, page: TreeAnalysisDocumentPage | undefined) {
  return points / .75 / pagePrintScaleX(page);
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
  const [documentPages, setDocumentPages] = useState<TreeAnalysisDocumentPage[]>(() => initialSentence?.treeAnalysisDocumentPages?.length ? initialSentence.treeAnalysisDocumentPages : [FREE_PAGE("page-1")]);
  const [activePageId, setActivePageId] = useState(() => initialSentence?.treeAnalysisDocumentPages?.[0]?.id ?? "page-1");
  const [questionBadges, setQuestionBadges] = useState<TreeAnalysisQuestionBadge[]>(initialSentence?.treeAnalysisQuestionBadges ?? []);
  const [textBoxes, setTextBoxes] = useState<TreeAnalysisTextBox[]>(() => {
    const existing = initialSentence?.treeAnalysisTextBoxes ?? [];
    const converted = (initialSentence?.treeAnalysisPhrases ?? []).filter((phrase) => !existing.some((box) => box.id === `phrase-text-${phrase.id}`)).map((phrase) => ({ id: `phrase-text-${phrase.id}`, pageId: phrase.pageId ?? "page-1", x: phrase.x, y: phrase.y, width: 1000, height: 70, text: phrase.text, fontSize: phrase.fontSize, annotations: [] }));
    return [...existing, ...converted];
  });
  const [interactions, setInteractions] = useState<TreeAnalysisInteraction[]>(initialSentence?.treeAnalysisInteractions ?? []);
  const [flow, setFlow] = useState<TreeAnalysisFlow>(initialSentence?.treeAnalysisFlow ?? { preset: "tree_functions_tables", orderedStepIds: [], selectionTolerance: "normal" });
  const [interactionModalOpen, setInteractionModalOpen] = useState(false);
  const [interactionKind, setInteractionKind] = useState<"function" | "group" | "nucleus">("function");
  const [interactionNucleusClass, setInteractionNucleusClass] = useState<WordClass>("noun");
  const [interactionResponseMode, setInteractionResponseMode] = useState<"click" | "frame">("frame");
  const [interactionLabel, setInteractionLabel] = useState("Sujet");
  const [interactionInstruction, setInteractionInstruction] = useState("Encadre le sujet de la phrase.");
  const [interactionLinkedNodeId, setInteractionLinkedNodeId] = useState("");
  const [pickingInteractionNode, setPickingInteractionNode] = useState(false);
  const [expandedReaderPhases, setExpandedReaderPhases] = useState<Set<ReaderPhase>>(() => new Set(DEFAULT_PHASE_ORDER));
  const [interactionAuthorMark, setInteractionAuthorMark] = useState<"frame" | "red" | "blue" | "green">("frame");
  const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(null);
  const [editingTextBoxId, setEditingTextBoxId] = useState<string | null>(null);
  const [textSelection, setTextSelection] = useState<{ start: number; end: number } | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedHeader, setSelectedHeader] = useState<"name" | "group" | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const [alignmentGuides, setAlignmentGuides] = useState<{ x?: number; y?: number }>({});
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [scoreModalOpen, setScoreModalOpen] = useState(false);
  const [editingScoreId, setEditingScoreId] = useState<string | null>(null);
  const [scoreEarnedDraft, setScoreEarnedDraft] = useState("");
  const [scoreTotalDraft, setScoreTotalDraft] = useState("10");
  const [scoreSizeDraft, setScoreSizeDraft] = useState<"normal" | "large">("normal");
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
  const textSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const wordRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const builderRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    kind: "node" | "score" | "table" | "phrase" | "textbox" | "textbox-resize" | "header-name" | "header-group" | "question-badge";
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
  const activePage = documentPages.find((page) => page.id === activePageId) ?? documentPages[0];
  const activePageIndex = Math.max(0, documentPages.findIndex((page) => page.id === activePageId));

  function getNodeDimensions(node: TreeAnalysisNode) {
    const nodePage = documentPages.find((page) => page.id === (node.pageId ?? documentPages[0]?.id));
    if (nodePage?.rectanglePreset === "compact") return { width: 78, height: 19 };
    const phrase = phrases.find((item) => item.id === node.phraseId);
    return { width: phrase?.nodeWidth ?? nodeWidth, height: phrase?.nodeHeight ?? nodeHeight };
  }

  function addNode() {
    const phrase = phrases.find((item) => item.id === activePhraseId) ?? phrases[0];
    const compact = activePage?.rectanglePreset === "compact";
    const currentNodeWidth = compact ? 78 : phrase?.nodeWidth ?? nodeWidth;
    const currentNodeHeight = compact ? 19 : phrase?.nodeHeight ?? nodeHeight;
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
      phraseId: phrase?.id,
      pageId: activePageId
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
      id: crypto.randomUUID(), pageId: activePageId, text, x: 8,
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

  function addDocumentPage() {
    const page = activePage?.template === "teaching_document" ? TEACHING_PAGE() : FREE_PAGE();
    setDocumentPages((current) => [...current, page]);
    setActivePageId(page.id);
  }

  function applyPageTemplate(template: "free" | "teaching_document") {
    if (template === "teaching_document") {
      const preset = TEACHING_PAGE(activePageId);
      updateActivePage({ ...preset, id: activePageId });
      return;
    }
    updateActivePage({ template: "free" });
  }

  function addQuestionBadge() {
    const pageBadges = questionBadges.filter((badge) => badge.pageId === activePageId);
    const bannerOffset = activePage?.template === "teaching_document" && (activePage.mainTitle?.enabled ?? true) ? 180 : 135;
    setQuestionBadges((current) => [...current, { id: crypto.randomUUID(), pageId: activePageId, x: activePage?.margins.left ?? 24, y: bannerOffset + pageBadges.length * 78, number: pageBadges.length + 1 }]);
  }

  function updateActivePage(patch: Partial<TreeAnalysisDocumentPage>) {
    setDocumentPages((current) => current.map((page) => page.id === activePageId ? { ...page, ...patch } : page));
  }

  function addTextBox() {
    const teaching = activePage?.template === "teaching_document";
    const bannerOffset = teaching && (activePage.mainTitle?.enabled ?? true) ? 175 : 120;
    const availableWidth = teaching ? PAGE.logicalWidth - activePage.margins.left - activePage.margins.right : PAGE.logicalWidth - 80;
    const box: TreeAnalysisTextBox = { id: crypto.randomUUID(), pageId: activePageId, x: teaching ? activePage.margins.left : 40, y: teaching ? bannerOffset : 90, width: Math.min(420, availableWidth), height: teaching ? 80 : 110, text: "Écris ton texte ici.", fontSize: teaching ? pointsToLogicalFont(11.5, activePage) : 32, textAlign: "left", annotations: [] };
    setTextBoxes((current) => [...current, box]);
    setSelectedTextBoxId(box.id);
    setAddMenuOpen(false);
  }

  function getTextStyle(box: TreeAnalysisTextBox | undefined, selection: { start: number; end: number } | null) {
    if (!box || !selection || selection.start === selection.end) return { color: undefined as string | null | undefined, framed: false, bold: false };
    const marks = box.annotations.filter((item) => item.start <= selection.start && item.end > selection.start);
    return {
      color: [...marks].reverse().find((item) => item.color !== undefined)?.color,
      framed: [...marks].reverse().find((item) => item.framed !== undefined)?.framed ?? false,
      bold: [...marks].reverse().find((item) => item.bold !== undefined)?.bold ?? false
    };
  }

  function applyTextAnnotation(patch: { color?: string | null; framed?: boolean; bold?: boolean }) {
    const selection = textSelectionRef.current ?? textSelection;
    if (!selectedTextBoxId || !selection || selection.start === selection.end) return;
    setTextBoxes((current) => current.map((box) => {
      if (box.id !== selectedTextBoxId) return box;
      const range = patch.framed ? trimTextRange(box.text, selection) : selection;
      return { ...box, annotations: [...box.annotations, { id: crypto.randomUUID(), start: range.start, end: range.end, ...patch }] };
    }));
  }

  function toggleFraming() {
    const removing = selectedTextStyle.framed;
    const selection = textSelectionRef.current ?? textSelection;
    applyTextAnnotation({ framed: !removing });
    if (removing && selectedTextBoxId && selection) {
      setInteractions((current) => current.filter((item) => !(item.textBoxId === selectedTextBoxId && item.start === selection.start && item.end === selection.end && (item.authorMark ?? "frame") === "frame")));
    }
    if (!removing && selectedTextBoxId && selection) {
      setInteractionAuthorMark("frame");
      setInteractionKind("function");
      setInteractionLabel("Sujet");
      setInteractionInstruction("Encadre le sujet de la phrase.");
      setInteractionResponseMode("frame");
      setInteractionLinkedNodeId("");
      setInteractionModalOpen(true);
    }
  }

  function toggleInteractiveColor(color: "#d93434" | "#2467d1" | "#22834b", authorMark: "red" | "blue" | "green") {
    const selection = textSelectionRef.current ?? textSelection;
    const removing = selectedTextStyle.color === color;
    applyTextAnnotation({ color: removing ? null : color });
    if (removing && selectedTextBoxId && selection) {
      setInteractions((current) => current.filter((item) => !(item.textBoxId === selectedTextBoxId && item.start === selection.start && item.end === selection.end && item.authorMark === authorMark)));
    }
    if (!removing && selectedTextBoxId && selection) {
      setInteractionAuthorMark(authorMark);
      setInteractionKind("function");
      setInteractionLabel("Sujet");
      setInteractionInstruction("Encadre le sujet de la phrase.");
      setInteractionResponseMode("frame");
      setInteractionLinkedNodeId("");
      setInteractionModalOpen(true);
    }
  }

  function saveInteraction() {
    const selection = textSelectionRef.current ?? textSelection;
    if (!selectedTextBoxId || !selection || selection.start === selection.end || !interactionLabel.trim() || !interactionInstruction.trim()) return;
    const selectedBox = textBoxes.find((box) => box.id === selectedTextBoxId);
    const range = selectedBox ? trimTextRange(selectedBox.text, selection) : selection;
    const interaction: TreeAnalysisInteraction = {
      id: crypto.randomUUID(),
      textBoxId: selectedTextBoxId,
      start: range.start,
      end: range.end,
      kind: interactionKind,
      label: interactionLabel.trim(),
      instruction: interactionInstruction.trim(),
      linkedNodeId: interactionKind !== "function" && interactionLinkedNodeId ? interactionLinkedNodeId : undefined,
      nucleusWordClass: interactionKind === "nucleus" ? interactionNucleusClass : undefined,
      responseMode: interactionResponseMode,
      authorMark: interactionAuthorMark
    };
    setInteractions((current) => [...current, interaction]);
    if (interactionKind === "nucleus" && interactionLinkedNodeId) {
      setNodes((current) => current.map((node) => node.id === interactionLinkedNodeId ? { ...node, groupType: undefined, wordClass: interactionNucleusClass } : node));
    }
    setInteractionModalOpen(false);
    setPickingInteractionNode(false);
  }

  function cancelInteraction() {
    setInteractionModalOpen(false);
    setPickingInteractionNode(false);
  }

  function captureRenderedTextSelection(box: TreeAnalysisTextBox, element: HTMLDivElement) {
    const selection = captureSharedTextSelection(element);
    if (!selection) return;
    textSelectionRef.current = selection;
    setTextSelection(selection);
    setSelectedTextBoxId(box.id);
  }

  function deleteTextBox(box: TreeAnalysisTextBox) {
    setTextBoxes((current) => current.filter((item) => item.id !== box.id));
    const phraseId = box.id.startsWith("phrase-text-") ? box.id.slice("phrase-text-".length) : null;
    if (!phraseId) return;
    const removedNodeIds = new Set(nodes.filter((node) => node.phraseId === phraseId).map((node) => node.id));
    setPhrases((current) => current.filter((phrase) => phrase.id !== phraseId));
    setNodes((current) => current.filter((node) => node.phraseId !== phraseId));
    setRelations((current) => current.filter((relation) => !removedNodeIds.has(relation.parentNodeId) && !removedNodeIds.has(relation.childNodeId)));
    setSelectedNodeIds((current) => current.filter((id) => !removedNodeIds.has(id)));
    setActivePhraseId((current) => current === phraseId ? null : current);
  }

  function openScoreModal(box?: TreeAnalysisScoreBox) {
    setEditingScoreId(box?.id ?? null);
    setScoreEarnedDraft(box?.earned === undefined ? "" : String(box.earned));
    setScoreTotalDraft(String(box?.total ?? 10));
    setScoreSizeDraft(box?.size ?? "normal");
    setAddMenuOpen(false);
    setScoreModalOpen(true);
  }

  function saveScoreBox() {
    const total = Math.max(1, Math.round(Number(scoreTotalDraft) || 1));
    const earned = scoreEarnedDraft.trim() === "" ? undefined : Math.max(0, Math.round(Number(scoreEarnedDraft) || 0));
    if (editingScoreId) {
      setScoreBoxes((current) => current.map((box) => box.id === editingScoreId ? { ...box, total, earned, size: scoreSizeDraft } : box));
    } else {
      setScoreBoxes((current) => [...current, { id: crypto.randomUUID(), pageId: activePageId, x: 24, y: 160, total, earned, size: scoreSizeDraft }]);
    }
    setScoreModalOpen(false);
  }

  function addActivityTable() {
    const rawRows = window.prompt("Nombre de rangées", "2");
    if (rawRows === null) return;
    const rawColumns = window.prompt("Nombre de colonnes", "3");
    if (rawColumns === null) return;
    const rows = clamp(Math.round(Number(rawRows) || 2), 1, 8);
    const columns = clamp(Math.round(Number(rawColumns) || 3), 1, 8);
    setTables((current) => [...current, {
      id: crypto.randomUUID(), pageId: activePageId, x: 80, y: 420, rows, columns,
      cells: Array.from({ length: rows * columns }, () => ({ text: "", isCorrect: false }))
    }]);
    setAddMenuOpen(false);
  }

  function startItemDrag(event: React.PointerEvent<HTMLElement>, kind: "score" | "table" | "phrase" | "textbox" | "question-badge", item: { id: string; x: number; y: number; size?: "normal" | "large"; width?: number; height?: number }) {
    if (kind !== "phrase" && (event.target as HTMLElement).closest("input,textarea,button")) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    dragRef.current = {
      kind, itemId: item.id,
      width: kind === "question-badge" ? 32 : kind === "score" ? (item.size === "large" ? 180 : 90) : kind === "table" ? 360 : kind === "phrase" ? 1000 : kind === "textbox" ? (item.width ?? 420) : 760,
      height: kind === "question-badge" ? 32 : kind === "score" ? (item.size === "large" ? 92 : 60) : kind === "table" ? 120 : kind === "phrase" ? 60 : kind === "textbox" ? (item.height ?? 80) : 110,
      offsetX: (event.clientX - rect.left) * (PAGE.logicalWidth / rect.width) - item.x,
      offsetY: (event.clientY - rect.top) * (PAGE.logicalHeight / rect.height) - item.y
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function startTextBoxResize(event: React.PointerEvent<HTMLElement>, box: TreeAnalysisTextBox) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    dragRef.current = { kind: "textbox-resize", itemId: box.id, width: box.width, height: box.height, offsetX: (event.clientX - rect.left) * (PAGE.logicalWidth / rect.width) - box.width, offsetY: (event.clientY - rect.top) * (PAGE.logicalHeight / rect.height) - box.height };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function startHeaderDrag(event: React.PointerEvent<HTMLElement>, kind: "header-name" | "header-group") {
    const canvas = canvasRef.current;
    const header = activePage?.header;
    if (!canvas || !header) return;
    const rect = canvas.getBoundingClientRect();
    const x = kind === "header-name" ? header.nameX : header.groupX;
    const y = kind === "header-name" ? header.nameY : header.groupY;
    dragRef.current = { kind, itemId: activePageId, width: header.lineWidth, height: header.fontSize * 1.5, offsetX: (event.clientX - rect.left) * (PAGE.logicalWidth / rect.width) - x, offsetY: (event.clientY - rect.top) * (PAGE.logicalHeight / rect.height) - y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  async function toggleFullscreen() {
    if (!document.fullscreenElement) await builderRef.current?.requestFullscreen();
    else await document.exitFullscreen();
  }

  function printDocument() {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.position = "fixed";
    frame.style.left = "-10000px";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    document.body.appendChild(frame);
    const printWindow = frame.contentWindow;
    if (!printWindow) {
      frame.remove();
      return;
    }
    const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
    const annotated = (box: TreeAnalysisTextBox) => {
      const printableBox = printMode === "answer" ? box : { ...box, annotations: [] };
      return groupSharedTextMarks(printableBox.text, printableBox.annotations).map((group) => `<span class="${group.framed ? "framed-text" : ""}">${group.segments.map((segment) => `<span style="${segment.color ? `color:${segment.color};` : ""}${segment.bold ? "font-weight:700;" : ""}">${escape(segment.text)}</span>`).join("")}</span>`).join("");
    };
    const htmlPages = documentPages.map((page, pageIndex) => {
      const owns = (pageId?: string) => (pageId ?? documentPages[0]?.id) === page.id;
      const outputWidth = page.orientation === "landscape" ? 1056 : 816;
      const outputHeight = page.orientation === "landscape" ? 816 : 1056;
      const scalePrintX = outputWidth / PAGE.logicalWidth;
      const scalePrintY = outputHeight / PAGE.logicalHeight;
      const pageNodes = nodes.filter((node) => owns(node.pageId));
      const nodeHtml = pageNodes.map((node) => { const size = getNodeDimensions(node); return `<div class="node" style="left:${node.x / PAGE.logicalWidth * 100}%;top:${node.y / PAGE.logicalHeight * 100}%;width:${size.width / PAGE.logicalWidth * 100}%;height:${size.height / PAGE.logicalHeight * 100}%">${printMode === "answer" ? escape(getNodeLabel(node)) : ""}</div>`; }).join("");
      const lineHtml = relations.map((relation) => { const parent = pageNodes.find((node) => node.id === relation.parentNodeId); const child = pageNodes.find((node) => node.id === relation.childNodeId); if (!parent || !child) return ""; const ps = getNodeDimensions(parent); const cs = getNodeDimensions(child); return `<line x1="${parent.x + ps.width / 2}" y1="${parent.y + ps.height}" x2="${child.x + cs.width / 2}" y2="${child.y}"/>`; }).join("");
      const phraseHtml = "";
      const scoreHtml = scoreBoxes.filter((item) => owns(item.pageId)).map((item) => `<div class="score ${item.size === "large" ? "large" : ""}" style="left:${item.x / PAGE.logicalWidth * 100}%;top:${item.y / PAGE.logicalHeight * 100}%">${item.earned ?? "___"} / ${item.total}</div>`).join("");
      const tableHtml = tables.filter((item) => owns(item.pageId)).map((table) => `<div class="table" style="left:${table.x / PAGE.logicalWidth * 100}%;top:${table.y / PAGE.logicalHeight * 100}%;grid-template-columns:repeat(${table.columns},1fr)">${table.cells.map((cell) => cell.columnSpan === 0 ? "" : `<div class="cell ${cell.isCorrect && printMode === "answer" ? "correct" : ""}" style="${cell.columnSpan && cell.columnSpan > 1 ? `grid-column:span ${cell.columnSpan}` : ""}">${escape(cell.text)}</div>`).join("")}</div>`).join("");
      const textHtml = textBoxes.filter((item) => item.pageId === page.id).map((box) => `<div class="textbox" style="left:${box.x * scalePrintX}px;top:${box.y * scalePrintY}px;width:${box.width * scalePrintX}px;min-height:${box.height * scalePrintY}px;font-size:${box.fontSize * scalePrintX}px;text-align:${box.textAlign ?? "left"}">${annotated(box)}</div>`).join("");
      const header = page.header ?? { nameX: 12, nameY: 18, groupX: 430, groupY: 18, fontSize: 20, lineWidth: 260 };
      const headerHtml = page.template === "teaching_document"
        ? `<div class="document-header" style="left:${page.margins.left * scalePrintX}px;right:${page.margins.right * scalePrintX}px;top:${header.nameY * scalePrintY}px"><div class="document-header-top"><div class="document-student-fields"><span>NOM</span><span>GROUPE</span></div><div class="document-page-cell"><div class="page-badge">${pageIndex + 1}</div></div></div><div class="document-header-bottom"><div>${escape(header.activityType || "EXERCICES")}</div><div>${escape(header.activityTitle || title || "Les analyses en arbre")}</div></div></div>`
        : `<div class="name" style="display:flex;gap:8px;left:${header.nameX * scalePrintX}px;top:${header.nameY * scalePrintY}px;width:${header.lineWidth * scalePrintX}px;font-size:${header.fontSize * scalePrintX}px">Nom : <span style="flex:1;border-bottom:1.5px solid #111"></span></div><div class="name" style="display:flex;gap:8px;left:${header.groupX * scalePrintX}px;top:${header.groupY * scalePrintY}px;width:${header.lineWidth * scalePrintX}px;font-size:${header.fontSize * scalePrintX}px">Groupe : <span style="flex:1;border-bottom:1.5px solid #111"></span></div>`;
      const mainTitleHtml = page.template === "teaching_document" && (page.mainTitle?.enabled ?? true) ? `<div class="document-title-banner" style="left:${(page.margins.left - 53) * scalePrintX}px;right:${(page.margins.right - 53) * scalePrintX}px;top:${82 * scalePrintY}px"><div class="document-title-line">${escape(page.mainTitle?.prefix || "Exercices")} <span>–</span> ${escape(page.mainTitle?.title || "Les analyses en arbre")}</div><div class="document-title-label">${escape(page.mainTitle?.subtitle || "L’analyse des groupes de mots")}</div></div>` : "";
      const badgeHtml = questionBadges.filter((badge) => badge.pageId === page.id).map((badge) => `<div class="question-badge" style="left:${badge.x * scalePrintX}px;top:${badge.y * scalePrintY}px">${badge.number}</div>`).join("");
      return `<section class="print-page ${page.orientation}"><div class="print-canvas">${headerHtml}${mainTitleHtml}${badgeHtml}${phraseHtml}${textHtml}<svg viewBox="0 0 ${PAGE.logicalWidth} ${PAGE.logicalHeight}" preserveAspectRatio="none">${lineHtml}</svg>${nodeHtml}${scoreHtml}${tableHtml}</div></section>`;
    }).join("");
    printWindow.document.write(`<!doctype html><html><head><title>${escape(title || "Activité")}</title><style>@page{margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:Arial,sans-serif}.print-page{position:relative;overflow:hidden;page-break-after:always;break-after:page}.print-canvas{position:absolute;inset:0}.landscape{width:1056px;height:816px}.portrait{width:816px;height:1056px}.name{position:absolute}.phrase,.textbox,.node,.score,.table{position:absolute}.phrase,.textbox{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.25}.framed-text{box-shadow:0 0 0 2px #111;box-decoration-break:clone;-webkit-box-decoration-break:clone}.node{display:grid;place-items:center;border:2px solid #111}.score{display:grid;width:90px;height:60px;place-items:center;border:2px solid #111;font-size:24px}.score.large{width:180px;height:92px;font-size:36px;font-weight:700}.table{display:grid;width:360px;border-top:2px solid #111;border-left:2px solid #111}.cell{display:grid;min-height:49px;padding:8px;place-items:center;border-right:2px solid #111;border-bottom:2px solid #111;font-size:17px;text-align:center;white-space:pre-wrap}.cell.correct{background:#111;color:#fff}svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}line{stroke:#111;stroke-width:2}</style></head><body>${htmlPages}</body></html>`);
    printWindow.document.write(`<style>@page portraitPage{size:letter portrait;margin:0}@page landscapePage{size:letter landscape;margin:0}.print-page.portrait{page:portraitPage;width:8.5in;height:11in}.print-page.landscape{page:landscapePage;width:11in;height:8.5in}.print-page,.print-page *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}.document-header,.document-title-banner,.page-badge,.question-badge{position:absolute}.document-header{display:grid;grid-template-rows:31px 21px;font-family:'Arial Narrow',Arial,sans-serif}.document-header-top,.document-header-bottom{display:grid;grid-template-columns:77.92% 22.08%}.document-student-fields{display:flex;align-items:end;justify-content:space-between;padding:0 5px 5px 0;border-bottom:1px solid #111;font-family:Arial,sans-serif;font-size:10.67px}.document-page-cell{position:relative}.document-header-bottom>div{display:flex;align-items:center;height:21px;padding:3px 5px 0;border-top:1px solid #111;font-size:9.33px}.document-header-bottom>div:first-child{justify-content:flex-end;border-right:1px solid #111}.document-header-bottom>div:last-child{border-left:1px solid #111}.document-title-banner{height:95px;padding:20px 36px 9px;background:linear-gradient(to bottom,#d3d3d3 0%,#bfbfbf 100%)}.document-title-line{font-family:'Arial Narrow',Arial,sans-serif;font-size:24px;font-weight:700;line-height:1.1;white-space:nowrap}.document-title-label{display:inline-flex;height:35px;margin-top:12px;padding:0 7px;align-items:center;background:#000!important;color:#fff!important;font-family:'Arial Narrow',Arial,sans-serif;font-size:26.67px;font-weight:700;line-height:1;white-space:nowrap}.page-badge,.question-badge{display:grid;place-items:center;width:29px;height:29px;border-radius:50%;background:#555!important;color:#fff!important;font-weight:700;box-shadow:inset 0 0 0 1px #7f7f7f}.page-badge{top:0;right:5px;font-size:18.67px}.question-badge{background:#111!important;font-size:16px}.textbox{line-height:1.1}</style>`);
    printWindow.document.write(`<style>.document-title-banner{height:104px!important}.framed-text{padding:0 .08em;margin:0 .1em}.print-page.landscape .framed-text{padding-inline:0;margin-inline:0}</style>`);
    printWindow.document.close();
    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      printWindow.addEventListener("afterprint", () => frame.remove(), { once: true });
    }, 100);
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
    if (pickingInteractionNode) {
      event.stopPropagation();
      setInteractionLinkedNodeId(node.id);
      if (interactionKind === "group") {
        setInteractionLabel(getNodeLabel(node) || "Groupe");
        setInteractionInstruction("Encadre le groupe lié à ce rectangle.");
      }
      setPickingInteractionNode(false);
      setInteractionModalOpen(true);
      return;
    }
    setSelectedTextBoxId(null);
    setEditingTextBoxId(null);
    setSelectedTableId(null);
    setSelectedHeader(null);
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
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = PAGE.logicalWidth / rect.width;
    const scaleY = PAGE.logicalHeight / rect.height;

    if (!drag && selectionBox) {
      setSelectionBox((current) => current ? { ...current, x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY } : null);
      return;
    }
    if (!drag) return;

    let logicalX =
      (event.clientX - rect.left) * scaleX - drag.offsetX;
    let logicalY =
      (event.clientY - rect.top) * scaleY - drag.offsetY;

    if ((drag.kind === "textbox" || drag.kind === "question-badge" || drag.kind === "node") && !event.altKey) {
      const page = activePage;
      const xCandidates = [page?.margins.left ?? 0];
      const yCandidates = [page?.margins.top ?? 0];
      if (drag.kind === "node") {
        nodes.filter((node) => (node.pageId ?? documentPages[0]?.id) === activePageId && node.id !== drag.itemId).forEach((node) => {
          const size = getNodeDimensions(node);
          xCandidates.push(node.x, node.x + size.width / 2, node.x + size.width);
          yCandidates.push(node.y, node.y + size.height / 2, node.y + size.height);
        });
      } else if (drag.kind === "textbox") {
        textBoxes.filter((box) => box.pageId === activePageId && box.id !== drag.itemId).forEach((box) => {
          xCandidates.push(box.x);
          yCandidates.push(box.y);
        });
        questionBadges.filter((badge) => badge.pageId === activePageId).forEach((badge) => xCandidates.push(badge.x + 16));
      } else {
        questionBadges.filter((badge) => badge.pageId === activePageId && badge.id !== drag.itemId).forEach((badge) => {
          xCandidates.push(badge.x, badge.x + 16);
          yCandidates.push(badge.y, badge.y + 16);
        });
      }
      const movingXPoints = drag.kind === "question-badge" ? [{ value: logicalX, offset: 0 }, { value: logicalX + 16, offset: 16 }] : drag.kind === "node" ? [{ value: logicalX, offset: 0 }, { value: logicalX + drag.width / 2, offset: drag.width / 2 }, { value: logicalX + drag.width, offset: drag.width }] : [{ value: logicalX, offset: 0 }];
      const movingYPoints = drag.kind === "question-badge" ? [{ value: logicalY, offset: 0 }, { value: logicalY + 16, offset: 16 }] : drag.kind === "node" ? [{ value: logicalY, offset: 0 }, { value: logicalY + drag.height / 2, offset: drag.height / 2 }, { value: logicalY + drag.height, offset: drag.height }] : [{ value: logicalY, offset: 0 }];
      const xMatch = movingXPoints.flatMap((point) => xCandidates.map((candidate) => ({ candidate, offset: point.offset, distance: Math.abs(point.value - candidate) }))).sort((a, b) => a.distance - b.distance)[0];
      const yMatch = movingYPoints.flatMap((point) => yCandidates.map((candidate) => ({ candidate, offset: point.offset, distance: Math.abs(point.value - candidate) }))).sort((a, b) => a.distance - b.distance)[0];
      const nextGuides: { x?: number; y?: number } = {};
      if (xMatch && xMatch.distance <= ALIGNMENT_TOLERANCE) { logicalX = xMatch.candidate - xMatch.offset; nextGuides.x = xMatch.candidate; }
      if (yMatch && yMatch.distance <= ALIGNMENT_TOLERANCE) { logicalY = yMatch.candidate - yMatch.offset; nextGuides.y = yMatch.candidate; }
      setAlignmentGuides(nextGuides);
    } else if (alignmentGuides.x !== undefined || alignmentGuides.y !== undefined) {
      setAlignmentGuides({});
    }

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
          ? { ...box, x: clamp(snap(logicalX), 0, PAGE.logicalWidth - drag.width), y: clamp(snap(logicalY), TREE_TOP, TREE_BOTTOM - drag.height) }
          : box
      ));
      return;
    }

    if (drag.kind === "question-badge") {
      setQuestionBadges((current) => current.map((badge) => badge.id === drag.itemId ? { ...badge, x: clamp(logicalX, 0, PAGE.logicalWidth - 32), y: clamp(logicalY, 0, PAGE.logicalHeight - 32) } : badge));
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

    if (drag.kind === "textbox") {
      setTextBoxes((current) => current.map((box) => box.id === drag.itemId ? { ...box, x: clamp(logicalX, 0, PAGE.logicalWidth - box.width), y: clamp(logicalY, 0, PAGE.logicalHeight - box.height) } : box));
      return;
    }

    if (drag.kind === "textbox-resize") {
      setTextBoxes((current) => current.map((box) => box.id === drag.itemId ? { ...box, width: clamp(logicalX, 32, PAGE.logicalWidth - box.x), height: clamp(logicalY, 24, PAGE.logicalHeight - box.y) } : box));
      return;
    }

    if (drag.kind === "header-name" || drag.kind === "header-group") {
      const x = clamp(logicalX, 0, PAGE.logicalWidth - drag.width);
      const y = clamp(logicalY, 0, PAGE.logicalHeight - drag.height);
      setDocumentPages((current) => current.map((page) => page.id === activePageId ? { ...page, header: { ...(page.header ?? { nameX: 12, nameY: 18, groupX: 430, groupY: 18, fontSize: 20, lineWidth: 260 }), ...(drag.kind === "header-name" ? { nameX: x, nameY: y } : { groupX: x, groupY: y }) } } : page));
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
    setAlignmentGuides({});
    if (selectionBox) {
      const left = Math.min(selectionBox.startX, selectionBox.x);
      const right = Math.max(selectionBox.startX, selectionBox.x);
      const top = Math.min(selectionBox.startY, selectionBox.y);
      const bottom = Math.max(selectionBox.startY, selectionBox.y);
      setSelectedNodeIds(nodes.filter((node) => (node.pageId ?? documentPages[0]?.id) === activePageId && node.x < right && node.x + getNodeDimensions(node).width > left && node.y < bottom && node.y + getNodeDimensions(node).height > top).map((node) => node.id));
      setSelectionBox(null);
    }
  }

  function startCanvasSelection(event: React.PointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (PAGE.logicalWidth / rect.width);
    const y = (event.clientY - rect.top) * (PAGE.logicalHeight / rect.height);
    setEditingTextBoxId(null);
    setSelectedTextBoxId(null);
    setSelectedTableId(null);
    setSelectedHeader(null);
    setSelectionBox({ startX: x, startY: y, x, y });
    event.currentTarget.setPointerCapture(event.pointerId);
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

  function getPagePhaseSteps(page: TreeAnalysisDocumentPage) {
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
    return { phases, order: order.filter((phase) => phases[phase].length > 0) };
  }

  function saveActivity() {
    if (!phrases.length || !title.trim() || !levelId) return;
    const now = new Date().toISOString();

    const automaticSteps = documentPages.flatMap((page) => { const detected = getPagePhaseSteps(page); return detected.order.flatMap((phase) => detected.phases[phase]); });
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
      treeAnalysisDocumentPages: documentPages,
      treeAnalysisQuestionBadges: questionBadges,
      treeAnalysisTextBoxes: textBoxes,
      treeAnalysisInteractions: interactions,
      treeAnalysisFlow: { ...flow, orderedStepIds: automaticSteps },
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

  const selectedTextBox = textBoxes.find((box) => box.id === selectedTextBoxId);
  const selectedTextBoxPage = documentPages.find((page) => page.id === selectedTextBox?.pageId);
  const selectedInteractionNode = nodes.find((node) => node.id === interactionLinkedNodeId);
  const activeDetectedPhases = activePage ? getPagePhaseSteps(activePage) : null;
  const moveReaderPhase = (phase: ReaderPhase, direction: -1 | 1) => {
    if (!activePage || !activeDetectedPhases) return;
    const order = [...activeDetectedPhases.order];
    const index = order.indexOf(phase);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return;
    [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
    updateActivePage({ readerPhaseOrder: [...order, ...DEFAULT_PHASE_ORDER.filter((item) => !order.includes(item))] });
  };
  const readerActionLabel = (stepId: string) => {
    const [kind, id] = stepId.split(":");
    if (kind === "interaction") {
      const item = interactions.find((interaction) => interaction.id === id);
      return item ? `${item.instruction} — ${item.label}${item.linkedNodeId ? " · rectangle lié" : ""}` : "Événement interactif";
    }
    if (kind === "node") return `Remplir le rectangle — ${getNodeLabel(nodes.find((node) => node.id === id) ?? { id: "", x: 0, y: 0 }) || "réponse à définir"}`;
    return "Répondre au tableau";
  };
  const selectedTextStyle = getTextStyle(selectedTextBox, textSelectionRef.current ?? textSelection);

  return (
    <div className="tree-analysis-editor">
      <span
        ref={measureRef}
        className="tree-analysis-measure"
        aria-hidden="true"
      >
        {trimmed || " "}
      </span>

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
                <Button type="button" variant="secondary" className="tree-analysis-fullscreen-toggle" onClick={toggleFullscreen}>
                  {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                  {isFullscreen ? "Retour" : "Plein écran"}
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
                <Button type="button" variant="secondary" onClick={printDocument}>
                  <Printer size={17} />
                  Imprimer
                </Button>
              </div>
            </div>

            <div className="tree-analysis-builder-meta">
              <label>Titre<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Titre de l’activité" /></label>
              <label>Niveau<select value={levelId} onChange={(event) => setLevelId(event.target.value)}>{levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></label>
            </div>
            <div className="tree-analysis-page-controls">
              <div>{documentPages.map((page, index) => <button type="button" key={page.id} className={page.id === activePageId ? "active" : ""} onClick={() => setActivePageId(page.id)}>Page {index + 1}</button>)}<button type="button" onClick={addDocumentPage}><Plus size={15} /> Page</button></div>
              <label>Gabarit<select value={activePage?.template ?? "free"} onChange={(event) => applyPageTemplate(event.target.value as "free" | "teaching_document")}><option value="free">Page libre</option><option value="teaching_document">Document pédagogique</option></select></label>
              <label>Orientation<select value={documentPages.find((page) => page.id === activePageId)?.orientation ?? "landscape"} onChange={(event) => updateActivePage({ orientation: event.target.value as "portrait" | "landscape" })}><option value="landscape">Paysage</option><option value="portrait">Portrait</option></select></label>
              <label>Rectangles<select value={activePage?.rectanglePreset ?? "normal"} onChange={(event) => updateActivePage({ rectanglePreset: event.target.value as "normal" | "compact" })}><option value="normal">Normaux</option><option value="compact">Compacts</option></select></label>
              {(["top", "right", "bottom", "left"] as const).map((side) => <label key={side}>Marge {side}<input type="number" min="0" max="180" value={documentPages.find((page) => page.id === activePageId)?.margins[side] ?? 24} onChange={(event) => { const page = documentPages.find((item) => item.id === activePageId); if (page) updateActivePage({ margins: { ...page.margins, [side]: Number(event.target.value) } }); }} /></label>)}
            </div>
            <div className="tree-analysis-quick-add" aria-label="Ajouter à la page">
              <span>Ajouter à la page</span>
              <Button type="button" onClick={addTextBox}><span className="tree-analysis-add-icon">T</span> Texte</Button>
              <Button type="button" variant="secondary" onClick={addNode}><span className="tree-analysis-add-icon">□</span> Rectangle</Button>
              <Button type="button" variant="secondary" onClick={() => openScoreModal()}><span className="tree-analysis-add-icon">/x</span> Points</Button>
              <Button type="button" variant="secondary" onClick={addActivityTable}><Grid3X3 size={17} /> Tableau</Button>
              <Button type="button" variant="secondary" onClick={addQuestionBadge}><span className="tree-analysis-add-icon">1</span> Numéro</Button>
              <Button type="button" variant="secondary" onClick={() => setSelectedNodeIds(nodes.filter((node) => (node.pageId ?? documentPages[0]?.id) === activePageId).map((node) => node.id))}>Sélectionner les rectangles</Button>
            </div>
            {selectedTextBoxId && (
              <div className="tree-analysis-text-toolbar" onMouseDown={(event) => {
                if ((event.target as HTMLElement).closest("button")) event.preventDefault();
              }}>
                <label>Taille (pt) <input type="number" min="8" max="72" step="0.5" value={selectedTextBox ? logicalFontToPoints(selectedTextBox.fontSize, selectedTextBoxPage) : 12} onChange={(event) => setTextBoxes((current) => current.map((box) => box.id === selectedTextBoxId ? { ...box, fontSize: pointsToLogicalFont(Number(event.target.value), selectedTextBoxPage) } : box))} /></label>
                <button type="button" aria-label="Aligner le texte à gauche" title="Aligner à gauche" className={(selectedTextBox?.textAlign ?? "left") === "left" ? "active" : ""} onClick={() => setTextBoxes((current) => current.map((box) => box.id === selectedTextBoxId ? { ...box, textAlign: "left" } : box))}><AlignLeft size={17} /></button>
                <button type="button" aria-label="Centrer le texte" title="Centrer" className={selectedTextBox?.textAlign === "center" ? "active" : ""} onClick={() => setTextBoxes((current) => current.map((box) => box.id === selectedTextBoxId ? { ...box, textAlign: "center" } : box))}><AlignCenter size={17} /></button>
                <button type="button" aria-label="Justifier le texte" title="Justifier" className={selectedTextBox?.textAlign === "justify" ? "active" : ""} onClick={() => setTextBoxes((current) => current.map((box) => box.id === selectedTextBoxId ? { ...box, textAlign: "justify" } : box))}><AlignJustify size={17} /></button>
                <label>Largeur <input type="number" min="120" max="1056" value={textBoxes.find((box) => box.id === selectedTextBoxId)?.width ?? 760} onChange={(event) => setTextBoxes((current) => current.map((box) => box.id === selectedTextBoxId ? { ...box, width: Number(event.target.value) } : box))} /></label>
                <label>Hauteur <input type="number" min="50" max="816" value={textBoxes.find((box) => box.id === selectedTextBoxId)?.height ?? 110} onChange={(event) => setTextBoxes((current) => current.map((box) => box.id === selectedTextBoxId ? { ...box, height: Number(event.target.value) } : box))} /></label>
                <button type="button" className={selectedTextStyle.color === "#d93434" ? "active" : ""} aria-pressed={selectedTextStyle.color === "#d93434"} onClick={() => toggleInteractiveColor("#d93434", "red")}>Rouge</button>
                <button type="button" className={selectedTextStyle.color === "#2467d1" ? "active" : ""} aria-pressed={selectedTextStyle.color === "#2467d1"} onClick={() => toggleInteractiveColor("#2467d1", "blue")}>Bleu</button>
                <button type="button" className={selectedTextStyle.color === "#22834b" ? "active" : ""} aria-pressed={selectedTextStyle.color === "#22834b"} onClick={() => toggleInteractiveColor("#22834b", "green")}>Vert</button>
                <button type="button" className={selectedTextStyle.framed ? "active" : ""} aria-pressed={selectedTextStyle.framed} onClick={toggleFraming}>Encadrer</button>
                <button type="button" className={selectedTextStyle.bold ? "active" : ""} aria-pressed={selectedTextStyle.bold} onClick={() => applyTextAnnotation({ bold: !selectedTextStyle.bold })}>Gras</button>
              </div>
            )}
            {selectedHeader && (
              <div className="tree-analysis-text-toolbar">
                <strong>{selectedHeader === "name" ? "Nom" : "Groupe"}</strong>
                <label>Taille de police<input type="number" min="12" max="64" value={activePage?.header?.fontSize ?? 20} onChange={(event) => updateActivePage({ header: { ...(activePage?.header ?? { nameX: 12, nameY: 18, groupX: 430, groupY: 18, fontSize: 20, lineWidth: 260 }), fontSize: Number(event.target.value) } })} /></label>
                <label>Longueur de la ligne<input type="number" min="120" max="600" value={activePage?.header?.lineWidth ?? 260} onChange={(event) => updateActivePage({ header: { ...(activePage?.header ?? { nameX: 12, nameY: 18, groupX: 430, groupY: 18, fontSize: 20, lineWidth: 260 }), lineWidth: Number(event.target.value) } })} /></label>
              </div>
            )}
            {activePage?.template === "teaching_document" && (
              <div className="tree-analysis-document-header-controls">
                <label>Type d’activité<input value={activePage.header?.activityType ?? "EXERCICES"} onChange={(event) => updateActivePage({ header: { ...(activePage.header!), activityType: event.target.value } })} /></label>
                <label>Titre dans l’entête<input value={activePage.header?.activityTitle ?? "Les analyses en arbre"} onChange={(event) => updateActivePage({ header: { ...(activePage.header!), activityTitle: event.target.value } })} /></label>
                <label className="tree-analysis-main-title-toggle"><input type="checkbox" checked={activePage.mainTitle?.enabled ?? true} onChange={(event) => updateActivePage({ mainTitle: { enabled: event.target.checked, prefix: activePage.mainTitle?.prefix ?? "Exercices", title: activePage.mainTitle?.title ?? "Les analyses en arbre", subtitle: activePage.mainTitle?.subtitle ?? "L’analyse des groupes de mots" } })} /> Afficher le grand bandeau</label>
                {(activePage.mainTitle?.enabled ?? true) && <>
                  <label>Première partie du titre<input value={activePage.mainTitle?.prefix ?? "Exercices"} onChange={(event) => updateActivePage({ mainTitle: { enabled: true, prefix: event.target.value, title: activePage.mainTitle?.title ?? "Les analyses en arbre", subtitle: activePage.mainTitle?.subtitle ?? "L’analyse des groupes de mots" } })} /></label>
                  <label>Deuxième partie du titre<input value={activePage.mainTitle?.title ?? "Les analyses en arbre"} onChange={(event) => updateActivePage({ mainTitle: { enabled: true, prefix: activePage.mainTitle?.prefix ?? "Exercices", title: event.target.value, subtitle: activePage.mainTitle?.subtitle ?? "L’analyse des groupes de mots" } })} /></label>
                  <label>Sous-titre dans la barre noire<input value={activePage.mainTitle?.subtitle ?? "L’analyse des groupes de mots"} onChange={(event) => updateActivePage({ mainTitle: { enabled: true, prefix: activePage.mainTitle?.prefix ?? "Exercices", title: activePage.mainTitle?.title ?? "Les analyses en arbre", subtitle: event.target.value } })} /></label>
                </>}
              </div>
            )}

            {linkingParentId && (
              <div className="tree-analysis-link-hint">
                <Link2 size={17} />
                Clique maintenant sur le rectangle enfant.
              </div>
            )}
            {pickingInteractionNode && (
              <div className="tree-analysis-link-hint">
                <Link2 size={17} />
                <strong>Choisis le rectangle lié directement dans l’arbre.</strong>
                <Button type="button" variant="secondary" onClick={() => { setPickingInteractionNode(false); setInteractionModalOpen(true); }}>Retour à la fenêtre</Button>
              </div>
            )}

            <div className={`tree-analysis-box-size ${boxesFitOnOneRow ? "success" : "warning"}`}>
              Cases uniformes : {nodeWidth} × {nodeHeight} — calculées pour {wordCount} mot{wordCount > 1 ? "s" : ""}.
            </div>

            <section className="tree-analysis-flow-panel">
              <div><span className="eyebrow">Déroulement du lecteur</span><h3>Ordre de l’activité</h3></div>
              <p>Les phases sont créées automatiquement à partir des événements, rectangles et tableaux présents sur cette page.</p>
              <label>Tolérance de sélection<select value={flow.selectionTolerance} onChange={(event) => setFlow((current) => ({ ...current, selectionTolerance: event.target.value as TreeAnalysisFlow["selectionTolerance"] }))}><option value="strict">Stricte</option><option value="normal">Normale</option><option value="permissive">Permissive</option></select></label>
              <div className="tree-analysis-phase-list">{activeDetectedPhases?.order.map((phase, index) => { const expanded = expandedReaderPhases.has(phase); return <div className="tree-analysis-phase" key={phase}><div className="tree-analysis-phase-heading"><button type="button" className="tree-analysis-phase-toggle" onClick={() => setExpandedReaderPhases((current) => { const next = new Set(current); if (next.has(phase)) next.delete(phase); else next.add(phase); return next; })} aria-expanded={expanded}>{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button><span>{index + 1}</span><strong>{phaseLabels[phase]} ({activeDetectedPhases.phases[phase].length})</strong><button type="button" onClick={() => moveReaderPhase(phase, -1)} disabled={index === 0} aria-label="Monter"><ChevronUp size={15} /></button><button type="button" onClick={() => moveReaderPhase(phase, 1)} disabled={index === activeDetectedPhases.order.length - 1} aria-label="Descendre"><ChevronDown size={15} /></button></div>{expanded && <div className="tree-analysis-phase-actions">{activeDetectedPhases.phases[phase].map((stepId) => <div key={stepId}><span className="tree-analysis-phase-branch">↳</span><strong>{readerActionLabel(stepId)}</strong>{stepId.startsWith("interaction:") && <button type="button" onClick={() => setInteractions((current) => current.filter((item) => `interaction:${item.id}` !== stepId))} aria-label="Supprimer l’événement"><X size={14} /></button>}</div>)}</div>}</div>; })}</div>
              {!activeDetectedPhases?.order.length && <p>Encadre un passage ou ajoute un rectangle ou un tableau pour créer les premières phases.</p>}
            </section>

            <div className={`tree-analysis-workspace tree-print-${printMode}`}>
              <div className="tree-analysis-page-shell builder">
                <div
                ref={canvasRef}
                className={`tree-analysis-page tree-analysis-canvas ${
                  linkingParentId ? "linking" : ""
                } ${activePage?.orientation === "portrait" ? "portrait" : "landscape"} ${activePage?.template === "teaching_document" ? "document-template" : ""}`}
                style={{
                  "--page-margin-top": `${((activePage?.margins.top ?? 24) / PAGE.logicalHeight) * 100}%`,
                  "--page-margin-right": `${((activePage?.margins.right ?? 24) / PAGE.logicalWidth) * 100}%`,
                  "--page-margin-bottom": `${((activePage?.margins.bottom ?? 24) / PAGE.logicalHeight) * 100}%`,
                  "--page-margin-left": `${((activePage?.margins.left ?? 24) / PAGE.logicalWidth) * 100}%`
                } as React.CSSProperties}
                onPointerDown={startCanvasSelection}
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
                {alignmentGuides.x !== undefined && <div className="tree-analysis-alignment-guide vertical" style={{ left: `${(alignmentGuides.x / PAGE.logicalWidth) * 100}%` }} />}
                {alignmentGuides.y !== undefined && <div className="tree-analysis-alignment-guide horizontal" style={{ top: `${(alignmentGuides.y / PAGE.logicalHeight) * 100}%` }} />}
                {selectionBox && <div className="tree-analysis-selection-box" style={{ left: `${(Math.min(selectionBox.startX, selectionBox.x) / PAGE.logicalWidth) * 100}%`, top: `${(Math.min(selectionBox.startY, selectionBox.y) / PAGE.logicalHeight) * 100}%`, width: `${(Math.abs(selectionBox.x - selectionBox.startX) / PAGE.logicalWidth) * 100}%`, height: `${(Math.abs(selectionBox.y - selectionBox.startY) / PAGE.logicalHeight) * 100}%` }} />}

                {activePage?.template === "teaching_document" ? (
                  <div className="tree-analysis-document-header" style={{ left: `${(activePage.margins.left / PAGE.logicalWidth) * 100}%`, right: `${(activePage.margins.right / PAGE.logicalWidth) * 100}%`, top: `${((activePage.header?.nameY ?? 25) / PAGE.logicalHeight) * 100}%` }}>
                    <div className="tree-analysis-document-header-top"><div className="tree-analysis-student-fields"><span>NOM</span><span>GROUPE</span></div><div className="tree-analysis-page-cell"><div className="tree-analysis-page-badge">{activePageIndex + 1}</div></div></div>
                    <div className="tree-analysis-document-header-bottom"><div>{activePage.header?.activityType || "EXERCICES"}</div><div>{activePage.header?.activityTitle || title || "Les analyses en arbre"}</div></div>
                  </div>
                ) : <>
                  <div className={`tree-analysis-name-line movable ${selectedHeader === "name" ? "selected" : ""}`} style={{ left: `${((activePage?.header?.nameX ?? 12) / PAGE.logicalWidth) * 100}%`, top: `${((activePage?.header?.nameY ?? 18) / PAGE.logicalHeight) * 100}%`, width: `${((activePage?.header?.lineWidth ?? 260) / PAGE.logicalWidth) * 100}%`, fontSize: `${((activePage?.header?.fontSize ?? 20) / PAGE.logicalWidth) * 100}cqw` }} onPointerDown={(event) => { setSelectedHeader("name"); setSelectedTextBoxId(null); setSelectedTableId(null); startHeaderDrag(event, "header-name"); }}>Nom : <span /></div>
                  <div className={`tree-analysis-name-line movable ${selectedHeader === "group" ? "selected" : ""}`} style={{ left: `${((activePage?.header?.groupX ?? 430) / PAGE.logicalWidth) * 100}%`, top: `${((activePage?.header?.groupY ?? 18) / PAGE.logicalHeight) * 100}%`, width: `${((activePage?.header?.lineWidth ?? 260) / PAGE.logicalWidth) * 100}%`, fontSize: `${((activePage?.header?.fontSize ?? 20) / PAGE.logicalWidth) * 100}cqw` }} onPointerDown={(event) => { setSelectedHeader("group"); setSelectedTextBoxId(null); setSelectedTableId(null); startHeaderDrag(event, "header-group"); }}>Groupe : <span /></div>
                </>}
                {activePage?.template === "teaching_document" && (activePage.mainTitle?.enabled ?? true) && <div className="tree-analysis-document-title-banner" style={{ left: `${((activePage.margins.left - 53) / PAGE.logicalWidth) * 100}%`, right: `${((activePage.margins.right - 53) / PAGE.logicalWidth) * 100}%`, top: `${(82 / PAGE.logicalHeight) * 100}%` }}><div className="tree-analysis-document-title-line">{activePage.mainTitle?.prefix || "Exercices"} <span>–</span> {activePage.mainTitle?.title || "Les analyses en arbre"}</div><div className="tree-analysis-document-title-label">{activePage.mainTitle?.subtitle || "L’analyse des groupes de mots"}</div></div>}
                {questionBadges.filter((badge) => badge.pageId === activePageId).map((badge) => <div key={badge.id} className="tree-analysis-question-badge" style={{ left: `${(badge.x / PAGE.logicalWidth) * 100}%`, top: `${(badge.y / PAGE.logicalHeight) * 100}%` }} onPointerDown={(event) => startItemDrag(event, "question-badge", badge)} onDoubleClick={() => { const raw = window.prompt("Numéro", String(badge.number)); if (raw !== null) setQuestionBadges((current) => current.map((item) => item.id === badge.id ? { ...item, number: Math.max(1, Math.round(Number(raw) || 1)) } : item)); }}><span>{badge.number}</span><button type="button" aria-label="Supprimer le numéro" onClick={(event) => { event.stopPropagation(); setQuestionBadges((current) => current.filter((item) => item.id !== badge.id)); }}><X size={10} /></button></div>)}

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
                    if ((parent.pageId ?? documentPages[0]?.id) !== activePageId || (child.pageId ?? documentPages[0]?.id) !== activePageId) return null;

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

                {nodes.filter((node) => (node.pageId ?? documentPages[0]?.id) === activePageId).map((node) => {
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
                {scoreBoxes.filter((box) => (box.pageId ?? documentPages[0]?.id) === activePageId).map((box) => (
                  <div
                    key={box.id}
                    className={`tree-analysis-score-box ${box.size === "large" ? "large" : ""}`}
                    style={{ left: `${(box.x / PAGE.logicalWidth) * 100}%`, top: `${(box.y / PAGE.logicalHeight) * 100}%` }}
                    onPointerDown={(event) => startItemDrag(event, "score", box)}
                    onDoubleClick={() => openScoreModal(box)}
                  >
                    <span>{box.earned ?? "___"} / {box.total}</span>
                    <button type="button" onClick={() => setScoreBoxes((current) => current.filter((item) => item.id !== box.id))} aria-label="Supprimer la boîte"><X size={13} /></button>
                  </div>
                ))}
                {tables.filter((table) => (table.pageId ?? documentPages[0]?.id) === activePageId).map((table) => (
                  <div
                    key={table.id}
                    className={`tree-analysis-activity-table ${selectedTableId === table.id ? "selected" : ""}`}
                    style={{ left: `${(table.x / PAGE.logicalWidth) * 100}%`, top: `${(table.y / PAGE.logicalHeight) * 100}%`, gridTemplateColumns: `repeat(${table.columns}, minmax(0, 1fr))` }}
                    onPointerDown={(event) => startItemDrag(event, "table", table)}
                    onClick={() => { setSelectedTableId(table.id); setSelectedTextBoxId(null); setEditingTextBoxId(null); setSelectedHeader(null); }}
                  >
                    {selectedTableId === table.id && !(table.cells[0]?.columnSpan && table.cells[0].columnSpan > 1) && <button type="button" className="tree-analysis-merge-row" onClick={() => setTables((current) => current.map((item) => item.id === table.id ? { ...item, cells: item.cells.map((cell, index) => index === 0 ? { ...cell, columnSpan: table.columns } : index < table.columns ? { ...cell, columnSpan: 0 } : cell) } : item))}>Fusionner la 1re rangée</button>}
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
                    {selectedTableId === table.id && <button type="button" className="tree-analysis-delete-table" onClick={() => { setTables((current) => current.filter((item) => item.id !== table.id)); setSelectedTableId(null); }} aria-label="Supprimer le tableau"><X size={13} /></button>}
                  </div>
                ))}
                {textBoxes.filter((box) => box.pageId === activePageId).map((box) => (
                  <div
                    key={box.id}
                    className={`tree-analysis-text-box ${selectedTextBoxId === box.id ? "selected" : ""}`}
                    style={{ left: `${(box.x / PAGE.logicalWidth) * 100}%`, top: `${(box.y / PAGE.logicalHeight) * 100}%`, width: `${(box.width / PAGE.logicalWidth) * 100}%`, minHeight: `${(box.height / PAGE.logicalHeight) * 100}%`, fontSize: `${(box.fontSize / PAGE.logicalWidth) * 100}cqw`, textAlign: box.textAlign ?? "left" }}
                    onClick={() => { setSelectedTextBoxId(box.id); setSelectedTableId(null); setSelectedHeader(null); }}
                    onPointerDown={(event) => {
                      if (editingTextBoxId !== box.id && !(event.target as HTMLElement).closest("button,.tree-analysis-text-resize,.tree-analysis-text-move-handle,.tree-analysis-text-content,textarea")) startItemDrag(event, "textbox", box);
                    }}
                  >
                    {selectedTextBoxId === box.id && <button type="button" className="tree-analysis-text-delete" onClick={(event) => { event.stopPropagation(); deleteTextBox(box); setSelectedTextBoxId(null); setEditingTextBoxId(null); }} aria-label="Supprimer la boîte"><X size={14} /></button>}
                    {selectedTextBoxId === box.id && <span className="tree-analysis-text-resize" onPointerDown={(event) => startTextBoxResize(event, box)} />}
                    {selectedTextBoxId === box.id && <span className="tree-analysis-text-move-handle" title="Glisser pour déplacer" onPointerDown={(event) => { event.stopPropagation(); startItemDrag(event, "textbox", box); }} />}
                    <div
                      key={`content-${box.id}-${box.annotations.map((annotation) => `${annotation.id}:${annotation.color ?? ""}:${annotation.framed ? 1 : 0}:${annotation.bold ? 1 : 0}`).join("|")}`}
                      className="tree-analysis-text-content"
                      data-placeholder="Écris ton texte ici…"
                      contentEditable
                      suppressContentEditableWarning
                      spellCheck
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        setSelectedTextBoxId(box.id);
                        setSelectedTableId(null);
                        setSelectedHeader(null);
                      }}
                      onInput={(event) => {
                        const nextText = event.currentTarget.innerText.replace(/\r/g, "");
                        setTextBoxes((current) => current.map((item) => item.id === box.id ? { ...item, text: nextText, annotations: rebaseTextAnnotations(item, nextText) } : item));
                        setInteractions((current) => current.map((item) => item.textBoxId === box.id ? { ...item, ...rebaseTextRange(box.text, nextText, item.start, item.end) } : item).filter((item) => item.end > item.start));
                      }}
                      onMouseUp={(event) => captureRenderedTextSelection(box, event.currentTarget)}
                      onKeyUp={(event) => captureRenderedTextSelection(box, event.currentTarget)}
                    >
                      {renderTextBoxContent(box)}
                    </div>
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
                      <button type="button" onClick={() => openScoreModal()}><span className="tree-analysis-add-icon">/x</span><strong>Boîte de points</strong><small>Affiche un résultat comme 8 / 10</small></button>
                      <button type="button" onClick={addActivityTable}><Grid3X3 size={25} /><strong>Tableau d’activité</strong><small>Rangées, colonnes et réponses</small></button>
                      <button type="button" onClick={addTextBox}><span className="tree-analysis-add-icon">T</span><strong>Boîte de texte</strong><small>Texte libre, couleurs et encadrements</small></button>
                    </div>
                  </aside>
                </div>
              )}
              {scoreModalOpen && (
                <div className="tree-analysis-modal-backdrop" role="presentation" onMouseDown={(event) => {
                  if (event.target === event.currentTarget) setScoreModalOpen(false);
                }}>
                  <aside className="tree-analysis-inspector tree-analysis-modal tree-analysis-score-modal" role="dialog" aria-modal="true" aria-label="Configurer la boîte de points">
                    <div className="tree-analysis-modal-heading">
                      <div><span className="eyebrow">Points</span><h3>{editingScoreId ? "Modifier le résultat" : "Ajouter une boîte de points"}</h3></div>
                      <button type="button" onClick={() => setScoreModalOpen(false)} aria-label="Fermer"><X size={18} /></button>
                    </div>
                    <div className={`tree-analysis-score-preview ${scoreSizeDraft === "large" ? "large" : ""}`}>
                      <span>{scoreEarnedDraft.trim() || "___"}</span><b>/</b><span>{scoreTotalDraft || "10"}</span>
                    </div>
                    <div className="tree-analysis-score-fields">
                      <label>Points obtenus <input type="number" min="0" value={scoreEarnedDraft} onChange={(event) => setScoreEarnedDraft(event.target.value)} placeholder="Laisser vide" /></label>
                      <label>Total <input type="number" min="1" value={scoreTotalDraft} onChange={(event) => setScoreTotalDraft(event.target.value)} /></label>
                    </div>
                    <div className="tree-analysis-score-size" role="group" aria-label="Taille de la boîte">
                      <button type="button" className={scoreSizeDraft === "normal" ? "active" : ""} onClick={() => setScoreSizeDraft("normal")}><strong>Normale</strong><small>Pour une question ou une section</small></button>
                      <button type="button" className={scoreSizeDraft === "large" ? "active" : ""} onClick={() => setScoreSizeDraft("large")}><strong>Grande</strong><small>Pour un résultat global</small></button>
                    </div>
                    <Button type="button" onClick={saveScoreBox}>{editingScoreId ? "Enregistrer" : "Ajouter à la page"}</Button>
                  </aside>
                </div>
              )}
              <GrammarInteractionModal
                open={interactionModalOpen}
                draft={{ kind: interactionKind, label: interactionLabel, instruction: interactionInstruction, responseMode: interactionResponseMode, nucleusWordClass: interactionNucleusClass, linkedTargetId: interactionLinkedNodeId }}
                functionOptions={sentenceFunctionOptions}
                wordClassLabels={wordClassLabels}
                linkedTargetLabel={selectedInteractionNode ? getNodeLabel(selectedInteractionNode) || "sans réponse" : undefined}
                onChange={(draft) => { if (draft.kind === "function" || draft.kind === "group" || draft.kind === "nucleus") setInteractionKind(draft.kind); setInteractionLabel(draft.label); setInteractionInstruction(draft.instruction); if (draft.responseMode === "click" || draft.responseMode === "frame") setInteractionResponseMode(draft.responseMode); setInteractionNucleusClass(draft.nucleusWordClass); setInteractionLinkedNodeId(draft.linkedTargetId); }}
                onCancel={cancelInteraction}
                onSave={saveInteraction}
                onPickLinkedTarget={() => { setInteractionModalOpen(false); setPickingInteractionNode(true); }}
                onClearLinkedTarget={() => setInteractionLinkedNodeId("")}
              />
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
