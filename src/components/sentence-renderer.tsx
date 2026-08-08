import { wordClassLabels } from "@/lib/activity-types";
import type { Sentence } from "@/types";

type Props = {
  sentence: Sentence;
  highlightErrors?: boolean;
  showCorrected?: boolean;
};

export function SentenceRenderer({ sentence, highlightErrors = true, showCorrected = false }: Props) {
  if (sentence.activityType === "word_classes") {
    const targets = [...(sentence.wordClassTargets ?? [])].sort(
      (a, b) => a.start - b.start
    );
    const pieces: React.ReactNode[] = [];
    let cursor = 0;

    targets.forEach((target) => {
      if (target.start > cursor) {
        pieces.push(
          <span key={`text-${cursor}`}>
            {sentence.originalText.slice(cursor, target.start)}
          </span>
        );
      }

      pieces.push(
        <span
          className="word-class-bank-highlight"
          title={wordClassLabels[target.wordClass]}
          key={target.id}
        >
          {target.text}
        </span>
      );
      cursor = target.end;
    });

    if (cursor < sentence.originalText.length) {
      pieces.push(
        <span key={`tail-${cursor}`}>
          {sentence.originalText.slice(cursor)}
        </span>
      );
    }

    return (
      <p className="sentence-preview sentence-preview-preserve-lines">
        {pieces}
      </p>
    );
  }

  const corrections = [...sentence.corrections].sort((a, b) => a.start - b.start);
  const pieces: React.ReactNode[] = [];
  let cursor = 0;

  corrections.forEach((correction) => {
    if (correction.start > cursor) {
      pieces.push(<span key={`text-${cursor}`}>{sentence.originalText.slice(cursor, correction.start)}</span>);
    }
    pieces.push(
      <span
        key={correction.id}
        className={highlightErrors ? "error-highlight" : ""}
        title={correction.explanation}
      >
        {showCorrected ? correction.correctedText : correction.originalText}
      </span>
    );
    cursor = correction.end;
  });

  if (cursor < sentence.originalText.length) {
    pieces.push(<span key={`text-${cursor}`}>{sentence.originalText.slice(cursor)}</span>);
  }

  return <p className="sentence-preview sentence-preview-preserve-lines">{pieces}</p>;
}
