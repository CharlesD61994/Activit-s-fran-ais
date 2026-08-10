"use client";

import { useMemo, useState } from "react";
import type { GrammarAnnotationKind, Sentence } from "@/types";
import { grammarActionLabels, grammarPhaseLabels } from "@/lib/grammar-workflow";

type WordToken = { text: string; start: number; end: number };

const actionAnnotationKind: Partial<Record<string, GrammarAnnotationKind>> = {
  frame_groups: "group",
  identify_group_types: "group",
  identify_word_classes: "word_class",
  find_nuclei: "nucleus",
  frame_functions: "function",
  identify_functions: "function",
  identify_donors: "donor",
  identify_receivers: "receiver"
};

function words(text: string): WordToken[] {
  return Array.from(text.matchAll(/\S+/g)).map((match) => ({
    text: match[0],
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length
  }));
}

export function GrammarExtensionReader({ sentence, excludedKinds = [] }: { sentence: Sentence; excludedKinds?: GrammarAnnotationKind[] }) {
  const annotations = sentence.grammarAnnotations ?? [];
  const steps = (sentence.workflowPhases ?? []).flatMap((phase) => phase.actions
    .filter((action) => action.enabled && actionAnnotationKind[action.kind] && !excludedKinds.includes(actionAnnotationKind[action.kind]!))
    .map((action) => ({ phase, action, kind: actionAnnotationKind[action.kind]! })));
  const [stepIndex, setStepIndex] = useState(0);
  const [anchor, setAnchor] = useState<WordToken | null>(null);
  const [solvedIds, setSolvedIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const tokens = useMemo(() => words(sentence.originalText), [sentence.originalText]);
  const step = steps[stepIndex];
  const expected = step ? annotations.filter((annotation) => annotation.kind === step.kind && !solvedIds.includes(annotation.id)) : [];

  if (!annotations.length || !step) return null;

  function advanceIfDone(nextSolved: string[]) {
    const remaining = annotations.filter((annotation) => annotation.kind === step.kind && !nextSolved.includes(annotation.id));
    if (!remaining.length) {
      setStepIndex((index) => Math.min(index + 1, steps.length));
      setMessage("Étape réussie.");
    }
  }

  function submitRange(start: number, end: number) {
    const low = Math.min(start, end);
    const high = Math.max(start, end);
    const match = expected.find((annotation) => {
      const tolerance = 2;
      return Math.abs(annotation.start - low) <= tolerance && Math.abs(annotation.end - high) <= tolerance;
    });
    if (!match) {
      setMessage("Ce n’est pas encore la bonne partie. Essaie de nouveau.");
      return;
    }
    const next = [...solvedIds, match.id];
    setSolvedIds(next);
    setMessage(match.label ? `Oui — ${match.label}.` : "Bonne réponse.");
    advanceIfDone(next);
  }

  function choose(token: WordToken) {
    const isRange = step.kind === "group" || step.kind === "function";
    if (!isRange) {
      submitRange(token.start, token.end);
      return;
    }
    if (!anchor) {
      setAnchor(token);
      setMessage("Choisis maintenant le dernier mot de l’encadrement.");
      return;
    }
    submitRange(Math.min(anchor.start, token.start), Math.max(anchor.end, token.end));
    setAnchor(null);
  }

  return (
    <section className="grammar-extension-reader">
      <div className="grammar-reader-progress">
        {steps.map((item, index) => <span className={index === stepIndex ? "active" : index < stepIndex ? "done" : ""} key={`${item.phase.id}-${item.action.id}`}>{index + 1}</span>)}
      </div>
      <div className="grammar-reader-instruction">
        <small>{grammarPhaseLabels[step.phase.kind]}</small>
        <strong>{grammarActionLabels[step.action.kind]}</strong>
        <span>{step.kind === "group" || step.kind === "function" ? "Clique le premier, puis le dernier mot." : "Clique sur le bon mot."}</span>
      </div>
      <div className="grammar-reader-text">
        {tokens.map((token) => {
          const solved = annotations.some((annotation) => solvedIds.includes(annotation.id) && token.start >= annotation.start && token.end <= annotation.end);
          return <button type="button" className={`${solved ? "solved" : ""} ${anchor?.start === token.start ? "anchor" : ""}`} key={`${token.start}-${token.end}`} onClick={() => choose(token)}>{token.text}</button>;
        })}
      </div>
      {message && <p className="grammar-reader-message">{message}</p>}
    </section>
  );
}
