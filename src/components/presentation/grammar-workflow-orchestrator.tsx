"use client";

import { useEffect, useMemo, useState } from "react";
import { GrammarExtensionReader } from "@/components/presentation/grammar-extension-reader";
import { WordClassReader } from "@/components/presentation/word-class-reader";
import { WordGroupReader } from "@/components/presentation/word-group-reader";
import type { GrammarWorkflowPhase, Sentence, WordClass, WordClassTarget, WordGroupTarget, WordGroupType } from "@/types";

type Props = {
  sentence: Sentence;
  phases: GrammarWorkflowPhase[];
  persistenceKey?: string;
  finishControl?: React.ReactNode;
};

const groupTypes = new Set<WordGroupType>(["GN", "GV", "GAdj", "GAdv", "GPrep"]);
const wordClasses = new Set<WordClass>(["noun", "determiner", "verb", "preposition", "adverb", "adjective", "pronoun", "conjunction", "interjection"]);

function groupTargets(sentence: Sentence): WordGroupTarget[] {
  if (sentence.wordGroupTargets?.length) return sentence.wordGroupTargets;
  const annotations = sentence.grammarAnnotations ?? [];
  const nuclei = annotations.filter((item) => item.kind === "nucleus");
  return annotations.filter((item) => item.kind === "group" && groupTypes.has(item.label as WordGroupType)).map((group) => {
    const nucleus = nuclei.find((item) => item.linkedAnnotationId === group.id || (item.start >= group.start && item.end <= group.end));
    return {
      id: group.id,
      start: group.start,
      end: group.end,
      text: sentence.originalText.slice(group.start, group.end),
      groupType: group.label as WordGroupType,
      nucleusStart: nucleus?.start ?? group.start,
      nucleusEnd: nucleus?.end ?? group.end,
      nucleusText: sentence.originalText.slice(nucleus?.start ?? group.start, nucleus?.end ?? group.end)
    };
  });
}

function classTargets(sentence: Sentence): WordClassTarget[] {
  if (sentence.wordClassTargets?.length) return sentence.wordClassTargets;
  return (sentence.grammarAnnotations ?? []).filter((item) => item.kind === "word_class" && wordClasses.has(item.label as WordClass)).map((item) => ({
    id: item.id,
    start: item.start,
    end: item.end,
    text: sentence.originalText.slice(item.start, item.end),
    wordClass: item.label as WordClass,
    isAnalysisTarget: true
  }));
}

export function GrammarWorkflowOrchestrator({ sentence, phases, persistenceKey, finishControl }: Props) {
  const runnablePhases = useMemo(() => {
    const enabled = phases.filter((phase) => phase.actions.some((action) => action.enabled));
    const nativeGroupsIncludeNuclei = enabled.some((phase) => phase.kind === "groups");
    return enabled.filter((phase) => phase.kind !== "nuclei" || !nativeGroupsIncludeNuclei);
  }, [phases]);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [phaseComplete, setPhaseComplete] = useState(false);
  const phase = runnablePhases[phaseIndex];
  const isLast = phaseIndex >= runnablePhases.length - 1;
  const completePhase = () => {
    setPhaseComplete(false);
    setPhaseIndex((current) => Math.min(current + 1, runnablePhases.length));
  };
  const phaseFinish = !phaseComplete ? undefined : isLast ? finishControl : <button type="button" className="button button-primary grammar-next-phase" onClick={completePhase}>Continuer</button>;

  useEffect(() => {
    if (!persistenceKey || typeof window === "undefined") return;
    const value = Number(window.sessionStorage.getItem(`${persistenceKey}-workflow-phase`) ?? 0);
    setPhaseIndex(Number.isFinite(value) ? Math.min(value, runnablePhases.length) : 0);
  }, [persistenceKey, runnablePhases.length, sentence.id]);

  useEffect(() => {
    if (persistenceKey && typeof window !== "undefined") window.sessionStorage.setItem(`${persistenceKey}-workflow-phase`, String(phaseIndex));
  }, [persistenceKey, phaseIndex]);

  if (!phase) return <>{finishControl}</>;

  const phaseSentence: Sentence = { ...sentence, workflowPhases: [phase] };
  const key = persistenceKey ? `${persistenceKey}-phase-${phase.id}` : undefined;

  if (phase.kind === "groups") {
    const mode = phase.actions.find((action) => action.kind === "frame_groups")?.responseMode === "frame" ? "frame" : "brackets";
    return <WordGroupReader sentence={{ ...phaseSentence, grammarAnnotations: [], wordGroupTargets: groupTargets(sentence) }} persistenceKey={key} onPoint={() => undefined} boundaryMode={mode} onCompleteChange={setPhaseComplete} finishControl={phaseFinish} />;
  }

  if (phase.kind === "functions") {
    const mode = phase.actions.find((action) => action.kind === "frame_functions")?.responseMode === "brackets" ? "brackets" : "frame";
    return <WordGroupReader sentence={{ ...phaseSentence, wordGroupTargets: [], grammarAnnotations: (sentence.grammarAnnotations ?? []).filter((annotation) => annotation.kind === "function") }} persistenceKey={key} onPoint={() => undefined} continuationBoundaryMode={mode} onCompleteChange={setPhaseComplete} finishControl={phaseFinish} />;
  }

  if (phase.kind === "word_classes" || phase.kind === "agreements") {
    const targets = classTargets(sentence);
    return <WordClassReader sentence={{ ...phaseSentence, wordClassTargets: targets, selectedWordClasses: Array.from(new Set(targets.map((target) => target.wordClass))) }} persistenceKey={key} onPoint={() => undefined} onCompleteChange={setPhaseComplete} finishControl={phaseFinish} />;
  }

  return <GrammarExtensionReader sentence={phaseSentence} persistenceKey={key} onCompleteChange={(complete) => { if (complete && !isLast) completePhase(); }} finishControl={isLast ? finishControl : undefined} />;
}
