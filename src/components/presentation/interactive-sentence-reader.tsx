"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Lightbulb, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReaderChromePortal } from "@/components/presentation/reader-chrome";
import { CorrectionPause } from "@/components/presentation/correction-pause";
import { GrammarExtensionReader } from "@/components/presentation/grammar-extension-reader";
import { WordClassReader } from "@/components/presentation/word-class-reader";
import { WordGroupReader } from "@/components/presentation/word-group-reader";
import { resolveCorrectionBounds } from "@/lib/correction-ranges";
import { buildMixedWordClassSentence } from "@/lib/mixed-word-class-adapter";
import { reviewPhaseImmediatelyAfter } from "@/lib/grammar-workflow";
import {
  endsWithFrenchElision,
  protectFrenchElisionBreaks
} from "@/lib/french-typography";
import type { ResolvedCorrectionMark } from "@/components/grammar/resolved-correction-labels";
import type { CorrectionCode, Sentence, SentenceCorrection, WordClassTarget, WordGroupTarget, WordGroupType } from "@/types";

type Props = {
  sentence: Sentence;
  displayMode?: "sentence" | "text";
  correctionCodes: CorrectionCode[];
  onPoint: (
    correction: SentenceCorrection,
    stage: "click" | "word" | "code",
    points: number
  ) => void;
  finishControl?: React.ReactNode;
  persistenceKey?: string;
  onRestorePoints?: (
    points: Array<{
      correction: SentenceCorrection;
      stage: "click" | "word" | "code";
      points: number;
    }>
  ) => void;
  onWordClassPoint?: (
    target: WordClassTarget,
    stage: "find" | "class" | "role" | "agreement",
    points: number,
    pointId?: string
  ) => void;
  onRestoreWordClassPoints?: (
    points: Array<{
      target: WordClassTarget;
      stage: "find" | "class" | "role" | "agreement";
      points: number;
      pointId?: string;
    }>
  ) => void;
  onCompleteChange?: (complete: boolean) => void;
};


type LayoutToken = {
  type: "text" | "correction" | "break";
  key: string;
  text: string;
  correction?: SentenceCorrection;
};

const hybridGroupTypes = new Set<WordGroupType>(["GN", "GV", "GAdj", "GAdv", "GPrep"]);

function normalizedCorrections(sentence: Sentence) {
  return sentence.corrections
    .map((correction) => ({
      ...correction,
      ...resolveCorrectionBounds(sentence.originalText, correction)
    }))
    .sort((a, b) => a.start - b.start);
}

function buildCorrectedText(sentence: Sentence) {
  let cursor = 0;
  let result = "";
  normalizedCorrections(sentence).forEach((correction) => {
    result += sentence.originalText.slice(cursor, correction.start) + correction.correctedText;
    cursor = correction.end;
  });
  return result + sentence.originalText.slice(cursor);
}

function mapOriginalPosition(sentence: Sentence, position: number, affinity: "start" | "end" = "start") {
  let delta = 0;
  for (const correction of normalizedCorrections(sentence)) {
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

function buildHybridGroupTargets(sentence: Sentence, correctedText: string): WordGroupTarget[] {
  const annotations = sentence.grammarAnnotations ?? [];
  const nuclei = annotations.filter((annotation) => annotation.kind === "nucleus");
  return annotations.filter((annotation) => annotation.kind === "group" && hybridGroupTypes.has(annotation.label as WordGroupType)).map((group) => {
    const nucleus = nuclei.find((candidate) => candidate.start >= group.start && candidate.end <= group.end);
    const start = mapOriginalPosition(sentence, group.start, "start");
    const end = mapOriginalPosition(sentence, group.end, "end");
    const nucleusStart = nucleus ? mapOriginalPosition(sentence, nucleus.start, "start") : start;
    const nucleusEnd = nucleus ? mapOriginalPosition(sentence, nucleus.end, "end") : Math.min(end, correctedText.indexOf(" ", start) > start ? correctedText.indexOf(" ", start) : end);
    return {
      id: group.id,
      start,
      end,
      text: correctedText.slice(start, end),
      groupType: group.label as WordGroupType,
      nucleusStart,
      nucleusEnd,
      nucleusText: correctedText.slice(nucleusStart, nucleusEnd),
      analyzeNucleus: Boolean(nucleus)
    };
  });
}

function buildCorrectedGrammarSentence(sentence: Sentence, correctedText: string): Sentence {
  return {
    ...sentence,
    originalText: correctedText,
    corrections: [],
    grammarAnnotations: (sentence.grammarAnnotations ?? []).map((annotation) => ({
      ...annotation,
      start: mapOriginalPosition(sentence, annotation.start, "start"),
      end: mapOriginalPosition(sentence, annotation.end, "end")
    })),
    wordClassTargets: (sentence.wordClassTargets ?? []).map((target) => {
      const start = mapOriginalPosition(sentence, target.start, "start");
      const end = mapOriginalPosition(sentence, target.end, "end");
      return { ...target, start, end, text: correctedText.slice(start, end) };
    })
  };
}

function splitTextPreservingLayout(text: string): Array<{
  type: "text" | "break";
  text: string;
}> {
  const parts = text.match(/\r\n|\n|\r|[^\S\r\n]+|[^\s]+/g) ?? [];

  return parts.map((part) => ({
    type: /^(\r\n|\n|\r)$/.test(part) ? "break" : "text",
    text: part
  }));
}

function buildLayoutTokens(sentence: Sentence): LayoutToken[] {
  const corrections = normalizedCorrections(sentence);
  const tokens: LayoutToken[] = [];
  let cursor = 0;

  corrections.forEach((correction) => {
    const before = sentence.originalText.slice(cursor, correction.start);
    splitTextPreservingLayout(before).forEach((part, index) => {
      tokens.push({
        type: part.type,
        key: `text-${cursor}-${index}`,
        text: part.text
      });
    });

    tokens.push({
      type: "correction",
      key: correction.id,
      text: correction.originalText || "·",
      correction
    });

    cursor = correction.end;
  });

  splitTextPreservingLayout(sentence.originalText.slice(cursor)).forEach(
    (part, index) => {
      tokens.push({
        type: part.type,
        key: `tail-${cursor}-${index}`,
        text: part.text
      });
    }
  );

  return tokens;
}

function measureTextWidth(
  text: string,
  context: CanvasRenderingContext2D,
  letterSpacing: number
) {
  const base = context.measureText(text).width;
  return base + Math.max(0, text.length - 1) * letterSpacing;
}

export function InteractiveSentenceReader({
  sentence,
  displayMode = "sentence",
  correctionCodes,
  onPoint,
  finishControl,
  persistenceKey,
  onRestorePoints,
  onWordClassPoint = () => undefined,
  onRestoreWordClassPoints,
  onCompleteChange
}: Props) {
  const [correctedIds, setCorrectedIds] = useState<string[]>([]);
  const [codedIds, setCodedIds] = useState<string[]>([]);
  const [activeCorrection, setActiveCorrection] = useState<SentenceCorrection | null>(null);
  const [dialogMode, setDialogMode] = useState<"word" | "code">("word");
  const [answer, setAnswer] = useState("");
  const [hintedIds, setHintedIds] = useState<string[]>([]);
  const [clickedIds, setClickedIds] = useState<string[]>([]);
  const [wordPointIds, setWordPointIds] = useState<string[]>([]);
  const [codePointIds, setCodePointIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [persistenceHydrated, setPersistenceHydrated] = useState(false);
  const [hybridGroupComplete, setHybridGroupComplete] = useState(false);
  const [hybridWordClassComplete, setHybridWordClassComplete] = useState(false);
  const [hybridExtensionComplete, setHybridExtensionComplete] = useState(false);
  const [readerRevision, setReaderRevision] = useState(0);
  const [dismissedReviewIds, setDismissedReviewIds] = useState<string[]>([]);
  const sentenceRef = useRef<HTMLDivElement>(null);
  const restorePointsRef = useRef(onRestorePoints);

  useEffect(() => {
    restorePointsRef.current = onRestorePoints;
  }, [onRestorePoints]);

  useEffect(() => {
    if (!persistenceKey || typeof window === "undefined") {
      setDismissedReviewIds([]);
      setPersistenceHydrated(true);
      return;
    }

    setPersistenceHydrated(false);

    const raw = window.sessionStorage.getItem(persistenceKey);

    if (!raw) {
      setCorrectedIds([]);
      setCodedIds([]);
      setHintedIds([]);
      setClickedIds([]);
      setWordPointIds([]);
      setCodePointIds([]);
      setDismissedReviewIds([]);
      setPersistenceHydrated(true);
      return;
    }

    try {
      const saved = JSON.parse(raw) as {
        correctedIds?: string[];
        codedIds?: string[];
        hintedIds?: string[];
        clickedIds?: string[];
        wordPointIds?: string[];
        codePointIds?: string[];
        dismissedReviewIds?: string[];
      };

      const restoredCorrectedIds = saved.correctedIds ?? [];
      const restoredCodedIds = saved.codedIds ?? [];
      const restoredHintedIds = saved.hintedIds ?? [];
      const restoredClickedIds = saved.clickedIds ?? [];
      const restoredWordPointIds = saved.wordPointIds ?? [];
      const restoredCodePointIds = saved.codePointIds ?? [];

      setCorrectedIds(restoredCorrectedIds);
      setCodedIds(restoredCodedIds);
      setHintedIds(restoredHintedIds);
      setClickedIds(restoredClickedIds);
      setWordPointIds(restoredWordPointIds);
      setCodePointIds(restoredCodePointIds);
      setDismissedReviewIds(saved.dismissedReviewIds ?? []);

      if (restorePointsRef.current) {
        const restoredPoints: Array<{
          correction: SentenceCorrection;
          stage: "click" | "word" | "code";
          points: number;
        }> = [];

        sentence.corrections.forEach((correction) => {
          if (
            restoredClickedIds.includes(correction.id) &&
            !restoredHintedIds.includes(correction.id)
          ) {
            restoredPoints.push({
              correction,
              stage: "click",
              points: 1
            });
          }

          if (restoredWordPointIds.includes(correction.id)) {
            restoredPoints.push({
              correction,
              stage: "word",
              points: 1
            });
          }

          if (restoredCodePointIds.includes(correction.id)) {
            restoredPoints.push({
              correction,
              stage: "code",
              points: 1
            });
          }
        });

        restorePointsRef.current(restoredPoints);
      }
    } catch {
      window.sessionStorage.removeItem(persistenceKey);
    } finally {
      setPersistenceHydrated(true);
    }
  }, [persistenceKey, sentence.corrections, sentence.id]);

  useEffect(() => {
    if (
      !persistenceHydrated ||
      !persistenceKey ||
      typeof window === "undefined"
    ) {
      return;
    }

    window.sessionStorage.setItem(
      persistenceKey,
      JSON.stringify({
        correctedIds,
        codedIds,
        hintedIds,
        clickedIds,
        wordPointIds,
        codePointIds,
        dismissedReviewIds
      })
    );
  }, [
    persistenceHydrated,
    persistenceKey,
    correctedIds,
    codedIds,
    hintedIds,
    clickedIds,
    wordPointIds,
    codePointIds,
    dismissedReviewIds
  ]);
  const [layoutLines, setLayoutLines] = useState<string[][]>([]);

  const ordered = useMemo(
    () => [...sentence.corrections].sort((a, b) => a.revealOrder - b.revealOrder),
    [sentence.corrections]
  );
  const requiresCorrectionCodes = !sentence.workflowPhases?.length || sentence.workflowPhases.some((phase) =>
    phase.kind === "correction" && phase.actions.some((action) => action.kind === "identify_codes" && action.enabled)
  );
  const correctedText = useMemo(() => buildCorrectedText(sentence), [sentence]);
  const hybridGroupTargets = useMemo(() => buildHybridGroupTargets(sentence, correctedText), [correctedText, sentence]);
  const correctedGrammarSentence = useMemo(() => buildCorrectedGrammarSentence(sentence, correctedText), [correctedText, sentence]);
  const resolvedCorrectionMarks = useMemo<ResolvedCorrectionMark[]>(() => !requiresCorrectionCodes ? [] : normalizedCorrections(sentence).map((correction) => {
    const start = mapOriginalPosition(sentence, correction.start, "start");
    const code = correctionCodes.find((item) => item.id === correction.correctionCodeId);
    return {
      id: `resolved-correction-${correction.id}`,
      start,
      end: start + correction.correctedText.length,
      label: code?.code ?? "?"
    };
  }), [correctionCodes, requiresCorrectionCodes, sentence]);
  const hybridWordClassSentence = useMemo(() => buildMixedWordClassSentence(correctedGrammarSentence), [correctedGrammarSentence]);
  const usesNativeGroupPhase = Boolean(sentence.workflowPhases?.some((phase) => phase.kind === "groups" && phase.actions.some((action) => action.enabled)) && hybridGroupTargets.length > 0);
  const usesNativeWordClassPhase = Boolean(
    sentence.workflowPhases?.some((phase) =>
      (phase.kind === "word_classes" || phase.kind === "agreements" || phase.kind === "gender_number") && phase.actions.some((action) => action.enabled)
    ) && (hybridWordClassSentence.wordClassTargets?.length ?? 0) > 0
  );
  const usesNativeFunctionPhase = Boolean((correctedGrammarSentence.grammarAnnotations ?? []).some((annotation) => annotation.kind === "function") && sentence.workflowPhases?.some((phase) => phase.kind === "functions" && phase.actions.some((action) => action.enabled)));
  const usesSharedRangeSurface = Boolean(usesNativeGroupPhase || usesNativeWordClassPhase || usesNativeFunctionPhase);
  const groupBoundaryMode = sentence.workflowPhases?.find((phase) => phase.kind === "groups")?.actions.find((action) => action.kind === "frame_groups")?.responseMode === "frame" ? "frame" : "brackets";
  const identifyGroupNuclei = Boolean(sentence.workflowPhases?.find((phase) => phase.kind === "groups")?.actions.some((action) => action.kind === "find_nuclei" && action.enabled) || sentence.workflowPhases?.find((phase) => phase.kind === "nuclei")?.actions.some((action) => action.kind === "find_nuclei" && action.enabled));
  const correctionComplete = ordered.every((correction) => correctedIds.includes(correction.id) && (!requiresCorrectionCodes || codedIds.includes(correction.id)));
  const correctionReviewPhase = reviewPhaseImmediatelyAfter(sentence.workflowPhases, "correction");
  const correctionReviewActive = Boolean(
    correctionComplete &&
    correctionReviewPhase &&
    !dismissedReviewIds.includes(correctionReviewPhase.id)
  );
  const activityComplete = correctionComplete && (
    usesNativeGroupPhase
      ? hybridGroupComplete && (!usesNativeWordClassPhase || hybridWordClassComplete)
      : usesNativeWordClassPhase
        ? hybridWordClassComplete
        : hybridExtensionComplete
  ) && !correctionReviewActive;

  useEffect(() => {
    onCompleteChange?.(activityComplete);
  }, [activityComplete, onCompleteChange]);

  const layoutTokens = useMemo(() => buildLayoutTokens(sentence), [sentence]);
  const forcedGrammarLineBreaks = useMemo(() => {
    if (layoutLines.length < 2) return [];

    const startByKey = new Map<string, number>();
    let offset = 0;
    layoutTokens.forEach((token) => {
      startByKey.set(token.key, offset);
      offset += token.correction
        ? token.correction.correctedText.length
        : token.text.length;
    });

    return Array.from(
      new Set(
        layoutLines
          .slice(1)
          .map((line) =>
            line
              .map((key) => startByKey.get(key))
              .find((value) => value !== undefined)
          )
          .filter(
            (value): value is number => value !== undefined && value > 0
          )
      )
    );
  }, [layoutLines, layoutTokens]);

  useEffect(() => {
    const element = sentenceRef.current;
    if (!element) return;

    function calculateLines() {
      const target = sentenceRef.current;
      if (!target) return;

      const styles = window.getComputedStyle(target);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return;

      context.font = [
        styles.fontStyle,
        styles.fontVariant,
        styles.fontWeight,
        styles.fontSize,
        styles.fontFamily
      ].join(" ");

      const letterSpacing = Number.parseFloat(styles.letterSpacing) || 0;
      const availableWidth = target.clientWidth - (Number.parseFloat(styles.paddingLeft) || 0) - (Number.parseFloat(styles.paddingRight) || 0);
      const lines: string[][] = [];
      let currentLine: string[] = [];
      let currentWidth = 0;

      layoutTokens.forEach((token) => {
        if (token.type === "break") {
          lines.push(currentLine);
          currentLine = [];
          currentWidth = 0;
          return;
        }

        const width = token.correction
          ? Math.max(
              measureTextWidth(token.correction.originalText || "·", context, letterSpacing),
              measureTextWidth(token.correction.correctedText || "·", context, letterSpacing)
            ) + (Number.parseFloat(styles.fontSize) || 0) * 0.06
          : measureTextWidth(token.text, context, letterSpacing);

        const previousKey = currentLine[currentLine.length - 1];
        const previousToken = previousKey
          ? layoutTokens.find((candidate) => candidate.key === previousKey)
          : undefined;
        const previousText = previousToken?.correction
          ? previousToken.correction.correctedText
          : previousToken?.text ?? "";

        if (
          currentLine.length > 0 &&
          currentWidth + width > availableWidth &&
          token.text.trim().length > 0 &&
          !endsWithFrenchElision(previousText)
        ) {
          lines.push(currentLine);
          currentLine = [];
          currentWidth = 0;
        }

        currentLine.push(token.key);
        currentWidth += width;
      });

      if (currentLine.length > 0 || lines.length === 0) lines.push(currentLine);
      setLayoutLines(lines);
    }

    calculateLines();

    const observer = new ResizeObserver(calculateLines);
    observer.observe(element);
    return () => observer.disconnect();
  }, [layoutTokens]);

  function openWordDialog(correction: SentenceCorrection) {
    if (correctedIds.includes(correction.id)) return;

    if (!clickedIds.includes(correction.id)) {
      setClickedIds((items) => [...items, correction.id]);

      if (!hintedIds.includes(correction.id)) {
        onPoint(correction, "click", 1);
      }
    }

    setActiveCorrection(correction);
    setDialogMode("word");
    setAnswer("");
    setMessage("");
  }

  function openCodeDialog(correction: SentenceCorrection) {
    if (!correctedIds.includes(correction.id) || codedIds.includes(correction.id)) return;

    setActiveCorrection(correction);
    setDialogMode("code");
    setAnswer("");
    setMessage("");
  }

  function submitAnswer(event: React.FormEvent) {
    event.preventDefault();
    if (!activeCorrection) return;

    if (dialogMode === "word") {
      const expected = activeCorrection.correctedText.trim().toLocaleLowerCase("fr-CA");
      const received = answer.trim().toLocaleLowerCase("fr-CA");

      if (received !== expected) {
        setMessage("Essaie encore.");
        return;
      }

      if (!wordPointIds.includes(activeCorrection.id)) {
        setWordPointIds((items) => [...items, activeCorrection.id]);
        onPoint(activeCorrection, "word", 1);
      }

      setCorrectedIds((items) => [...items, activeCorrection.id]);
      setActiveCorrection(null);
      setAnswer("");
      setMessage("");
      return;
    }

    const code = correctionCodes.find(
      (item) => item.id === activeCorrection.correctionCodeId
    );

    if (answer.trim().toUpperCase() !== (code?.code ?? "").trim().toUpperCase()) {
      setMessage("Le code n’est pas encore le bon.");
      return;
    }

    if (!codePointIds.includes(activeCorrection.id)) {
      setCodePointIds((items) => [...items, activeCorrection.id]);
      onPoint(activeCorrection, "code", 1);
    }

    setCodedIds((items) => [...items, activeCorrection.id]);
    setActiveCorrection(null);
    setAnswer("");
    setMessage("");
  }

  function abandonCurrentStep() {
    if (!activeCorrection) return;
    if (dialogMode === "word") {
      setCorrectedIds((items) => items.includes(activeCorrection.id) ? items : [...items, activeCorrection.id]);
    } else {
      setCodedIds((items) => items.includes(activeCorrection.id) ? items : [...items, activeCorrection.id]);
    }
    setActiveCorrection(null);
    setAnswer("");
    setMessage("");
  }

  function useHint() {
    const next = ordered.find((correction) => !correctedIds.includes(correction.id));
    if (!next) return;

    setHintedIds((items) =>
      items.includes(next.id) ? items : [...items, next.id]
    );
  }

  function revealAll() {
    const allIds = ordered.map((correction) => correction.id);
    setCorrectedIds(allIds);
    setCodedIds(allIds);
    setActiveCorrection(null);
  }

  function restart() {
    setCorrectedIds([]);
    setCodedIds([]);
    setActiveCorrection(null);
    setDialogMode("word");
    setAnswer("");
    setMessage("");
    setHintedIds([]);
    setClickedIds([]);
    setWordPointIds([]);
    setCodePointIds([]);
    setHybridGroupComplete(false);
    setHybridWordClassComplete(false);
    setHybridExtensionComplete(false);
    setDismissedReviewIds([]);
    setReaderRevision((current) => current + 1);
    restorePointsRef.current?.([]);
    onRestoreWordClassPoints?.([]);
    if (persistenceKey && typeof window !== "undefined") {
      window.sessionStorage.removeItem(persistenceKey);
      window.sessionStorage.removeItem(`${persistenceKey}-groups`);
      window.sessionStorage.removeItem(`${persistenceKey}-word-classes`);
    }
  }

  function renderToken(token: LayoutToken, wrappedLine = false) {
    if (token.type === "break") return null;

    if (token.type === "text") {
      return <span key={token.key}>{protectFrenchElisionBreaks(token.text)}</span>;
    }

    const correction = token.correction!;
    const isBeingCorrected = activeCorrection?.id === correction.id && dialogMode === "word";
    const corrected = correctedIds.includes(correction.id) && !isBeingCorrected;
    const coded = codedIds.includes(correction.id);
    const hinted = hintedIds.includes(correction.id);
    const code = correctionCodes.find(
      (item) => item.id === correction.correctionCodeId
    );
    const isPunctuationInsertion = correction.originalText.length === 0;

    return (
      <span
        key={correction.id}
        className={[
          "interactive-segment",
          wrappedLine ? "wrapped-line-segment" : "",
          corrected ? "corrected" : "",
          hinted && !corrected ? "hinted" : ""
        ].filter(Boolean).join(" ")}
      >
        <span className="interactive-word-shell">
          {corrected && (
            <button
              type="button"
              className={`interactive-code-box ${coded ? "filled" : ""}`}
              onClick={() => openCodeDialog(correction)}
              aria-label={coded ? `Code ${code?.code ?? ""}` : "Entrer le code de correction"}
            >
              {coded ? `(${code?.code ?? "?"})` : ""}
            </button>
          )}

          <button
            type="button"
            className={`interactive-word ${
              isPunctuationInsertion ? "interactive-punctuation-target" : ""
            }`}
            onClick={() => openWordDialog(correction)}
            disabled={corrected}
            aria-label={
              isPunctuationInsertion && !corrected
                ? "Ponctuation manquante"
                : undefined
            }
          >
            {corrected
              ? protectFrenchElisionBreaks(correction.correctedText)
              : isPunctuationInsertion
                ? "·"
                : protectFrenchElisionBreaks(correction.originalText)}
          </button>
        </span>
      </span>
    );
  }

  const tokenMap = new Map(layoutTokens.map((token) => [token.key, token]));
  const renderedLines =
    layoutLines.length > 0
      ? layoutLines.map((line, lineIndex) => (
          <span
            className={`interactive-line ${line.length === 0 ? "interactive-line-empty" : ""}`}
            key={`line-${lineIndex}`}
          >
            {line.length === 0
              ? "\u00A0"
              : line.map((key) => {
                  const token = tokenMap.get(key);
                  return token ? renderToken(token, lineIndex > 0) : null;
                })}
          </span>
        ))
      : layoutTokens.map((token) => renderToken(token));

  return (
    <div className={`interactive-reader interactive-reader-${displayMode} ${requiresCorrectionCodes ? "has-above-marks" : ""}`}>
      {!correctionComplete && (
        <>
          <ReaderChromePortal slot="instruction"><div className="reader-chrome-instruction-copy"><strong>Corrige les erreurs dans la phrase.</strong><span>Clique sur la partie à corriger, puis entre ta réponse.</span></div></ReaderChromePortal>
          <ReaderChromePortal slot="progress"><div className="reader-chrome-progress"><strong>{correctedIds.length}/{ordered.length} corrections</strong><span className="reader-chrome-progress-dots" aria-hidden="true">{ordered.map((correction) => <i key={correction.id} className={correctedIds.includes(correction.id) ? "done" : ""} />)}</span></div></ReaderChromePortal>
        </>
      )}
      {activityComplete && !usesSharedRangeSurface && (
        <>
          <ReaderChromePortal slot="instruction"><div className="reader-chrome-instruction-copy reader-chrome-complete"><strong>Activité terminée — vérifie la correction.</strong><span>La correction reste affichée tant que tu ne quittes pas ou ne recommences pas.</span></div></ReaderChromePortal>
          <ReaderChromePortal slot="progress"><div className="reader-chrome-progress complete"><strong>{ordered.length}/{ordered.length} corrections</strong><span className="reader-chrome-progress-dots" aria-hidden="true">{ordered.map((correction) => <i key={correction.id} className="done" />)}</span></div></ReaderChromePortal>
        </>
      )}
      {!correctionReviewActive && <ReaderChromePortal slot="actions">
        {!correctionComplete && <Button variant="secondary" onClick={useHint}><Lightbulb size={18} /> Indice</Button>}
        {!correctionComplete && <Button variant="secondary" onClick={revealAll}>Tout dévoiler</Button>}
        <Button variant="secondary" onClick={restart}>Recommencer</Button>
        {activityComplete && finishControl}
      </ReaderChromePortal>}

      {correctionReviewActive && correctionReviewPhase && (
        <CorrectionPause
          phase={correctionReviewPhase}
          onContinue={() => setDismissedReviewIds((current) => [...current, correctionReviewPhase.id])}
        />
      )}

      {correctionComplete && usesSharedRangeSurface && !correctionReviewActive ? (
        usesNativeGroupPhase && !hybridGroupComplete ? (
          <WordGroupReader
            key={`mixed-groups-${readerRevision}`}
            sentence={{ ...correctedGrammarSentence, wordGroupTargets: hybridGroupTargets }}
            persistenceKey={persistenceKey ? `${persistenceKey}-groups` : undefined}
            onPoint={() => undefined}
            onCompleteChange={setHybridGroupComplete}
            boundaryMode={groupBoundaryMode}
            continuationBoundaryMode={correctedGrammarSentence.workflowPhases?.find((phase) => phase.kind === "functions")?.actions.find((action) => action.kind === "frame_functions")?.responseMode === "brackets" ? "brackets" : "frame"}
            identifyNuclei={identifyGroupNuclei}
            forcedLineBreaks={forcedGrammarLineBreaks}
            correctionMarks={resolvedCorrectionMarks}
            embedded
          />
        ) : usesNativeWordClassPhase ? (
          <WordClassReader
            key={`mixed-word-classes-${readerRevision}`}
            sentence={hybridWordClassSentence}
            persistenceKey={persistenceKey ? `${persistenceKey}-word-classes` : undefined}
            onPoint={onWordClassPoint}
            onRestorePoints={onRestoreWordClassPoints}
            onCompleteChange={setHybridWordClassComplete}
            correctionMarks={resolvedCorrectionMarks}
            finishControl={finishControl}
            forcedLineBreaks={forcedGrammarLineBreaks}
            embedded
          />
        ) : (
          <GrammarExtensionReader
            key={`mixed-grammar-${readerRevision}`}
            sentence={correctedGrammarSentence}
            excludedKinds={["group", "nucleus"]}
            initialSolvedIds={(correctedGrammarSentence.grammarAnnotations ?? []).filter((annotation) => annotation.kind === "group" || annotation.kind === "nucleus").map((annotation) => annotation.id)}
            forcedLineBreaks={forcedGrammarLineBreaks}
            correctionMarks={resolvedCorrectionMarks}
            onCompleteChange={setHybridExtensionComplete}
          />
        )
      ) : (
        <div className="interactive-sentence shared-grammar-reader-text" ref={sentenceRef}>
          {renderedLines}
        </div>
      )}

      {correctionComplete && !usesSharedRangeSurface && (
        <GrammarExtensionReader
          key={`mixed-extension-${readerRevision}`}
          sentence={correctedGrammarSentence}
          forcedLineBreaks={forcedGrammarLineBreaks}
          correctionMarks={resolvedCorrectionMarks}
          onCompleteChange={setHybridExtensionComplete}
        />
      )}

      {activeCorrection && (
        <div className="reader-dialog-backdrop">
          <div className="reader-dialog" role="dialog" aria-modal="true">
            <button
              className="reader-close"
              onClick={() => setActiveCorrection(null)}
              aria-label="Fermer"
            >
              <X size={20} />
            </button>

            <span className="eyebrow">
              {dialogMode === "word"
                ? activeCorrection.originalText.length === 0
                  ? "Ajoute la ponctuation"
                  : displayMode === "text"
                    ? "Corrige le passage"
                    : "Corrige le mot"
                : "Entre le code"}
            </span>

            <h2>
              {dialogMode === "word"
                ? activeCorrection.originalText.length === 0
                  ? "Quel signe de ponctuation manque à cet endroit?"
                  : displayMode === "text"
                    ? `Comment corriges-tu « ${activeCorrection.originalText} »?`
                    : `Comment écris-tu « ${activeCorrection.originalText} »?`
                : "Quel est le code de correction?"}
            </h2>

            <form onSubmit={submitAnswer}>
              <input
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                autoFocus
                autoComplete="off"
              />

              {message && <div className="reader-message">{message}</div>}

              <div className="reader-dialog-actions">
                <Button type="submit">
                  <Check size={18} />
                  Envoyer
                </Button>
                <Button type="button" variant="secondary" onClick={abandonCurrentStep}>
                  Abandonner
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
