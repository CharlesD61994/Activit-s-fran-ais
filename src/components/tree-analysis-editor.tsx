"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  Link2,
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
  TreeAnalysisRelation,
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
  marginX: 36,
  marginTop: 24,
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
  const [step, setStep] = useState<1 | 2>(1);
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
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const [wordCenters, setWordCenters] = useState<number[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    null
  );
  const [linkingParentId, setLinkingParentId] = useState<string | null>(
    null
  );
  const [printMode, setPrintMode] = useState<"student" | "answer">("answer");
  const measureRef = useRef<HTMLSpanElement>(null);
  const wordRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    nodeId: string;
    offsetX: number;
    offsetY: number;
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
  const selectedNode = nodes.find((node) => node.id === selectedNodeId);

  function addNode() {
    const index = nodes.length;
    const columns = Math.max(1, Math.floor(availableWidth / (nodeWidth + 24)));
    const x = clamp(
      snap((index % columns) * (nodeWidth + 24)),
      PAGE.marginX,
      PAGE.logicalWidth - PAGE.marginX - nodeWidth
    );
    const y = clamp(
      snap(120 + Math.floor(index / columns) * (nodeHeight + 36)),
      TREE_TOP,
      TREE_BOTTOM - nodeHeight
    );

    const node: TreeAnalysisNode = {
      id: crypto.randomUUID(),
      x,
      y
    };

    setNodes((current) => [...current, node]);
    setSelectedNodeId(node.id);
    setLinkingParentId(null);
  }

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
    setSelectedNodeId((current) =>
      current === nodeId ? null : current
    );
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

    dragRef.current = {
      nodeId: node.id,
      offsetX:
        (event.clientX - rect.left) * scaleX - node.x,
      offsetY:
        (event.clientY - rect.top) * scaleY - node.y
    };

    setSelectedNodeId(node.id);
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

    const closestWordCenter = wordCenters.reduce<number | null>(
      (closest, center) => {
        const nodeCenter = logicalX + nodeWidth / 2;
        if (Math.abs(center - nodeCenter) > 18) return closest;
        if (closest === null) return center;
        return Math.abs(center - nodeCenter) < Math.abs(closest - nodeCenter)
          ? center
          : closest;
      },
      null
    );
    if (closestWordCenter !== null) {
      logicalX = closestWordCenter - nodeWidth / 2;
    }

    updateNode(drag.nodeId, {
      x: clamp(
        closestWordCenter === null ? snap(logicalX) : logicalX,
        PAGE.marginX,
        PAGE.logicalWidth - PAGE.marginX - nodeWidth
      ),
      y: clamp(
        snap(logicalY),
        TREE_TOP,
        TREE_BOTTOM - nodeHeight
      )
    });
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
    setSelectedNodeId(nodeId);
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
    setSelectedNodeId(childId);
  }

  function removeRelation(relationId: string) {
    setRelations((current) =>
      current.filter((relation) => relation.id !== relationId)
    );
  }

  function saveActivity() {
    if (!fits || !title.trim() || !levelId) return;
    const now = new Date().toISOString();

    onSave({
      id: initialSentence?.id ?? crypto.randomUUID(),
      activityType: "tree_analysis",
      levelId,
      title: title.trim(),
      originalText: trimmed,
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
          <Card className="tree-analysis-builder-card">
            <div className="tree-analysis-builder-heading">
              <div>
                <span className="eyebrow">Étape 2 sur 2</span>
                <h2>Construction de l’arbre</h2>
                <p>
                  Ajoute des rectangles, place-les librement sur la
                  feuille, choisis leur groupe et relie les parents aux
                  enfants.
                </p>
              </div>
              <div className="tree-analysis-builder-tools">
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
                    setSelectedNodeId(null);
                  }
                }}
              >
                <div className="tree-analysis-print-safe-guide" />
                <Button
                  type="button"
                  className="tree-analysis-floating-add"
                  onClick={(event) => {
                    event.stopPropagation();
                    addNode();
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <Plus size={17} />
                  Nouveau rectangle
                </Button>

                <div className="tree-analysis-builder-sentence">
                  <span style={{ fontSize: sentenceFontSizeCqw }}>
                    {sentenceWords.map((word, index) => (
                      <span key={`${word}-${index}`}>
                        {index > 0 ? " " : ""}
                        <span
                          ref={(element) => {
                            wordRefs.current[index] = element;
                          }}
                        >
                          {word}
                        </span>
                      </span>
                    ))}
                  </span>
                </div>

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

                    return (
                      <line
                        key={relation.id}
                        x1={parent.x + nodeWidth / 2}
                        y1={parent.y + nodeHeight}
                        x2={child.x + nodeWidth / 2}
                        y2={child.y}
                      />
                    );
                  })}
                </svg>

                {nodes.map((node) => {
                  const selected = selectedNodeId === node.id;
                  const linkingParent =
                    linkingParentId === node.id;

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
                        width: `${(nodeWidth / PAGE.logicalWidth) * 100}%`,
                        height: `${(nodeHeight / PAGE.logicalHeight) * 100}%`
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
                        } else {
                          setSelectedNodeId(node.id);
                        }
                      }}
                    >
                      {selected && (
                        <div
                          className="tree-node-actions"
                          onPointerDown={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              startLink(node.id);
                            }}
                            title="Relier à un enfant"
                            aria-label="Relier à un enfant"
                          >
                            <Link2 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              deleteNode(node.id);
                            }}
                            title="Supprimer le rectangle"
                            aria-label="Supprimer le rectangle"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                      <strong>{getNodeLabel(node)}</strong>
                    </div>
                  );
                })}
                </div>
              </div>

              <aside className="tree-analysis-inspector" aria-live="polite">
                <span className="eyebrow">Propriétés</span>
                {selectedNode ? (
                  <>
                    <h3>Rectangle sélectionné</h3>
                    <div className="tree-analysis-node-kind" role="group" aria-label="Type de case">
                      <button
                        type="button"
                        className={!selectedNode.wordClass ? "active" : ""}
                        onClick={() => updateNode(selectedNode.id, { wordClass: undefined })}
                      >
                        Groupe de mots
                      </button>
                      <button
                        type="button"
                        className={selectedNode.wordClass ? "active" : ""}
                        onClick={() => updateNode(selectedNode.id, {
                          groupType: undefined,
                          wordClass: selectedNode.wordClass ?? "noun"
                        })}
                      >
                        Classe de mots
                      </button>
                    </div>

                    {selectedNode.wordClass ? (
                      <label>
                        Classe de mots
                        <select
                          value={selectedNode.wordClass}
                          onChange={(event) => updateNode(selectedNode.id, {
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
                          value={selectedNode.groupType ?? ""}
                          onChange={(event) => updateNode(selectedNode.id, {
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
                    <p>Glisse n’importe où sur le rectangle pour le déplacer. À proximité d’un mot, il s’aligne automatiquement sur son centre.</p>
                  </>
                ) : (
                  <>
                    <h3>Sélectionne un rectangle</h3>
                    <p>Clique sur un rectangle pour modifier son type, créer une liaison ou le supprimer.</p>
                  </>
                )}
              </aside>
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
              variant="secondary"
              onClick={() => setStep(1)}
            >
              <ArrowLeft size={17} />
              Retour à la phrase
            </Button>

            <Button
              type="button"
              onClick={saveActivity}
              disabled={!allNodesConfigured || !boxesFitOnOneRow}
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
