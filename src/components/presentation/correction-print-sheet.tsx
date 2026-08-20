"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import { toPng } from "html-to-image";
import { WordClassReader } from "@/components/presentation/word-class-reader";
import type { ResolvedCorrectionMark } from "@/components/grammar/resolved-correction-labels";
import {
  getSecondaryObjectives,
  grammarObjectiveLabels,
  grammarPhaseLabels,
  getSentenceObjective
} from "@/lib/grammar-workflow";
import type { Sentence } from "@/types";

export type CorrectionPrintSheetHandle = {
  capture: () => Promise<void>;
};

type Props = {
  sentence: Sentence;
  correctionMarks: ResolvedCorrectionMark[];
};

function afterPaint() {
  return new Promise<void>((resolve) =>
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => resolve())
    )
  );
}

export const CorrectionPrintSheet = forwardRef<CorrectionPrintSheetHandle, Props>(
  function CorrectionPrintSheet({ sentence, correctionMarks }, ref) {
    const [mounted, setMounted] = useState(false);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const captureRef = useRef<HTMLDivElement>(null);
    const secondaryTags = getSecondaryObjectives(sentence).map(
      (objective) => grammarPhaseLabels[objective]
    );
    const printedTags = Array.from(
      new Set([...secondaryTags, ...(sentence.tags ?? [])])
    );

    useEffect(() => setMounted(true), []);

    useImperativeHandle(ref, () => ({
      async capture() {
        const element = captureRef.current;
        if (!element) throw new Error("La surface du corrigé n’est pas prête.");
        await document.fonts?.ready;
        await afterPaint();
        const width = element.scrollWidth;
        const height = element.scrollHeight;
        const nextImage = await toPng(element, {
          backgroundColor: "#ffffff",
          cacheBust: true,
          pixelRatio: 2,
          width,
          height
        });
        setImageUrl(nextImage);
        await afterPaint();
      }
    }), []);

    if (!mounted) return null;

    return createPortal(
      <article className="correction-print-root" aria-hidden="true">
        <header className="correction-print-document-header">
          <span>Corrigé</span>
          <h1>{sentence.title}</h1>
          <div className="correction-print-tags">
            <strong>{grammarObjectiveLabels[getSentenceObjective(sentence)]}</strong>
            {printedTags.map((tag) => <i key={tag}>{tag}</i>)}
          </div>
        </header>

        <div className="correction-print-capture-source reader-scene" ref={captureRef}>
          <div className="reader-activity-flow">
            <WordClassReader
              sentence={sentence}
              onPoint={() => undefined}
              embedded
              correctionArrowAuthoring
              correctionMarks={correctionMarks}
            />
          </div>
        </div>

        {imageUrl && (
          // A generated data URL cannot use the Next.js image optimizer.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="correction-print-captured-image"
            src={imageUrl}
            alt="Corrigé final tel qu’affiché dans le lecteur"
          />
        )}
      </article>,
      document.body
    );
  }
);
