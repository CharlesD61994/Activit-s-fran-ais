"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { GrammarExtensionReader } from "@/components/presentation/grammar-extension-reader";
import { WordClassReader } from "@/components/presentation/word-class-reader";
import { WordGroupReader } from "@/components/presentation/word-group-reader";
import type { GrammarWorkflowPhase, Sentence, WordClass } from "@/types";

type Props = { sentence: Sentence; phases: GrammarWorkflowPhase[]; persistenceKey?: string; finishControl?: React.ReactNode };
const classByLabel: Record<string, WordClass> = { nom: "noun", déterminant: "determiner", determinant: "determiner", verbe: "verb", préposition: "preposition", preposition: "preposition", adverbe: "adverb", adjectif: "adjective", pronom: "pronoun", conjonction: "conjunction", interjection: "interjection" };

export function MixedGrammarReader({ sentence, phases, persistenceKey, finishControl }: Props) {
  const runnable = useMemo(() => {
    const enabled = phases.filter((phase) => phase.actions.some((action) => action.enabled));
    const groupsUseNativeNucleusStep = enabled.some((phase) => phase.kind === "groups");
    return enabled.filter((phase) => phase.kind !== "nuclei" || !groupsUseNativeNucleusStep);
  }, [phases]);
  const [index, setIndex] = useState(0);
  const [phaseComplete, setPhaseComplete] = useState(false);
  const [cumulativeSolvedIds, setCumulativeSolvedIds] = useState<string[]>([]);
  const phase = runnable[index];
  const last = index === runnable.length - 1;

  useEffect(() => { if (!persistenceKey || typeof window === "undefined") return; const saved = Number(sessionStorage.getItem(`${persistenceKey}-mixed-phase`) ?? 0); setIndex(Number.isFinite(saved) ? Math.min(saved, runnable.length) : 0); try { setCumulativeSolvedIds(JSON.parse(sessionStorage.getItem(`${persistenceKey}-mixed-visuals`) ?? "[]")); } catch { setCumulativeSolvedIds([]); } }, [persistenceKey, runnable.length, sentence.id]);
  useEffect(() => { if (persistenceKey && typeof window !== "undefined") sessionStorage.setItem(`${persistenceKey}-mixed-phase`, String(index)); setPhaseComplete(false); }, [index, persistenceKey]);
  useEffect(() => { if (persistenceKey && typeof window !== "undefined") sessionStorage.setItem(`${persistenceKey}-mixed-visuals`, JSON.stringify(cumulativeSolvedIds)); }, [cumulativeSolvedIds, persistenceKey]);
  useEffect(() => {
    if (!phaseComplete || !phase) return;
    const kinds = phase.kind === "groups" ? ["group", "nucleus"] : phase.kind === "word_classes" ? ["word_class"] : phase.kind === "functions" ? ["function"] : phase.kind === "agreements" ? ["donor", "receiver"] : [phase.kind === "nuclei" ? "nucleus" : ""];
    setCumulativeSolvedIds((current) => Array.from(new Set([...current, ...(sentence.grammarAnnotations ?? []).filter((item) => kinds.includes(item.kind)).map((item) => item.id)])));
  }, [phase, phaseComplete, sentence.grammarAnnotations]);
  const continueControl = phaseComplete ? last ? finishControl : <Button type="button" onClick={() => setIndex((current) => current + 1)}>Continuer</Button> : undefined;
  if (!phase) return <>{finishControl}</>;
  const phaseSentence = { ...sentence, workflowPhases: [phase] };
  const phaseKey = persistenceKey ? `${persistenceKey}-mixed-${phase.id}` : undefined;

  if (phase.kind === "groups") {
    const boundaryAction = phase.actions.find((action) => action.kind === "frame_groups");
    const groupActionIds = new Set(phase.actions.map((action) => action.id));
    const linked = (sentence.wordGroupTargets ?? []).some((target) => target.mode === "contracted_nested") || phase.actions.some((action) => action.parentActionId && groupActionIds.has(action.parentActionId)) || phases.some((candidate) => candidate.kind === "nuclei" && candidate.actions.some((action) => action.parentActionId && groupActionIds.has(action.parentActionId)));
    const boundaryMode = boundaryAction?.responseMode === "frame" ? "frame" : "brackets";
    return <WordGroupReader sentence={{ ...phaseSentence, grammarAnnotations: (sentence.grammarAnnotations ?? []).filter((item) => item.kind !== "function") }} persistenceKey={phaseKey} onPoint={() => undefined} onCompleteChange={setPhaseComplete} boundaryMode={boundaryMode} progressionMode={linked ? "linked" : "batch"} targetOrder={boundaryAction?.targetOrder ?? "free"} finishControl={continueControl}/>;
  }
  if (phase.kind === "word_classes" || phase.kind === "agreements") {
    const generatedTargets = (sentence.grammarAnnotations ?? []).filter((item) => item.kind === "word_class" && classByLabel[item.label?.toLocaleLowerCase("fr-CA") ?? ""]).map((item) => ({ id: item.id, start: item.start, end: item.end, text: sentence.originalText.slice(item.start, item.end), wordClass: classByLabel[item.label!.toLocaleLowerCase("fr-CA")], isAnalysisTarget: true }));
    const targets = sentence.wordClassTargets?.length ? sentence.wordClassTargets : generatedTargets;
    if (phase.kind === "word_classes" && targets.length) return <WordClassReader sentence={{ ...phaseSentence, wordClassTargets: targets, selectedWordClasses: Array.from(new Set(targets.map((target) => target.wordClass))) }} persistenceKey={phaseKey} onPoint={() => undefined} onCompleteChange={setPhaseComplete} finishControl={continueControl}/>;
  }
  return <GrammarExtensionReader sentence={phaseSentence} persistenceKey={phaseKey} initialSolvedIds={cumulativeSolvedIds} onCompleteChange={setPhaseComplete} finishControl={continueControl}/>;
}
