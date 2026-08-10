"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ArrowDown, ArrowUp, Pilcrow, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SentenceRenderer } from "@/components/sentence-renderer";
import { GrammarWorkflowPlanner } from "@/components/grammar-workflow-planner";
import { defaultWorkflowForObjective, grammarObjectiveLabels, objectiveFromActivityType } from "@/lib/grammar-workflow";
import type { ActivityType, ClassGroup, CorrectionCode, GrammarAnnotation, GrammarAnnotationKind, GrammarObjective, GrammarVisualEffect, GrammarWorkflowPhase, SchoolLevel, Sentence, SentenceCorrection, SentenceDifficulty } from "@/types";

type Props = {
  initialSentence?: Sentence;
  activityType?: ActivityType;
  primaryObjective?: GrammarObjective;
  levels: SchoolLevel[];
  groups: ClassGroup[];
  correctionCodes: CorrectionCode[];
  onSave: (sentence: Sentence) => void;
};

type DraftCorrection = {
  start: number;
  end: number;
  originalText: string;
  correctedText: string;
  correctionCodeId: string;
  points: number;
  explanation: string;
};

type DraftAnnotation = Omit<GrammarAnnotation, "id"> & { text: string };

const annotationLabels: Record<Exclude<GrammarAnnotationKind, "error">, string> = {
  group: "Groupe",
  word_class: "Classe de mot",
  nucleus: "Noyau",
  function: "Fonction",
  donor: "Donneur",
  receiver: "Receveur"
};

const annotationAnswers: Partial<Record<GrammarAnnotationKind, string[]>> = {
  group: ["GN", "GV", "GAdj", "GAdv", "GPrép"],
  word_class: ["Nom", "Déterminant", "Verbe", "Adjectif", "Pronom", "Adverbe", "Préposition", "Conjonction"],
  nucleus: ["Nom", "Déterminant", "Verbe", "Adjectif", "Pronom", "Adverbe", "Préposition", "Conjonction"],
  function: ["Sujet", "Prédicat", "Complément de phrase", "Complément direct", "Complément indirect", "Attribut du sujet", "Complément du nom"],
  donor: ["Donneur d’accord"],
  receiver: ["Receveur d’accord"]
};

const emptyDraft: DraftCorrection = {
  start: 0,
  end: 0,
  originalText: "",
  correctedText: "",
  correctionCodeId: "",
  points: 1,
  explanation: ""
};

const defaultVisuals: Record<Exclude<GrammarAnnotationKind, "error">, GrammarVisualEffect> = {
  group: { kind: "frame" }, word_class: { kind: "underline", color: "#2467d1" }, nucleus: { kind: "color", color: "#d93434" },
  function: { kind: "brackets" }, donor: { kind: "highlight", color: "#fde68a" }, receiver: { kind: "underline", color: "#22834b" }
};
const visualLabels: Record<GrammarVisualEffect["kind"], string> = { none: "Aucune marque", color: "Couleur du texte", frame: "Encadrement", brackets: "Crochets", bold: "Gras", highlight: "Surlignage", underline: "Soulignement" };

function MixedTextSurface({ text, annotations, surfaceRef, onChange, onSelect }: { text: string; annotations: GrammarAnnotation[]; surfaceRef: React.RefObject<HTMLDivElement | null>; onChange: (text: string) => void; onSelect: (start: number, end: number) => void }) {
  const boundaries = Array.from(new Set([0, text.length, ...annotations.flatMap((item) => [item.start, item.end])])).filter((value) => value >= 0 && value <= text.length).sort((a, b) => a - b);
  const segments = boundaries.slice(0, -1).map((start, index) => { const end = boundaries[index + 1]; const marks = annotations.filter((item) => item.start <= start && item.end >= end); const color = [...marks].reverse().find((item) => item.visualEffect?.kind === "color")?.visualEffect?.color; const highlight = [...marks].reverse().find((item) => item.visualEffect?.kind === "highlight")?.visualEffect?.color; const underline = [...marks].reverse().find((item) => item.visualEffect?.kind === "underline")?.visualEffect?.color; const frames = marks.filter((item) => item.visualEffect?.kind === "frame"); const brackets = marks.filter((item) => item.visualEffect?.kind === "brackets"); const style: CSSProperties = { color, backgroundColor: highlight, fontWeight: marks.some((item) => item.visualEffect?.kind === "bold") ? 800 : undefined, textDecoration: underline ? "underline" : undefined, textDecorationColor: underline }; return { start, end, value: text.slice(start, end), style, framed: frames.length > 0, frameStart: frames.some((item) => item.start === start), frameEnd: frames.some((item) => item.end === end), bracketed: brackets.length > 0, bracketStart: brackets.some((item) => item.start === start), bracketEnd: brackets.some((item) => item.end === end) }; });
  const readSelection = () => { const element = surfaceRef.current, selection = window.getSelection(); if (!element || !selection?.rangeCount) return; const range = selection.getRangeAt(0); if (!element.contains(range.startContainer) || !element.contains(range.endContainer)) return; const beforeStart = range.cloneRange(); beforeStart.selectNodeContents(element); beforeStart.setEnd(range.startContainer, range.startOffset); const beforeEnd = range.cloneRange(); beforeEnd.selectNodeContents(element); beforeEnd.setEnd(range.endContainer, range.endOffset); onSelect(beforeStart.toString().length, beforeEnd.toString().length); };
  useEffect(() => { document.addEventListener("selectionchange", readSelection); return () => document.removeEventListener("selectionchange", readSelection); });
  return <div ref={surfaceRef} className="mixed-author-text-surface" contentEditable suppressContentEditableWarning onInput={(event) => onChange(event.currentTarget.textContent ?? "")} onSelect={readSelection} onMouseUp={readSelection} onKeyUp={readSelection}>{segments.length ? segments.map((segment) => <span key={`${segment.start}-${segment.end}`} className={`${segment.framed ? "author-frame-part" : ""} ${segment.frameStart ? "mark-start" : ""} ${segment.frameEnd ? "mark-end" : ""} ${segment.bracketed ? "author-bracket-part" : ""} ${segment.bracketStart ? "mark-start" : ""} ${segment.bracketEnd ? "mark-end" : ""}`} style={segment.style}>{segment.value}</span>) : text}</div>;
}

export function SentenceEditor({
  initialSentence,
  activityType: requestedActivityType,
  primaryObjective: requestedPrimaryObjective,
  levels,
  correctionCodes,
  onSave
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mixedSurfaceRef = useRef<HTMLDivElement>(null);
  const mixedSelectionRef = useRef({ start: 0, end: 0 });
  const now = new Date().toISOString();

  const activityType: ActivityType =
    initialSentence?.activityType ?? requestedActivityType ?? "sentence_correction";
  const isTextActivity = activityType === "text_correction";

  const [title, setTitle] = useState(initialSentence?.title ?? "");
  const initialObjective = initialSentence?.primaryObjective ?? requestedPrimaryObjective ?? objectiveFromActivityType(activityType);
  const [primaryObjective, setPrimaryObjective] = useState<GrammarObjective>(initialObjective);
  const isMixedActivity = primaryObjective === "mixed_grammar";
  const [workflowPhases, setWorkflowPhases] = useState<GrammarWorkflowPhase[]>(
    initialSentence?.workflowPhases ?? defaultWorkflowForObjective(initialObjective)
  );
  const [levelId, setLevelId] = useState(initialSentence?.levelId ?? levels[0]?.id ?? "");
  const [difficulty, setDifficulty] = useState<SentenceDifficulty>(initialSentence?.difficulty ?? "easy");
  const [tagsText, setTagsText] = useState(initialSentence?.tags.join(", ") ?? "");
  const [originalText, setOriginalText] = useState(initialSentence?.originalText ?? "");
  const [showCorrectionCount, setShowCorrectionCount] = useState(initialSentence?.showCorrectionCount ?? true);
  const [assignedGroupIds, setAssignedGroupIds] = useState<string[]>(initialSentence?.assignedGroupIds ?? []);
  const [corrections, setCorrections] = useState<SentenceCorrection[]>(initialSentence?.corrections ?? []);
  const [grammarAnnotations, setGrammarAnnotations] = useState<GrammarAnnotation[]>(initialSentence?.grammarAnnotations ?? []);
  const [annotationDraft, setAnnotationDraft] = useState<DraftAnnotation | null>(null);
  const [draft, setDraft] = useState<DraftCorrection>(emptyDraft);
  const [isInsertionDraft, setIsInsertionDraft] = useState(false);
  const [message, setMessage] = useState("");

  const activeCodes = correctionCodes.filter((code) => code.isActive !== false);

  function currentMixedSelection() {
    const element = mixedSurfaceRef.current;
    const selection = typeof window !== "undefined" ? window.getSelection() : null;
    if (!element || !selection?.rangeCount) return mixedSelectionRef.current;
    const range = selection.getRangeAt(0);
    if (!element.contains(range.startContainer) || !element.contains(range.endContainer)) return mixedSelectionRef.current;
    const beforeStart = range.cloneRange(); beforeStart.selectNodeContents(element); beforeStart.setEnd(range.startContainer, range.startOffset);
    const beforeEnd = range.cloneRange(); beforeEnd.selectNodeContents(element); beforeEnd.setEnd(range.endContainer, range.endOffset);
    const value = { start: beforeStart.toString().length, end: beforeEnd.toString().length };
    mixedSelectionRef.current = value;
    return value;
  }

  const previewSentence = useMemo<Sentence>(() => ({
    id: initialSentence?.id ?? "preview",
    activityType,
    title,
    primaryObjective,
    workflowPhases,
    levelId,
    difficulty,
    tags: tagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
    originalText,
    showCorrectionCount,
    corrections,
    grammarAnnotations,
    assignedGroupIds,
    createdAt: initialSentence?.createdAt ?? now,
    updatedAt: now
  }), [activityType, assignedGroupIds, corrections, difficulty, grammarAnnotations, initialSentence, levelId, now, originalText, primaryObjective, showCorrectionCount, tagsText, title, workflowPhases]);

  function captureSelection() {
    const textarea = textareaRef.current;
    if (!textarea && !isMixedActivity) return;
    const mixedSelection = currentMixedSelection();
    let start = isMixedActivity ? mixedSelection.start : textarea!.selectionStart;
    let end = isMixedActivity ? mixedSelection.end : textarea!.selectionEnd;

    if (start === end) {
      setMessage("Sélectionne d’abord un mot ou un segment dans la phrase.");
      return;
    }

    while (start < end && /\s/.test(originalText[start] ?? "")) {
      start += 1;
    }

    while (end > start && /\s/.test(originalText[end - 1] ?? "")) {
      end -= 1;
    }

    if (start === end) {
      setMessage("La sélection contient seulement des espaces.");
      return;
    }

    const overlaps = corrections.some(
      (correction) => start < correction.end && end > correction.start
    );

    if (overlaps) {
      setMessage("Cette sélection chevauche une correction existante.");
      return;
    }

    setMessage("");
    setIsInsertionDraft(false);
    setDraft({
      ...emptyDraft,
      start,
      end,
      originalText: originalText.slice(start, end),
      correctionCodeId: activeCodes[0]?.id ?? ""
    });
  }

  function capturePunctuationInsertion() {
    const textarea = textareaRef.current;
    if (!textarea && !isMixedActivity) return;

    const position = isMixedActivity ? currentMixedSelection().end : textarea!.selectionStart;
    const overlaps = corrections.some(
      (correction) =>
        correction.start === position ||
        (position > correction.start && position < correction.end)
    );

    if (overlaps) {
      setMessage("Une correction existe déjà à cet endroit.");
      return;
    }

    const punctuationCode =
      activeCodes.find((code) => code.category === "punctuation") ??
      activeCodes[0];

    setMessage("");
    setIsInsertionDraft(true);
    setDraft({
      ...emptyDraft,
      start: position,
      end: position,
      originalText: "",
      correctionCodeId: punctuationCode?.id ?? ""
    });
  }

  function captureGrammarSelection(kind: Exclude<GrammarAnnotationKind, "error">) {
    const textarea = textareaRef.current;
    if (!textarea && !isMixedActivity) return;
    const mixedSelection = currentMixedSelection();
    let start = isMixedActivity ? mixedSelection.start : textarea!.selectionStart;
    let end = isMixedActivity ? mixedSelection.end : textarea!.selectionEnd;
    while (start < end && /\s/.test(originalText[start] ?? "")) start += 1;
    while (end > start && /\s/.test(originalText[end - 1] ?? "")) end -= 1;
    if (start === end) {
      setMessage("Sélectionne d’abord le mot ou le passage à annoter.");
      return;
    }
    setAnnotationDraft({
      start,
      end,
      text: originalText.slice(start, end),
      kind,
      label: annotationAnswers[kind]?.[0] ?? (kind === "nucleus" ? "Noyau" : ""),
      visualEffect: defaultVisuals[kind],
      responseMode: kind === "group" || kind === "function" ? "frame" : "click"
    });
    setMessage("");
  }

  function addGrammarAnnotation() {
    if (!annotationDraft) return;
    setGrammarAnnotations((items) => [...items, {
      id: crypto.randomUUID(),
      start: annotationDraft.start,
      end: annotationDraft.end,
      kind: annotationDraft.kind,
      label: annotationDraft.label?.trim() || undefined,
      linkedAnnotationId: annotationDraft.linkedAnnotationId,
      parentAnnotationId: annotationDraft.parentAnnotationId,
      visualEffect: annotationDraft.visualEffect,
      responseMode: annotationDraft.responseMode
    }]);
    setAnnotationDraft(null);
  }

  function addCorrection() {
    if (
      (!draft.originalText && !isInsertionDraft) ||
      !draft.correctedText.trim() ||
      !draft.correctionCodeId
    ) {
      setMessage(
        isInsertionDraft
          ? "Entre la ponctuation attendue et choisis un code."
          : "Entre une correction et choisis un code."
      );
      return;
    }

    const correction: SentenceCorrection = {
      id: crypto.randomUUID(),
      start: draft.start,
      end: draft.end,
      originalText: draft.originalText,
      correctedText: draft.correctedText.trim(),
      correctionCodeId: draft.correctionCodeId,
      points: Math.max(1, Math.min(10, Math.round(draft.points))),
      revealOrder: corrections.length + 1,
      explanation: draft.explanation.trim() || undefined
    };

    setCorrections((items) => [...items, correction].sort((a, b) => a.revealOrder - b.revealOrder));
    setDraft(emptyDraft);
    setIsInsertionDraft(false);
    setMessage("");
  }

  function removeCorrection(id: string) {
    setCorrections((items) =>
      items.filter((item) => item.id !== id).map((item, index) => ({ ...item, revealOrder: index + 1 }))
    );
  }

  function moveCorrection(id: string, direction: -1 | 1) {
    setCorrections((items) => {
      const ordered = [...items].sort((a, b) => a.revealOrder - b.revealOrder);
      const index = ordered.findIndex((item) => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= ordered.length) return items;
      [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
      return ordered.map((item, itemIndex) => ({ ...item, revealOrder: itemIndex + 1 }));
    });
  }


  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !originalText.trim() || !levelId) {
      setMessage(
        isTextActivity
          ? "Le titre, le niveau et le texte sont obligatoires."
          : "Le titre, le niveau et la phrase sont obligatoires."
      );
      return;
    }

    const positionsValid = corrections.every((correction) =>
      originalText.slice(correction.start, correction.end) === correction.originalText
    );
    if (!positionsValid) {
      setMessage("La phrase a changé après la création des corrections. Retire les corrections invalides et sélectionne-les de nouveau.");
      return;
    }

    onSave({
      id: initialSentence?.id ?? crypto.randomUUID(),
      activityType,
      title: title.trim(),
      primaryObjective,
      workflowPhases,
      grammarAnnotations,
      levelId,
      difficulty,
      tags: tagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
      originalText: originalText.trim(),
      showCorrectionCount,
      corrections: [...corrections].sort((a, b) => a.revealOrder - b.revealOrder),
      assignedGroupIds,
      createdAt: initialSentence?.createdAt ?? now,
      updatedAt: new Date().toISOString()
    });
  }

  return (
    <form onSubmit={submit} className={`editor-layout ${isMixedActivity ? "mixed-grammar-editor" : ""}`}>
      <div className="editor-main">
        <Card>
          <span className="eyebrow">Étape 1</span>
          <h2>Informations générales</h2>
          <div className="form-grid">
            <label>Titre
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex. Accord dans le groupe du nom" />
            </label>
            <label>Niveau
              <select value={levelId} onChange={(event) => { setLevelId(event.target.value); setAssignedGroupIds([]); }}>
                {levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}
              </select>
            </label>
            <label>Difficulté
              <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as SentenceDifficulty)}>
                <option value="easy">Facile</option>
                <option value="medium">Moyenne</option>
                <option value="hard">Difficile</option>
              </select>
            </label>
            <label>Objectif principal
              <select value={primaryObjective} onChange={(event) => setPrimaryObjective(event.target.value as GrammarObjective)}>
                {(Object.entries(grammarObjectiveLabels) as Array<[GrammarObjective, string]>).filter(([value]) => value !== "mixed_grammar").map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>Étiquettes
              <input value={tagsText} onChange={(event) => setTagsText(event.target.value)} placeholder="accord, PPA, homophones" />
            </label>
          </div>

          <label className="switch-row editor-count-switch">
            <input
              type="checkbox"
              checked={showCorrectionCount}
              onChange={(event) => setShowCorrectionCount(event.target.checked)}
            />
            <span>Afficher le nombre de corrections dans le lecteur</span>
          </label>
        </Card>

        <Card>
          <span className="eyebrow">{isMixedActivity ? "Zone d’édition" : "Étape 2"}</span>
          <h2>{isMixedActivity ? "Construis la phrase et ses réponses" : isTextActivity ? "Texte à corriger" : "Phrase fautive"}</h2>
          <label>
            {isMixedActivity
              ? "Écris la phrase, sélectionne un passage, puis choisis sa mécanique dans la barre d’actions."
              : isTextActivity
              ? "Écris ou colle le texte, puis sélectionne chaque mot ou segment fautif."
              : "Écris la phrase, puis sélectionne un mot ou un segment."}
            {isMixedActivity ? <MixedTextSurface text={originalText} annotations={grammarAnnotations} surfaceRef={mixedSurfaceRef} onSelect={(start, end) => { mixedSelectionRef.current = { start, end }; }} onChange={(value) => { setOriginalText(value); if (corrections.length || grammarAnnotations.length) setMessage("Attention : modifier la phrase peut invalider les réponses déjà placées."); }}/>
            : <textarea
              ref={textareaRef}
              value={originalText}
              onChange={(event) => {
                setOriginalText(event.target.value);
                if (corrections.length > 0) setMessage("Attention : modifier la phrase peut invalider les positions des corrections.");
              }}
              rows={isTextActivity ? 15 : 5}
              className={isTextActivity ? "activity-textarea activity-textarea-long" : "activity-textarea"}
              placeholder={
                isTextActivity
                  ? "Colle ici le texte à corriger..."
                  : "Les élèves se sont demander pourquoi..."
              }
            />}
          </label>
          <div className="selection-toolbar">
            <Button type="button" onClick={captureSelection}>
              <Plus size={18} />
              Ajouter la sélection comme faute
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={capturePunctuationInsertion}
            >
              <Pilcrow size={18} />
              Ponctuation manquante
            </Button>

            <span>
              Sélectionne une faute, ou place le curseur à l’endroit où une
              virgule, un point ou un autre signe devrait être ajouté.
            </span>
          </div>
          <div className="grammar-annotation-toolbar" aria-label="Annoter la sélection" onMouseDown={(event) => { if ((event.target as HTMLElement).closest("button")) event.preventDefault(); }}>
            <span>Associer la sélection :</span>
            {(Object.entries(annotationLabels) as Array<[Exclude<GrammarAnnotationKind, "error">, string]>).map(([kind, label]) => (
              <button type="button" key={kind} onClick={() => captureGrammarSelection(kind)}>{label}</button>
            ))}
          </div>
        </Card>

        {annotationDraft && (
          <Card className="annotation-draft-card">
            <span className="eyebrow">Réponse grammaticale</span>
            <h2>« {annotationDraft.text} »</h2>
            <div className="form-grid">
              <label>Type<input value={annotationLabels[annotationDraft.kind as Exclude<GrammarAnnotationKind, "error">]} disabled /></label>
              <label>Réponse attendue
                {annotationAnswers[annotationDraft.kind]?.length ? (
                  <select value={annotationDraft.label ?? ""} onChange={(event) => setAnnotationDraft({ ...annotationDraft, label: event.target.value })}>
                    {annotationAnswers[annotationDraft.kind]?.map((answer) => <option key={answer}>{answer}</option>)}
                  </select>
                ) : <input value={annotationDraft.label ?? ""} onChange={(event) => setAnnotationDraft({ ...annotationDraft, label: event.target.value })} />}
              </label>
              {annotationDraft.kind === "receiver" && grammarAnnotations.some((annotation) => annotation.kind === "donor") && (
                <label>Donneur associé
                  <select value={annotationDraft.linkedAnnotationId ?? ""} onChange={(event) => setAnnotationDraft({ ...annotationDraft, linkedAnnotationId: event.target.value || undefined })}>
                    <option value="">Aucun lien</option>
                    {grammarAnnotations.filter((annotation) => annotation.kind === "donor").map((annotation) => <option key={annotation.id} value={annotation.id}>{originalText.slice(annotation.start, annotation.end)}</option>)}
                  </select>
                </label>
              )}
              <label>Résultat visuel
                <select value={annotationDraft.visualEffect?.kind ?? "none"} onChange={(event) => setAnnotationDraft({ ...annotationDraft, visualEffect: { kind: event.target.value as GrammarVisualEffect["kind"], color: annotationDraft.visualEffect?.color } })}>
                  {Object.entries(visualLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                </select>
              </label>
              {annotationDraft.visualEffect && ["color", "highlight", "underline"].includes(annotationDraft.visualEffect.kind) && <label>Couleur
                <input type="color" value={annotationDraft.visualEffect.color ?? "#d93434"} onChange={(event) => setAnnotationDraft({ ...annotationDraft, visualEffect: { ...annotationDraft.visualEffect!, color: event.target.value } })}/>
              </label>}
              <label>Geste dans le lecteur
                <select value={annotationDraft.responseMode ?? "click"} onChange={(event) => setAnnotationDraft({ ...annotationDraft, responseMode: event.target.value as GrammarAnnotation["responseMode"] })}>
                  <option value="click">Cliquer sur le mot ou le passage</option><option value="frame">Tracer un encadrement</option><option value="brackets">Tracer les crochets</option>
                </select>
              </label>
              {grammarAnnotations.length > 0 && <label>Cible parente (facultatif)
                <select value={annotationDraft.parentAnnotationId ?? ""} onChange={(event) => setAnnotationDraft({ ...annotationDraft, parentAnnotationId: event.target.value || undefined })}>
                  <option value="">Aucune — traitement par lots</option>
                  {grammarAnnotations.filter((annotation) => annotation.start <= annotationDraft.start && annotation.end >= annotationDraft.end).map((annotation) => <option value={annotation.id} key={annotation.id}>{annotationLabels[annotation.kind as Exclude<GrammarAnnotationKind, "error">]} : {originalText.slice(annotation.start, annotation.end)}</option>)}
                </select>
              </label>}
            </div>
            <div className="form-actions"><Button type="button" onClick={addGrammarAnnotation}>Ajouter la réponse</Button><Button type="button" variant="secondary" onClick={() => setAnnotationDraft(null)}>Annuler</Button></div>
          </Card>
        )}

        {(draft.originalText || isInsertionDraft) && (
          <Card className="correction-draft">
            <span className="eyebrow">Nouvelle correction</span>
            <h2>
              {isInsertionDraft
                ? "Ponctuation manquante"
                : `« ${draft.originalText} »`}
            </h2>
            <div className="form-grid">
              <label>
                {isInsertionDraft ? "Ponctuation attendue" : "Correction"}
                <input
                  value={draft.correctedText}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      correctedText: event.target.value
                    }))
                  }
                  placeholder={isInsertionDraft ? "Ex. , ou ." : undefined}
                />
              </label>
              <label>Code
                <select value={draft.correctionCodeId} onChange={(event) => setDraft((current) => ({ ...current, correctionCodeId: event.target.value }))}>
                  {activeCodes.map((code) => <option key={code.id} value={code.id}>{code.code} — {code.name}</option>)}
                </select>
              </label>
              <label>Points
                <input type="number" min={1} max={10} value={draft.points} onChange={(event) => setDraft((current) => ({ ...current, points: Number(event.target.value) }))} />
              </label>
              <label>Explication facultative
                <input value={draft.explanation} onChange={(event) => setDraft((current) => ({ ...current, explanation: event.target.value }))} />
              </label>
            </div>
            <div className="form-actions">
              <Button type="button" onClick={addCorrection}>Ajouter la correction</Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setDraft(emptyDraft);
                  setIsInsertionDraft(false);
                }}
              >
                Annuler
              </Button>
            </div>
          </Card>
        )}

        <Card>
          <span className="eyebrow">Étape 3</span>
          <h2>{isTextActivity ? "Corrections du texte" : "Ordre des corrections"}</h2>
          {corrections.length === 0 ? (
            <p>Aucune correction définie.</p>
          ) : (
            <div className="correction-list">
              {[...corrections].sort((a, b) => a.revealOrder - b.revealOrder).map((correction, index) => {
                const code = correctionCodes.find((item) => item.id === correction.correctionCodeId);
                return (
                  <div className="correction-row" key={correction.id}>
                    <span className="order-chip">{correction.revealOrder}</span>
                    <div>
                      <strong>{correction.originalText} → {correction.correctedText}</strong>
                      <small>{code?.code ?? "?"} · {correction.points} point{correction.points > 1 ? "s" : ""}</small>
                    </div>
                    <div className="row-actions">
                      <button type="button" aria-label="Monter" disabled={index === 0} onClick={() => moveCorrection(correction.id, -1)}><ArrowUp size={17} /></button>
                      <button type="button" aria-label="Descendre" disabled={index === corrections.length - 1} onClick={() => moveCorrection(correction.id, 1)}><ArrowDown size={17} /></button>
                      <button type="button" aria-label="Supprimer" onClick={() => removeCorrection(correction.id)}><Trash2 size={17} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>


        {message && <div className="form-message" role="alert">{message}</div>}

        <div className="editor-save-row">
          <Button type="submit">
            <Save size={18} />
            {isTextActivity ? "Enregistrer le texte" : "Enregistrer l’activité"}
          </Button>
        </div>
      </div>

      <aside className="editor-preview">
        <Card className="workflow-sticky-card">
          <GrammarWorkflowPlanner phases={workflowPhases} onChange={setWorkflowPhases} />
        </Card>
        {grammarAnnotations.length > 0 && <Card><span className="eyebrow">Réponses grammaticales</span><div className="grammar-annotation-list">{grammarAnnotations.map((annotation) => <div className={annotation.parentAnnotationId ? "nested" : ""} key={annotation.id}><span>{annotation.parentAnnotationId ? "↳ " : ""}{annotationLabels[annotation.kind as Exclude<GrammarAnnotationKind, "error">] ?? annotation.kind}</span><strong>{originalText.slice(annotation.start, annotation.end)}</strong><small>{annotation.label} · {visualLabels[annotation.visualEffect?.kind ?? "none"]} · {annotation.responseMode === "frame" ? "tracer" : annotation.responseMode === "brackets" ? "crochets" : "cliquer"}</small><button type="button" onClick={() => setGrammarAnnotations((items) => items.filter((item) => item.id !== annotation.id))}><Trash2 size={15}/></button></div>)}</div></Card>}
        <Card>
          <span className="eyebrow">Aperçu</span>
          <span className="activity-type-badge">
            {isTextActivity ? "Texte à corriger" : "Phrase à corriger"}
          </span>
          <h2>{title || "Sans titre"}</h2>
          <div className="teacher-preview-frame">
            <SentenceRenderer sentence={previewSentence} />
          </div>
          <div className="corrected-preview">
            <span className="eyebrow">
              {isTextActivity ? "Texte corrigé" : "Phrase corrigée"}
            </span>
            <SentenceRenderer sentence={previewSentence} showCorrected />
          </div>
          <div className="preview-meta">
            <span>{corrections.length} correction{corrections.length > 1 ? "s" : ""}</span>
            <span>{corrections.reduce((sum, item) => sum + item.points, 0)} points</span>
          </div>
        </Card>
      </aside>
    </form>
  );
}
