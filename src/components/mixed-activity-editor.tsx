"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  GitBranch,
  Pencil,
  Pilcrow,
  Play,
  Printer,
  Save,
  SpellCheck2,
  Trash2,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GrammarWorkflowPlanner } from "@/components/grammar-workflow-planner";
import { GrammarInteractionModal } from "@/components/grammar/grammar-interaction-modal";
import type {
  GrammarInteractionDraft,
  GrammarInteractionKind
} from "@/components/grammar/grammar-interaction-modal";
import {
  captureSharedTextSelection,
  rebaseSharedTextRange,
  renderSharedAnnotatedText
} from "@/components/grammar/shared-annotated-text";
import {
  createWorkflowPhase,
  getSentenceWorkflow,
  grammarObjectiveLabels,
  grammarPhaseLabels,
  normalizeGrammarWorkflow,
  objectiveFromActivityType
} from "@/lib/grammar-workflow";
import {
  grammarAnnotationAnswers,
  grammarAnnotationLabels,
  sentenceFunctionOptions
} from "@/lib/grammar-definitions";
import { wordClassLabels } from "@/lib/activity-types";
import { InteractiveSentenceReader } from "@/components/presentation/interactive-sentence-reader";
import { WordClassReader } from "@/components/presentation/word-class-reader";
import { CorrectionPrintSheet } from "@/components/presentation/correction-print-sheet";
import type { CorrectionPrintSheetHandle } from "@/components/presentation/correction-print-sheet";
import { ReaderChromeProvider, ReaderChromeTarget } from "@/components/presentation/reader-chrome";
import { buildMixedWordClassSentence } from "@/lib/mixed-word-class-adapter";
import type {
  AgreementCorrectionArrow,
  CorrectionCode,
  GrammarAnnotation,
  GrammarObjective,
  GrammarPhaseKind,
  GrammarWorkflowPhase,
  SchoolLevel,
  Sentence,
  SentenceCorrection,
  SentenceDifficulty
} from "@/types";

type Props = {
  initialSentence?: Sentence;
  levels: SchoolLevel[];
  correctionCodes: CorrectionCode[];
  onSave: (sentence: Sentence) => void;
};

function correctedTeacherSentence(sentence: Sentence) {
  const ordered = [...sentence.corrections].sort((left, right) => left.start - right.start);
  let cursor = 0;
  let correctedText = "";
  ordered.forEach((correction) => {
    correctedText += sentence.originalText.slice(cursor, correction.start) + correction.correctedText;
    cursor = correction.end;
  });
  correctedText += sentence.originalText.slice(cursor);

  function mapPosition(position: number, affinity: "start" | "end" = "start") {
    let delta = 0;
    for (const correction of ordered) {
      if (position >= correction.end) {
        delta += correction.correctedText.length - (correction.end - correction.start);
        continue;
      }
      if (position > correction.start) {
        return correction.start + delta + (affinity === "end" ? correction.correctedText.length : 0);
      }
      break;
    }
    return position + delta;
  }

  return {
    sentence: {
      ...sentence,
      originalText: correctedText,
      corrections: [],
      grammarAnnotations: (sentence.grammarAnnotations ?? []).map((annotation) => ({
        ...annotation,
        start: mapPosition(annotation.start, "start"),
        end: mapPosition(annotation.end, "end")
      }))
    },
    correctionMarks: ordered.map((correction) => {
      const start = mapPosition(correction.start, "start");
      return { id: `teacher-correction-${correction.id}`, start, end: start + correction.correctedText.length, correctionCodeId: correction.correctionCodeId };
    })
  };
}

type Selection = {
  start: number;
  end: number;
  text: string;
};

const phaseByKind: Record<GrammarInteractionKind, GrammarPhaseKind> = {
  group: "groups",
  nucleus: "groups",
  function: "functions",
  word_class: "word_classes",
  donor: "agreements",
  receiver: "agreements",
  gender_number: "gender_number"
};

const visualByKind: Record<
  GrammarInteractionKind,
  GrammarAnnotation["visualEffect"]
> = {
  group: { kind: "brackets" },
  function: { kind: "frame" },
  nucleus: { kind: "color", color: "#d93434" },
  word_class: { kind: "underline", color: "#2467d1" },
  donor: { kind: "highlight", color: "#fde68a" },
  receiver: { kind: "underline", color: "#22834b" },
  gender_number: { kind: "none" }
};

const nucleusClassByGroup: Record<
  string,
  "noun" | "verb" | "adjective" | "adverb" | "preposition"
> = {
  GN: "noun",
  GV: "verb",
  GAdj: "adjective",
  GAdv: "adverb",
  GPrep: "preposition",
  GPrép: "preposition"
};

export function MixedActivityEditor({
  initialSentence,
  levels,
  correctionCodes,
  onSave
}: Props) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const correctionPrintRef = useRef<CorrectionPrintSheetHandle>(null);
  const rememberedSelectionRef = useRef<Selection | null>(null);
  const workingTextRef = useRef(initialSentence?.originalText ?? "");
  const createdAt = useMemo(
    () => initialSentence?.createdAt ?? new Date().toISOString(),
    [initialSentence?.createdAt]
  );

  const [title, setTitle] = useState(initialSentence?.title ?? "");
  const [levelId, setLevelId] = useState(
    initialSentence?.levelId ?? levels[0]?.id ?? ""
  );
  const [difficulty, setDifficulty] = useState<SentenceDifficulty>(
    initialSentence?.difficulty ?? "medium"
  );
  const [primaryObjective, setPrimaryObjective] = useState<GrammarObjective>(
    initialSentence?.primaryObjective ?? (
      initialSentence
        ? objectiveFromActivityType(initialSentence.activityType)
        : "mixed_grammar"
    )
  );
  const [text, setText] = useState(initialSentence?.originalText ?? "");
  const [annotations, setAnnotations] = useState<GrammarAnnotation[]>(() => {
    const initial = initialSentence?.grammarAnnotations ?? [];
    const hadLegacyArrowAction = initialSentence?.workflowPhases?.some(
      (phase) =>
        phase.kind === "agreements" &&
        phase.actions.some(
          (action) => action.kind === "link_agreement" && action.enabled
        )
    );
    if (!hadLegacyArrowAction) return initial;
    return initial.map((annotation) =>
      annotation.kind === "donor"
        ? { ...annotation, responseMode: "arrow" as const, visualEffect: { kind: "none" as const } }
        : annotation
    );
  });
  const [corrections, setCorrections] = useState<SentenceCorrection[]>(
    initialSentence?.corrections ?? []
  );
  const [phases, setPhases] = useState<GrammarWorkflowPhase[]>(() =>
    normalizeGrammarWorkflow(
      initialSentence ? getSentenceWorkflow(initialSentence) : [],
      Boolean(
        initialSentence?.grammarAnnotations?.some(
          (annotation) => annotation.kind === "nucleus"
        )
      )
    )
  );
  const [selection, setSelection] = useState<Selection | null>(null);
  const [draft, setDraft] = useState<GrammarInteractionDraft | null>(null);
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(
    null
  );
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionIsInsertion, setCorrectionIsInsertion] = useState(false);
  const [correctedText, setCorrectedText] = useState("");
  const [correctionCodeId, setCorrectionCodeId] = useState(
    correctionCodes.find((code) => code.isActive !== false)?.id ?? ""
  );
  const [showTest, setShowTest] = useState(false);
  const [showArrowCorrection, setShowArrowCorrection] = useState(false);
  const [agreementCorrectionArrows, setAgreementCorrectionArrows] = useState<AgreementCorrectionArrow[]>(
    initialSentence?.agreementCorrectionArrows ?? []
  );
  const [testRunId, setTestRunId] = useState(0);
  const [surfaceRevision, setSurfaceRevision] = useState(0);
  const [message, setMessage] = useState("");
  const [collapsedAnswerPhases, setCollapsedAnswerPhases] = useState<string[]>([]);
  const [showWorkflowPlanner, setShowWorkflowPlanner] = useState(false);

  const activeCorrectionCodes = useMemo(
    () => correctionCodes.filter((code) => code.isActive !== false),
    [correctionCodes]
  );

  const sentence = useMemo<Sentence>(
    () => ({
      id: initialSentence?.id ?? "mixed-preview",
      activityType:
        primaryObjective === "text_correction"
          ? "text_correction"
          : "sentence_correction",
      primaryObjective,
      isMixedActivity: true,
      title: title.trim() || "Activité grammaticale",
      levelId,
      difficulty,
      tags: initialSentence?.tags ?? [],
      originalText: text,
      corrections,
      grammarAnnotations: annotations,
      workflowPhases: phases,
      agreementCorrectionArrows,
      assignedGroupIds: initialSentence?.assignedGroupIds ?? [],
      showCorrectionCount: true,
      createdAt,
      updatedAt: createdAt
    }),
    [
      annotations,
      agreementCorrectionArrows,
      corrections,
      createdAt,
      difficulty,
      initialSentence?.assignedGroupIds,
      initialSentence?.id,
      initialSentence?.tags,
      levelId,
      phases,
      primaryObjective,
      text,
      title
    ]
  );

  const agreementCorrectionSentence = useMemo(
    () => buildMixedWordClassSentence(correctedTeacherSentence(sentence).sentence),
    [sentence]
  );
  const teacherCorrectionMarks = useMemo(() => correctedTeacherSentence(sentence).correctionMarks.map((mark) => ({
    id: mark.id,
    start: mark.start,
    end: mark.end,
    label: correctionCodes.find((code) => code.id === mark.correctionCodeId)?.code ?? "?"
  })), [correctionCodes, sentence]);
  const hasAgreementLinks = Boolean(
    annotations.some(
      (annotation) =>
        (annotation.kind === "donor" || annotation.kind === "receiver") &&
        annotation.responseMode === "arrow"
    ) &&
    (agreementCorrectionSentence.agreementRelations ?? []).some(
      (relation) => (relation.arrowReceiverIds?.length ?? 0) > 0
    )
  );
  const interactiveAnswerSections = useMemo(() => {
    const annotationPhase = (annotation: GrammarAnnotation) =>
      phaseByKind[annotation.kind as GrammarInteractionKind];
    const annotationById = new Map(annotations.map((annotation) => [annotation.id, annotation]));
    const orderedPhaseKinds = phases.map((phase) => phase.kind);
    const phaseKeys = Array.from(
      new Set([
        ...orderedPhaseKinds,
        ...(corrections.length ? ["correction"] : []),
        ...annotations.map(annotationPhase)
      ])
    ).filter((kind): kind is GrammarPhaseKind => Boolean(kind) && kind !== "review");

    const childrenByParent = new Map<string, GrammarAnnotation[]>();
    annotations.forEach((annotation) => {
      if (!annotation.parentAnnotationId) return;
      const parent = annotationById.get(annotation.parentAnnotationId);
      if (!parent || annotationPhase(parent) !== annotationPhase(annotation)) return;
      const list = childrenByParent.get(annotation.parentAnnotationId) ?? [];
      list.push(annotation);
      childrenByParent.set(annotation.parentAnnotationId, list);
    });

    return phaseKeys.map((kind) => {
      const phase = phases.find((candidate) => candidate.kind === kind);
      const phaseAnnotations = annotations.filter(
        (annotation) => {
          if (annotationPhase(annotation) !== kind) return false;
          if (!annotation.parentAnnotationId) return true;
          const parent = annotationById.get(annotation.parentAnnotationId);
          return !parent || annotationPhase(parent) !== kind;
        }
      );
      return {
        kind,
        title: phase?.title ?? grammarPhaseLabels[kind],
        corrections: kind === "correction" ? corrections : [],
        annotations: phaseAnnotations,
        childrenByParent
      };
    }).filter((section) => section.corrections.length || section.annotations.length);
  }, [annotations, corrections, phases]);
  const arrowAuthoringSignature = useMemo(
    () => JSON.stringify({
      text,
      corrections: corrections.map((correction) => ({ id: correction.id, start: correction.start, end: correction.end, correctedText: correction.correctedText })),
      annotations: annotations
        .filter((annotation) => annotation.kind === "donor" || annotation.kind === "receiver" || annotation.kind === "word_class")
        .map((annotation) => ({ id: annotation.id, kind: annotation.kind, start: annotation.start, end: annotation.end, parent: annotation.parentAnnotationId, linked: annotation.linkedAnnotationId }))
    }),
    [annotations, corrections, text]
  );
  const previousArrowAuthoringSignatureRef = useRef(arrowAuthoringSignature);

  useEffect(() => {
    if (previousArrowAuthoringSignatureRef.current === arrowAuthoringSignature) return;
    previousArrowAuthoringSignatureRef.current = arrowAuthoringSignature;
    if (agreementCorrectionArrows.length === 0) return;
    setAgreementCorrectionArrows([]);
    setMessage("Le texte ou les liens d’accord ont changé. Retrace les flèches du corrigé avant d’imprimer.");
  }, [agreementCorrectionArrows.length, arrowAuthoringSignature]);

  function commitSurfaceText(nextText?: string) {
    const value = (
      nextText ?? surfaceRef.current?.innerText ?? workingTextRef.current
    ).replace(/\r/g, "");
    workingTextRef.current = value;
    if (value === text) return value;

    setAnnotations((current) =>
      current
        .map((annotation) => ({
          ...annotation,
          ...rebaseSharedTextRange(
            text,
            value,
            annotation.start,
            annotation.end
          )
        }))
        .filter((annotation) => annotation.start < annotation.end)
    );
    setCorrections((current) =>
      current
        .map((correction) => {
          const range = rebaseSharedTextRange(
            text,
            value,
            correction.start,
            correction.end
          );
          return {
            ...correction,
            ...range,
            originalText: correction.originalText.length === 0
              ? ""
              : value.slice(range.start, range.end)
          };
        })
        .filter(
          (correction) =>
            correction.start < correction.end ||
            correction.originalText.length === 0
        )
    );
    setText(value);
    setSurfaceRevision((current) => current + 1);
    return value;
  }

  function captureSelection() {
    const element = surfaceRef.current;
    const range = element ? captureSharedTextSelection(element) : null;
    if (!range || range.start === range.end) {
      return rememberedSelectionRef.current;
    }

    const currentText = (element?.innerText ?? workingTextRef.current).replace(
      /\r/g,
      ""
    );
    let start = Math.min(range.start, range.end);
    let end = Math.max(range.start, range.end);
    while (start < end && /\s/.test(currentText[start] ?? "")) start += 1;
    while (end > start && /\s/.test(currentText[end - 1] ?? "")) end -= 1;
    if (start === end) return rememberedSelectionRef.current;

    const value = { start, end, text: currentText.slice(start, end) };
    rememberedSelectionRef.current = value;
    setSelection(value);
    commitSurfaceText(currentText);
    return value;
  }

  function selected() {
    const value = captureSelection();
    if (!value) {
      setMessage("Sélectionne d’abord un mot ou un passage dans la phrase.");
    } else {
      setMessage("");
    }
    return value;
  }


  function ensurePhase(kind: GrammarPhaseKind) {
    setPhases((current) =>
      current.some((phase) => phase.kind === kind)
        ? current
        : [...current, createWorkflowPhase(kind)]
    );
  }

  function openCorrection() {
    const range = selected();
    if (!range) return;

    setCorrectionIsInsertion(false);
    setCorrectedText("");
    setCorrectionCodeId(activeCorrectionCodes[0]?.id ?? "");
    setCorrectionOpen(true);
  }

  function openPunctuationCorrection() {
    const element = surfaceRef.current;
    const range = element ? captureSharedTextSelection(element) : null;
    const currentText = (element?.innerText ?? workingTextRef.current).replace(/\r/g, "");
    if (!range || range.start !== range.end) {
      setMessage(
        "Place le curseur exactement à l’endroit où la ponctuation manque."
      );
      return;
    }

    const overlaps = corrections.some(
      (correction) =>
        correction.start === range.start ||
        (range.start > correction.start && range.start < correction.end)
    );
    if (overlaps) {
      setMessage("Une correction existe déjà à cet endroit.");
      return;
    }

    commitSurfaceText(currentText);
    const value = { start: range.start, end: range.start, text: "" };
    const punctuationCode =
      activeCorrectionCodes.find((code) => code.category === "punctuation") ??
      activeCorrectionCodes[0];

    rememberedSelectionRef.current = value;
    setSelection(value);
    setCorrectionIsInsertion(true);
    setCorrectedText("");
    setCorrectionCodeId(punctuationCode?.id ?? "");
    setCorrectionOpen(true);
    setMessage("");
  }

  function openAnnotation(kind: GrammarInteractionKind) {
    const range = selected();
    if (!range) return;

    const classAnnotation =
      kind === "gender_number"
        ? annotations.find(
            (item) =>
              item.kind === "word_class" &&
              item.start === range.start &&
              item.end === range.end
          )
        : undefined;

    if (kind === "gender_number" && !classAnnotation) {
      setMessage(
        "Ajoute d’abord la classe de mot sur exactement ce mot, puis sélectionne Genre et nombre."
      );
      return;
    }

    setEditingAnnotationId(null);
    const label =
      grammarAnnotationAnswers[kind]?.[0] ?? grammarAnnotationLabels[kind];
    const responseMode =
      kind === "nucleus" ||
      kind === "word_class" ||
      kind === "gender_number" ||
      kind === "donor" ||
      kind === "receiver"
        ? "click"
        : "brackets";

    setDraft({
      kind,
      label,
      responseMode,
      instruction:
        kind === "gender_number"
          ? "Indique le genre, puis le nombre de ce mot."
          : responseMode === "click"
            ? `Clique sur ${label.toLowerCase()}.`
            : `Mets ${label.toLowerCase()} entre crochets.`,
      nucleusWordClass: "noun",
      linkedTargetId: "",
      visualEffect:
        kind === "donor" || kind === "receiver"
          ? { kind: "none" }
          : visualByKind[kind],
      parentAnnotationId: classAnnotation?.id,
      grammaticalGender: kind === "gender_number" ? "feminine" : undefined,
      grammaticalNumber: kind === "gender_number" ? "singular" : undefined,
      wordClassInteractionMode:
        kind === "word_class" ? "find_requested" : undefined
    });
  }

  function editAnnotation(annotation: GrammarAnnotation) {
    const range = {
      start: annotation.start,
      end: annotation.end,
      text: text.slice(annotation.start, annotation.end)
    };
    const childNucleus =
      annotation.kind === "group"
        ? annotations.find(
            (item) =>
              item.kind === "nucleus" &&
              item.parentAnnotationId === annotation.id
          )
        : undefined;

    setSelection(range);
    rememberedSelectionRef.current = range;
    setEditingAnnotationId(annotation.id);
    setDraft({
      kind: annotation.kind as GrammarInteractionKind,
      label:
        annotation.label ??
        grammarAnnotationLabels[annotation.kind as GrammarInteractionKind],
      responseMode: annotation.responseMode ?? "click",
      instruction:
        annotation.responseMode === "arrow"
          ? annotation.kind === "donor"
            ? `Trace une flèche de ${(annotation.label ?? "ce donneur").toLowerCase()} vers ses receveurs.`
            : `Trace une flèche du donneur vers ${(annotation.label ?? "ce receveur").toLowerCase()}.`
          : annotation.responseMode === "brackets"
          ? `Mets ${(annotation.label ?? "ce passage").toLowerCase()} entre crochets.`
          : annotation.responseMode === "frame"
            ? `Encadre ${(annotation.label ?? "ce passage").toLowerCase()}.`
            : `Clique sur ${(annotation.label ?? "ce passage").toLowerCase()}.`,
      nucleusWordClass: "noun",
      linkedTargetId: "",
      visualEffect: annotation.visualEffect,
      parentAnnotationId: annotation.parentAnnotationId,
      groupNucleusStart: childNucleus?.start,
      groupNucleusEnd: childNucleus?.end,
      skipGroupNucleus: annotation.kind === "group" && !childNucleus,
      grammaticalGender: annotation.grammaticalGender,
      grammaticalNumber: annotation.grammaticalNumber,
      wordClassInteractionMode: annotation.wordClassInteractionMode
    });
  }

  function saveAnnotation() {
    if (!draft || !selection) return;

    const label = draft.kind === "group" && draft.label === "GPrép"
      ? "GPrep"
      : draft.label;
    const annotationId = editingAnnotationId ?? crypto.randomUUID();
    const createsGroupNucleus =
      draft.kind === "group" &&
      !draft.skipGroupNucleus &&
      draft.groupNucleusStart !== undefined &&
      draft.groupNucleusEnd !== undefined;
    const hasOtherNucleus = annotations.some(
      (item) =>
        item.kind === "nucleus" &&
        item.parentAnnotationId !== annotationId
    );
    const hasNucleiAfterSave = hasOtherNucleus || createsGroupNucleus;
    const annotation: GrammarAnnotation = {
      id: annotationId,
      start: selection.start,
      end: selection.end,
      kind: draft.kind,
      label,
      responseMode: draft.responseMode,
      visualEffect:
        draft.kind === "donor" || draft.kind === "receiver"
          ? { kind: "none" }
          : draft.visualEffect ?? visualByKind[draft.kind],
      parentAnnotationId: draft.parentAnnotationId,
      grammaticalGender: draft.grammaticalGender,
      grammaticalNumber: draft.grammaticalNumber,
      wordClassInteractionMode: draft.wordClassInteractionMode
    };

    setAnnotations((current) => {
      let next = editingAnnotationId
        ? current.map((item) =>
            item.id === editingAnnotationId ? annotation : item
          )
        : [...current, annotation];

      if (draft.kind === "group" && draft.skipGroupNucleus) {
        next = next.filter(
          (item) =>
            !(
              item.kind === "nucleus" &&
              item.parentAnnotationId === annotationId
            )
        );
      }

      if (createsGroupNucleus) {
        const nucleusWordClass = nucleusClassByGroup[label] ?? "noun";
        const existingNucleus = next.find(
          (item) =>
            item.kind === "nucleus" &&
            item.parentAnnotationId === annotationId
        );
        const nucleus: GrammarAnnotation = {
          id: existingNucleus?.id ?? crypto.randomUUID(),
          start: draft.groupNucleusStart!,
          end: draft.groupNucleusEnd!,
          kind: "nucleus",
          label: wordClassLabels[nucleusWordClass],
          responseMode: "click",
          visualEffect: visualByKind.nucleus,
          parentAnnotationId: annotationId
        };
        next = existingNucleus
          ? next.map((item) =>
              item.id === existingNucleus.id ? nucleus : item
            )
          : [...next, nucleus];
      }

      return next;
    });

    ensurePhase(phaseByKind[draft.kind]);
    if (draft.kind === "group") {
      setPhases((current) =>
        current.map((phase) =>
          phase.kind === "groups"
            ? {
                ...phase,
                actions: phase.actions.map((action) =>
                  action.kind === "find_nuclei"
                    ? { ...action, enabled: hasNucleiAfterSave }
                    : action
                )
              }
            : phase
        )
      );
    }

    setSurfaceRevision((current) => current + 1);
    setDraft(null);
    setEditingAnnotationId(null);
  }

  function removeAnnotation(annotation: GrammarAnnotation) {
    setAnnotations((current) => {
      const removedIds = new Set([
        annotation.id,
        ...current
          .filter((item) => item.parentAnnotationId === annotation.id)
          .map((item) => item.id)
      ]);
      return current.filter((item) => !removedIds.has(item.id));
    });
    setSurfaceRevision((current) => current + 1);
  }

  function saveCorrection() {
    if (
      !selection ||
      !correctedText.trim() ||
      !correctionCodeId
    ) {
      return;
    }

    setCorrections((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        start: selection.start,
        end: selection.end,
        originalText: correctionIsInsertion ? "" : selection.text,
        correctedText: correctedText.trim(),
        correctionCodeId,
        points: 1,
        revealOrder: current.length + 1
      }
    ]);
    ensurePhase("correction");
    setCorrectionOpen(false);
    setCorrectionIsInsertion(false);
    setCorrectedText("");
  }

  function openTest() {
    commitSurfaceText();
    window.requestAnimationFrame(() => {
      setTestRunId((current) => current + 1);
      setShowTest(true);
    });
  }

  async function printCorrection() {
    commitSurfaceText();
    if (hasAgreementLinks && agreementCorrectionArrows.length === 0) {
      setMessage("Trace d’abord les flèches du corrigé enseignant avant d’imprimer.");
      setShowArrowCorrection(true);
      return;
    }
    try {
      await correctionPrintRef.current?.capture();
      window.print();
    } catch {
      setMessage("Le corrigé n’a pas pu être préparé pour l’impression. Réessaie.");
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !text.trim() || !levelId) {
      setMessage("Le titre, le niveau et la phrase sont obligatoires.");
      return;
    }

    onSave({
      ...sentence,
      id: initialSentence?.id ?? crypto.randomUUID(),
      title: title.trim(),
      updatedAt: new Date().toISOString()
    });
  }

  const marks = annotations.map((annotation) => ({
    id: annotation.id,
    start: annotation.start,
    end: annotation.end,
    color:
      annotation.visualEffect?.kind === "color"
        ? annotation.visualEffect.color
        : undefined,
    backgroundColor:
      annotation.visualEffect?.kind === "highlight"
        ? annotation.visualEffect.color
        : undefined,
    underlineColor:
      annotation.visualEffect?.kind === "underline"
        ? annotation.visualEffect.color
        : undefined,
    framed:
      annotation.visualEffect?.kind === "frame" ||
      annotation.visualEffect?.kind === "brackets"
        ? true
        : undefined,
    bold: annotation.visualEffect?.kind === "bold" ? true : undefined
  }));

  const parentOptions = annotations.map((annotation) => ({
    id: annotation.id,
    label: `${
      grammarAnnotationLabels[annotation.kind as GrammarInteractionKind]
    } — ${text.slice(annotation.start, annotation.end)}`
  }));

  const groupNucleusOptions = selection
    ? Array.from(
        selection.text.matchAll(/[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu)
      ).map((match) => ({
        start: selection.start + (match.index ?? 0),
        end: selection.start + (match.index ?? 0) + match[0].length,
        text: match[0]
      }))
    : [];

  return (
    <>
      <form className="mixed-workspace" onSubmit={submit}>
        <header className="mixed-workspace-meta">
          <div className="mixed-workspace-meta-fields">
            <label>
              Titre
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label>
              Objectif principal
              <select
                value={primaryObjective}
                onChange={(event) =>
                  setPrimaryObjective(event.target.value as GrammarObjective)
                }
              >
                {(Object.entries(grammarObjectiveLabels) as Array<
                  [GrammarObjective, string]
                >).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Niveau
              <select
                value={levelId}
                onChange={(event) => setLevelId(event.target.value)}
              >
                {levels.map((level) => (
                  <option value={level.id} key={level.id}>
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
                  setDifficulty(event.target.value as SentenceDifficulty)
                }
              >
                <option value="easy">Facile</option>
                <option value="medium">Moyenne</option>
                <option value="hard">Difficile</option>
              </select>
            </label>
          </div>
          <div className="mixed-workspace-meta-actions">
            <Button type="button" variant="secondary" onClick={openTest}>
              <Play size={17} />
              Tester
            </Button>
            {hasAgreementLinks && (
              <Button type="button" variant="secondary" onClick={() => setShowArrowCorrection(true)}>
                <GitBranch size={17} />
                {agreementCorrectionArrows.length > 0 ? "Modifier les flèches" : "Tracer les flèches du corrigé"}
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={printCorrection}>
              <Printer size={17} />
              Imprimer le corrigé
            </Button>
            <Button type="submit">
              <Save size={17} />
              Enregistrer
            </Button>
          </div>
        </header>

        <div className="mixed-workspace-grid">
          <main className="mixed-workspace-editor">
            <div
              className="mixed-workspace-toolbar"
              onMouseDown={(event) => event.preventDefault()}
            >
              <button type="button" onClick={openCorrection}>
                <SpellCheck2 size={16} />
                Erreur
              </button>
              <button type="button" onClick={openPunctuationCorrection}>
                <Pilcrow size={16} />
                Ponctuation manquante
              </button>
              {(
                [
                  "group",
                  "function",
                  "word_class",
                  "gender_number",
                  "donor",
                  "receiver"
                ] as GrammarInteractionKind[]
              ).map((kind) => (
                <button
                  type="button"
                  key={kind}
                  onClick={() => openAnnotation(kind)}
                >
                  {grammarAnnotationLabels[kind]}
                </button>
              ))}
            </div>

            <section className="mixed-workspace-surface">
              <span className="eyebrow">Phrase ou texte de travail</span>
              <div
                key={surfaceRevision}
                ref={surfaceRef}
                className="mixed-workspace-editable"
                contentEditable
                suppressContentEditableWarning
                spellCheck
                onMouseUp={captureSelection}
                onKeyUp={captureSelection}
                onInput={(event) => {
                  workingTextRef.current = event.currentTarget.innerText.replace(/\r/g, "");
                }}
                onBlur={(event) => commitSurfaceText(event.currentTarget.innerText)}
                data-placeholder="Écris ou colle le contenu ici…"
              >
                {renderSharedAnnotatedText(
                  text,
                  marks,
                  "tree-analysis-framed-text"
                )}
              </div>
              <small>
                Sélectionne directement un passage, puis choisis sa mécanique
                dans la barre. Les réponses restent visibles dans cette même
                zone.
              </small>
            </section>

            <section className="mixed-workspace-answers">
              <div className="mixed-workspace-answers-heading">
                <div>
                  <span className="eyebrow">Déroulement interactif</span>
                  <h3>Actions créées</h3>
                </div>
                <div className="mixed-answer-heading-actions">
                  <button
                    type="button"
                    onClick={() => setShowWorkflowPlanner((value) => !value)}
                  >
                    {showWorkflowPlanner ? "Masquer l’organisation" : "Organiser le déroulement"}
                  </button>
                  <span>{phases.length} phase{phases.length > 1 ? "s" : ""}</span>
                  <span>{corrections.length + annotations.length}</span>
                </div>
              </div>
              {showWorkflowPlanner && (
                <div className="mixed-inline-workflow">
                  <GrammarWorkflowPlanner phases={phases} onChange={setPhases} />
                </div>
              )}
              {!interactiveAnswerSections.length && (
                <p className="mixed-answer-empty">Sélectionne un passage dans la phrase, puis choisis une mécanique dans la barre.</p>
              )}
              {interactiveAnswerSections.map((section) => {
                const collapsed = collapsedAnswerPhases.includes(section.kind);
                const total = section.corrections.length + section.annotations.length;
                return (
                  <div className="mixed-answer-section" key={section.kind}>
                    <button
                      type="button"
                      className="mixed-answer-section-toggle"
                      onClick={() =>
                        setCollapsedAnswerPhases((current) =>
                          current.includes(section.kind)
                            ? current.filter((kind) => kind !== section.kind)
                            : [...current, section.kind]
                        )
                      }
                    >
                      {collapsed ? <ChevronRight size={17} /> : <ChevronDown size={17} />}
                      <strong>{section.title}</strong>
                      <span>{total}</span>
                    </button>
                    {!collapsed && (
                      <div className="mixed-answer-section-items">
                        {section.corrections.map((correction) => (
                          <div className="mixed-answer-card" key={correction.id}>
                            <span>
                              {correction.originalText.length === 0
                                ? "Ponctuation"
                                : "Erreur"}
                            </span>
                            <strong>
                              {correction.originalText.length === 0
                                ? `Ajout : ${correction.correctedText}`
                                : `${correction.originalText} → ${correction.correctedText}`}
                            </strong>
                            <span className="mixed-answer-actions">
                              <button
                                type="button"
                                aria-label="Supprimer"
                                onClick={() =>
                                  setCorrections((current) =>
                                    current.filter((item) => item.id !== correction.id)
                                  )
                                }
                              >
                                <Trash2 size={15} />
                              </button>
                            </span>
                          </div>
                        ))}
                        {section.annotations.map((annotation) => (
                          <div className="mixed-answer-group" key={annotation.id}>
                            <div className="mixed-answer-card">
                              <span>
                                {
                                  grammarAnnotationLabels[
                                    annotation.kind as GrammarInteractionKind
                                  ]
                                }
                              </span>
                              <strong>
                                {text.slice(annotation.start, annotation.end)} — {annotation.label}
                                {annotation.kind === "gender_number" &&
                                annotation.grammaticalGender &&
                                annotation.grammaticalNumber
                                  ? ` — ${
                                      annotation.grammaticalGender === "feminine"
                                        ? "Fém."
                                        : "Masc."
                                    }, ${
                                      annotation.grammaticalNumber === "singular"
                                        ? "Sing."
                                        : "Plur."
                                    }`
                                  : ""}
                                {annotation.parentAnnotationId && (
                                  <small>
                                    Après : {
                                      annotations.find(
                                        (item) => item.id === annotation.parentAnnotationId
                                      )?.label
                                    }
                                  </small>
                                )}
                              </strong>
                              <span className="mixed-answer-actions">
                                <button
                                  type="button"
                                  aria-label="Modifier"
                                  onClick={() => editAnnotation(annotation)}
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  type="button"
                                  aria-label="Supprimer"
                                  onClick={() => removeAnnotation(annotation)}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </span>
                            </div>
                            {(section.childrenByParent.get(annotation.id) ?? []).map((child) => (
                              <div className="mixed-answer-card is-child" key={child.id}>
                                <span>
                                  {
                                    grammarAnnotationLabels[
                                      child.kind as GrammarInteractionKind
                                    ]
                                  }
                                </span>
                                <strong>
                                  {text.slice(child.start, child.end)} — {child.label}
                                  {child.kind === "gender_number" &&
                                  child.grammaticalGender &&
                                  child.grammaticalNumber
                                    ? ` — ${
                                        child.grammaticalGender === "feminine"
                                          ? "Fém."
                                          : "Masc."
                                      }, ${
                                        child.grammaticalNumber === "singular"
                                          ? "Sing."
                                          : "Plur."
                                      }`
                                    : ""}
                                  <small>Après : {annotation.label}</small>
                                </strong>
                                <span className="mixed-answer-actions">
                                  <button
                                    type="button"
                                    aria-label="Modifier"
                                    onClick={() => editAnnotation(child)}
                                  >
                                    <Pencil size={15} />
                                  </button>
                                  <button
                                    type="button"
                                    aria-label="Supprimer"
                                    onClick={() => removeAnnotation(child)}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>

            {message && <div className="form-message">{message}</div>}
          </main>
        </div>

        <GrammarInteractionModal
          open={Boolean(draft)}
          draft={
            draft ?? {
              kind: "function",
              label: "Sujet",
              instruction: "",
              responseMode: "brackets",
              nucleusWordClass: "noun",
              linkedTargetId: "",
              visualEffect: { kind: "brackets" }
            }
          }
          functionOptions={sentenceFunctionOptions}
          wordClassLabels={wordClassLabels}
          kinds={draft ? [draft.kind] : ["group"]}
          responseModes={["click", "brackets", "frame"]}
          selectedText={selection?.text}
          showLinkedTarget={false}
          configureVisual
          configureGroupNucleus
          groupNucleusOptions={groupNucleusOptions}
          parentOptions={parentOptions}
          onChange={setDraft}
          onCancel={() => setDraft(null)}
          onSave={saveAnnotation}
        />

        {correctionOpen && (
          <div
            className="tree-analysis-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setCorrectionOpen(false);
            }}
          >
            <aside className="tree-analysis-inspector tree-analysis-modal">
              <div className="tree-analysis-modal-heading">
                <div>
                  <span className="eyebrow">
                    {correctionIsInsertion ? "Ponctuation" : "Correction"}
                  </span>
                  <h3>
                    {correctionIsInsertion
                      ? "Ponctuation manquante"
                      : `« ${selection?.text ?? ""} »`}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCorrectionOpen(false)}
                  aria-label="Fermer"
                >
                  <X size={18} />
                </button>
              </div>
              <label>
                {correctionIsInsertion
                  ? "Ponctuation attendue"
                  : "Correction attendue"}
                <input
                  value={correctedText}
                  onChange={(event) => setCorrectedText(event.target.value)}
                  placeholder={correctionIsInsertion ? "Ex. , ou ." : undefined}
                  autoFocus
                />
              </label>
              <label>
                Code
                <select
                  value={correctionCodeId}
                  onChange={(event) => setCorrectionCodeId(event.target.value)}
                >
                  {activeCorrectionCodes.map((code) => (
                    <option value={code.id} key={code.id}>
                      {code.code} — {code.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="tree-analysis-modal-actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setCorrectionOpen(false)}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  onClick={saveCorrection}
                  disabled={!correctedText.trim() || !correctionCodeId}
                >
                  {correctionIsInsertion
                    ? "Ajouter la ponctuation"
                    : "Ajouter l’erreur"}
                </Button>
              </div>
            </aside>
          </div>
        )}
      </form>

      {showTest && (
        <div
          className="mixed-workspace-test-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowTest(false);
          }}
        >
          <section
            className="mixed-workspace-test"
            role="dialog"
            aria-modal="true"
            aria-label="Tester l’activité"
          >
            <div className="mixed-workspace-test-heading">
              <div>
                <span className="eyebrow">Test du lecteur</span>
                <h2>Même activité, côté élève</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowTest(false)}
                aria-label="Fermer le test"
              >
                <X size={20} />
              </button>
            </div>
            <div className="reader-activity-flow">
              <InteractiveSentenceReader
                key={testRunId}
                sentence={sentence}
                correctionCodes={correctionCodes}
                onPoint={() => undefined}
                persistenceKey={`mixed-test-${
                  initialSentence?.id ?? "new"
                }-${testRunId}`}
                finishControl={
                  <Button type="button" disabled>
                    Terminé
                  </Button>
                }
              />
            </div>
          </section>
        </div>
      )}

      {showArrowCorrection && (
        <div className="mixed-workspace-test-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowArrowCorrection(false)}>
          <ReaderChromeProvider>
            <section className="mixed-workspace-test correction-arrow-author" role="dialog" aria-modal="true" aria-label="Tracer les flèches du corrigé">
              <div className="mixed-workspace-test-heading">
                <div><span className="eyebrow">Corrigé enseignant</span><h2>Trace seulement les flèches à imprimer</h2></div>
                <button type="button" onClick={() => setShowArrowCorrection(false)} aria-label="Fermer"><X size={20} /></button>
              </div>
              <div className="correction-arrow-command">
                <ReaderChromeTarget slot="instruction" />
                <ReaderChromeTarget slot="progress" />
              </div>
              <div className="reader-activity-flow correction-arrow-reader">
                <WordClassReader
                  sentence={agreementCorrectionSentence}
                  onPoint={() => undefined}
                  correctionArrowAuthoring
                  onAgreementCorrectionArrowsChange={setAgreementCorrectionArrows}
                  correctionMarks={teacherCorrectionMarks}
                />
              </div>
              <div className="correction-arrow-footer">
                <ReaderChromeTarget slot="contextTools" />
                <ReaderChromeTarget slot="actions" />
                <Button type="button" onClick={() => setShowArrowCorrection(false)}><Save size={17} /> Conserver les flèches</Button>
              </div>
              <ReaderChromeTarget slot="viewTools" />
            </section>
          </ReaderChromeProvider>
        </div>
      )}

      <CorrectionPrintSheet
        ref={correctionPrintRef}
        sentence={agreementCorrectionSentence}
        correctionMarks={teacherCorrectionMarks}
      />
    </>
  );
}
