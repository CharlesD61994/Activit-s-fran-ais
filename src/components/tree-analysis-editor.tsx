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
  marginX: 54,
  marginTop: 48,
  sentenceTop: 78,
  sentenceFontSize: 25,
  sentenceFontFamily: "Arial, Helvetica, sans-serif",
  sentenceFontWeight: 400
};

const NODE_WIDTH = 92;
const NODE_HEIGHT = 56;
const GRID = 8;
const TREE_TOP = 150;
const TREE_BOTTOM = PAGE.logicalHeight - 58;

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
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    null
  );
  const [linkingParentId, setLinkingParentId] = useState<string | null>(
    null
  );
  const measureRef = useRef<HTMLSpanElement>(null);
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
  const ratio = measuredWidth / availableWidth;
  const fits = Boolean(trimmed) && measuredWidth <= availableWidth;
  const nearLimit = fits && ratio >= 0.88;

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
        text: "La phrase approche de la largeur maximale."
      };
    }
    return {
      tone: "success",
      text: "La phrase tient sur une ligne."
    };
  }, [fits, nearLimit, trimmed]);

  const compatibleGroups = groups.filter(
    (group) => group.levelId === levelId
  );

  const allNodesConfigured =
    nodes.length > 0 &&
    nodes.every((node) => Boolean(node.groupType));

  function addNode() {
    const index = nodes.length;
    const x = clamp(
      snap(90 + (index % 7) * 126),
      PAGE.marginX,
      PAGE.logicalWidth - PAGE.marginX - NODE_WIDTH
    );
    const y = clamp(
      snap(190 + Math.floor(index / 7) * 92),
      TREE_TOP,
      TREE_BOTTOM - NODE_HEIGHT
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

    const logicalX =
      (event.clientX - rect.left) * scaleX - drag.offsetX;
    const logicalY =
      (event.clientY - rect.top) * scaleY - drag.offsetY;

    updateNode(drag.nodeId, {
      x: clamp(
        snap(logicalX),
        PAGE.marginX,
        PAGE.logicalWidth - PAGE.marginX - NODE_WIDTH
      ),
      y: clamp(
        snap(logicalY),
        TREE_TOP,
        TREE_BOTTOM - NODE_HEIGHT
      )
    });
  }

  function stopDragging() {
    dragRef.current = null;
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
      treeAnalysisPage: PAGE,
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
                <Button type="button" onClick={addNode}>
                  <Plus size={17} />
                  Rectangle
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
              </div>
            </div>

            {linkingParentId && (
              <div className="tree-analysis-link-hint">
                <Link2 size={17} />
                Clique maintenant sur le rectangle enfant.
              </div>
            )}

            <div className="tree-analysis-page-shell builder">
              <div
                ref={canvasRef}
                className={`tree-analysis-page tree-analysis-canvas ${
                  linkingParentId ? "linking" : ""
                }`}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={stopDragging}
                onPointerCancel={stopDragging}
              >
                <div className="tree-analysis-print-safe-guide" />

                <div className="tree-analysis-builder-sentence">
                  {trimmed}
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
                        x1={parent.x + NODE_WIDTH / 2}
                        y1={parent.y + NODE_HEIGHT}
                        x2={child.x + NODE_WIDTH / 2}
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
                        width: `${(NODE_WIDTH / PAGE.logicalWidth) * 100}%`,
                        height: `${(NODE_HEIGHT / PAGE.logicalHeight) * 100}%`
                      }}
                      onPointerDown={(event) =>
                        handleNodePointerDown(event, node)
                      }
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
                      <select
                        value={node.groupType ?? ""}
                        onChange={(event) =>
                          updateNode(node.id, {
                            groupType:
                              (event.target.value ||
                                undefined) as
                                | WordGroupType
                                | undefined
                          })
                        }
                        aria-label="Type du groupe"
                      >
                        <option value="">Groupe…</option>
                        {(Object.keys(
                          groupLabels
                        ) as WordGroupType[]).map(
                          (groupType) => (
                            <option
                              key={groupType}
                              value={groupType}
                            >
                              {groupLabels[groupType]}
                            </option>
                          )
                        )}
                      </select>

                      <div className="tree-node-actions">
                        <button
                          type="button"
                          title="Relier à un enfant"
                          aria-label="Relier à un enfant"
                          onClick={(event) => {
                            event.stopPropagation();
                            startLink(node.id);
                          }}
                        >
                          <Link2 size={13} />
                        </button>
                        <button
                          type="button"
                          title="Supprimer"
                          aria-label="Supprimer le rectangle"
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteNode(node.id);
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
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
                        {(parent?.groupType &&
                          groupLabels[parent.groupType]) ||
                          "Rectangle"}{" "}
                        →{" "}
                        {(child?.groupType &&
                          groupLabels[child.groupType]) ||
                          "Rectangle"}
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
                : !allNodesConfigured
                  ? "Choisis un groupe pour chaque rectangle."
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
              disabled={!allNodesConfigured}
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
