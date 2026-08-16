"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { WordClassReader } from "@/components/presentation/word-class-reader";
import type { ResolvedCorrectionMark } from "@/components/grammar/resolved-correction-labels";
import { grammarObjectiveLabels, getSentenceObjective } from "@/lib/grammar-workflow";
import type { Sentence } from "@/types";

type Props = {
  /** The same corrected/adapted sentence rendered by the teacher reader. */
  sentence: Sentence;
  correctionMarks: ResolvedCorrectionMark[];
};

export function CorrectionPrintSheet({ sentence, correctionMarks }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <article className="correction-print-root" aria-hidden="true">
      <header className="correction-print-document-header">
        <span>Corrigé</span>
        <h1>{sentence.title}</h1>
        <div className="correction-print-tags">
          <strong>{grammarObjectiveLabels[getSentenceObjective(sentence)]}</strong>
          {(sentence.tags ?? []).map((tag) => <i key={tag}>{tag}</i>)}
        </div>
      </header>
      <section className="correction-print-reader">
        <WordClassReader
          sentence={sentence}
          onPoint={() => undefined}
          embedded
          correctionArrowAuthoring
          correctionMarks={correctionMarks}
        />
      </section>
    </article>,
    document.body
  );
}
