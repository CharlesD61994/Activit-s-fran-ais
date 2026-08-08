import type {
  CorrectionCode,
  PresentationAnimation,
  PresentationMode,
  Sentence
} from "@/types";

type Props = {
  sentence: Sentence;
  correctionCodes: CorrectionCode[];
  revealedIds: string[];
  currentCorrectionId?: string;
  highlightUnrevealed: boolean;
  mode: PresentationMode;
  animation: PresentationAnimation;
};

export function PresentationSentence({
  sentence,
  correctionCodes,
  revealedIds,
  currentCorrectionId,
  highlightUnrevealed,
  mode,
  animation
}: Props) {
  const corrections = [...sentence.corrections].sort((a, b) => a.start - b.start);
  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  corrections.forEach((correction) => {
    if (correction.start > cursor) {
      nodes.push(
        <span key={`text-${cursor}`}>
          {sentence.originalText.slice(cursor, correction.start)}
        </span>
      );
    }

    const revealed = revealedIds.includes(correction.id);
    const current = currentCorrectionId === correction.id;
    const code = correctionCodes.find((item) => item.id === correction.correctionCodeId);
    const shouldHint = !revealed && mode === "hint" && current;

    nodes.push(
      <span
        key={correction.id}
        className={[
          "presentation-segment",
          revealed ? "revealed" : "",
          current ? "current" : "",
          shouldHint ? "hinted" : "",
          !revealed && highlightUnrevealed ? "unrevealed-highlight" : "",
          revealed ? `animation-${animation}` : ""
        ].filter(Boolean).join(" ")}
      >
        {revealed && (
          <span
            className="presentation-code"
            style={{ "--code-color": code?.color ?? "var(--primary)" } as React.CSSProperties}
          >
            ({code?.code ?? "?"})
          </span>
        )}

        {mode === "teacher" && !revealed && current && (
          <span className="teacher-preview-code">
            {correction.correctedText}
          </span>
        )}

        <span className="presentation-word">
          {revealed ? correction.correctedText : correction.originalText}
        </span>
      </span>
    );

    cursor = correction.end;
  });

  if (cursor < sentence.originalText.length) {
    nodes.push(
      <span key={`text-${cursor}`}>
        {sentence.originalText.slice(cursor)}
      </span>
    );
  }

  return <div className="presentation-sentence">{nodes}</div>;
}
