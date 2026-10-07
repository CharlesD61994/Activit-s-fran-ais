"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import { toPng } from "html-to-image";
import { InteractiveSentenceReader } from "@/components/presentation/interactive-sentence-reader";
import { getActivitySentences } from "@/lib/activity-sentences";
import { buildMixedWordClassSentence } from "@/lib/mixed-word-class-adapter";
import {
  getSecondaryObjectives,
  grammarObjectiveLabels,
  grammarPhaseLabels,
  getSentenceObjective
} from "@/lib/grammar-workflow";
import type { CorrectionCode, Sentence } from "@/types";

export type CorrectionPrintSheetHandle = {
  capture: () => Promise<void>;
};

type Props = {
  sentence: Sentence;
  correctionCodes: CorrectionCode[];
};

function afterPaint() {
  return new Promise<void>((resolve) =>
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() => resolve())
    )
  );
}

async function waitForStableLayout(elements: HTMLDivElement[]) {
  let previous = "";
  let stableFrames = 0;
  for (let frame = 0; frame < 20; frame += 1) {
    await afterPaint();
    const geometry = JSON.stringify(elements.map((element) => [element.scrollWidth, element.scrollHeight,
      ...Array.from(element.querySelectorAll("svg, [data-group-token-id], [data-class-token-id], [data-extension-token-id], .word-group-label-anchor")).map((node) => {
        const rect = node.getBoundingClientRect();
        return [rect.x, rect.y, rect.width, rect.height, node.getAttribute("style"), node.innerHTML];
      })]));
    stableFrames = geometry === previous ? stableFrames + 1 : 0;
    if (stableFrames >= 2) return;
    previous = geometry;
  }
  throw new Error("La mise en page du corrigé n’est pas encore stabilisée. Réessaie.");
}

export const CorrectionPrintSheet = forwardRef<CorrectionPrintSheetHandle, Props>(
  function CorrectionPrintSheet({ sentence, correctionCodes }, ref) {
    const [mounted, setMounted] = useState(false);
    const [imageUrls, setImageUrls] = useState<string[]>([]);
    const captureRefs = useRef<Array<HTMLDivElement | null>>([]);
    const phrases = useMemo(() => getActivitySentences(sentence), [sentence]);
    const secondaryTags = getSecondaryObjectives(sentence).map(
      (objective) => grammarPhaseLabels[objective]
    );
    const printedTags = Array.from(
      new Set([...secondaryTags, ...(sentence.tags ?? [])])
    );

    useEffect(() => setMounted(true), []);

    useImperativeHandle(ref, () => ({
      async capture() {
        phrases.forEach((phrase, index) => {
          const relations = buildMixedWordClassSentence(phrase).agreementRelations ?? [];
          const arrows = phrase.agreementCorrectionArrows ?? [];
          const missingArrow = relations.some((relation) => (relation.arrowReceiverIds ?? []).some((receiverId) =>
            !arrows.some((arrow) => (arrow.taskTargetId === relation.donorId && arrow.answerId === receiverId) ||
              (arrow.taskTargetId === receiverId && arrow.answerId === relation.donorId))));
          if (missingArrow) throw new Error(`Phrase #${index + 1} : trace les flèches du corrigé enseignant avant d’imprimer.`);
        });
        await document.fonts?.ready;
        await afterPaint();
        const elements = captureRefs.current.slice(0, phrases.length).filter((element): element is HTMLDivElement => Boolean(element));
        if (elements.length !== phrases.length) throw new Error("La surface du corrigé n’est pas prête.");
        await waitForStableLayout(elements);
        const nextImages = await Promise.all(elements.map((element) => toPng(element, {
          backgroundColor: "#ffffff",
          cacheBust: true,
          pixelRatio: 2,
          width: element.scrollWidth,
          height: element.scrollHeight
        })));
        setImageUrls(nextImages);
        await afterPaint();
      }
    }), [phrases]);

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

        {phrases.map((phrase, index) => (
          <section className="correction-print-phrase" key={`${phrase.id}-${index}`}>
            <h2>Phrase #{index + 1}</h2>
            <div className="correction-print-capture-source reader-scene" ref={(element) => { captureRefs.current[index] = element; }}>
              <div className="reader-activity-flow">
                <InteractiveSentenceReader key={JSON.stringify(phrase)} sentence={phrase} displayMode={phrase.activityType === "text_correction" ? "text" : "sentence"} correctionCodes={correctionCodes} onPoint={() => undefined} finalState />
              </div>
            </div>
            {imageUrls[index] && (
              // A generated data URL cannot use the Next.js image optimizer.
              // eslint-disable-next-line @next/next/no-img-element
              <img className="correction-print-captured-image" src={imageUrls[index]} alt={`Phrase #${index + 1} — corrigé final tel qu’affiché dans le lecteur`} />
            )}
          </section>
        ))}
      </article>,
      document.body
    );
  }
);
