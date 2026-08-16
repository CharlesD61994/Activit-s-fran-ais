"use client";

import { useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import { RangeMarksLayer } from "@/components/grammar/range-marks-layer";
import { tokenizeGrammarText } from "@/components/grammar/range-interaction-engine";
import { useRangeTargetPositions } from "@/components/grammar/use-range-target-positions";
import { grammarFunctionInstructionLabel } from "@/lib/grammar-definitions";
import { buildCorrectionPrintSnapshots } from "@/lib/correction-print";
import type { CorrectionPrintSnapshot } from "@/lib/correction-print";
import type { CorrectionCode, GrammarAnnotation, Sentence, WordGroupTarget } from "@/types";

function correctedText(sentence: Sentence) {
  const corrections = [...sentence.corrections].sort((a, b) => a.start - b.start);
  let cursor = 0;
  let value = "";
  corrections.forEach((correction) => {
    value += sentence.originalText.slice(cursor, correction.start) + correction.correctedText;
    cursor = correction.end;
  });
  return value + sentence.originalText.slice(cursor);
}

function mappedPosition(sentence: Sentence, position: number, affinity: "start" | "end" = "start") {
  let delta = 0;
  for (const correction of [...sentence.corrections].sort((a, b) => a.start - b.start)) {
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

function PrintSnapshot({ sentence, codes, snapshot }: { sentence: Sentence; codes: CorrectionCode[]; snapshot: CorrectionPrintSnapshot }) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const text = useMemo(() => correctedText(sentence), [sentence]);
  const annotations = useMemo<GrammarAnnotation[]>(() => (sentence.grammarAnnotations ?? []).map((annotation) => ({
    ...annotation,
    start: mappedPosition(sentence, annotation.start, "start"),
    end: mappedPosition(sentence, annotation.end, "end")
  })), [sentence]);
  const groupAnnotations = useMemo(
    () => annotations.filter((annotation) => annotation.kind === "group" && snapshot.kinds.has("groups")),
    [annotations, snapshot]
  );
  const functionAnnotations = useMemo(
    () => annotations.filter((annotation) => annotation.kind === "function" && snapshot.kinds.has("functions")),
    [annotations, snapshot]
  );
  const classAnnotations = useMemo(
    () => annotations.filter((annotation) => annotation.kind === "word_class" && (snapshot.kinds.has("word_classes") || snapshot.kinds.has("agreements") || snapshot.kinds.has("gender_number"))),
    [annotations, snapshot]
  );
  const correctionTargets = useMemo(() => sentence.corrections.map((correction) => {
    const start = mappedPosition(sentence, correction.start, "start");
    return { id: `print-code-${correction.id}`, start, end: start + correction.correctedText.length, correction };
  }), [sentence]);
  const rangeTargets = useMemo(
    () => [...groupAnnotations, ...functionAnnotations, ...classAnnotations, ...correctionTargets],
    [classAnnotations, correctionTargets, functionAnnotations, groupAnnotations]
  );
  const tokens = useMemo(() => tokenizeGrammarText(text, `print-${snapshot.id}`), [snapshot.id, text]);
  const positions = useRangeTargetPositions(surfaceRef, rangeTargets, tokens, "data-correction-print-token-id");
  const nucleusAnnotations = annotations.filter((annotation) => annotation.kind === "nucleus" && snapshot.kinds.has("groups"));
  const genderAnnotations = annotations.filter((annotation) => annotation.kind === "gender_number");
  const visibleAnnotationKinds = new Set<GrammarAnnotation["kind"]>([
    ...(snapshot.kinds.has("groups") ? ["group", "nucleus"] as const : []),
    ...(snapshot.kinds.has("functions") ? ["function"] as const : []),
    ...(snapshot.kinds.has("word_classes") || snapshot.kinds.has("gender_number") || snapshot.kinds.has("agreements") ? ["word_class"] as const : []),
    ...(snapshot.kinds.has("gender_number") ? ["gender_number"] as const : []),
    ...(snapshot.kinds.has("agreements") ? ["donor", "receiver"] as const : [])
  ]);
  const groupMode = sentence.workflowPhases?.find((phase) => phase.kind === "groups")?.actions.find((action) => action.kind === "frame_groups")?.responseMode === "frame" ? "frame" : "brackets";
  const showCorrectionCodes = Boolean(sentence.workflowPhases?.find((phase) => phase.kind === "correction")?.actions.some((action) => action.kind === "identify_codes" && action.enabled));
  const groupTargets: WordGroupTarget[] = groupAnnotations.map((annotation) => ({
    id: annotation.id,
    start: annotation.start,
    end: annotation.end,
    text: text.slice(annotation.start, annotation.end),
    groupType: (annotation.label ?? "GN") as WordGroupTarget["groupType"],
    nucleusStart: annotation.start,
    nucleusEnd: annotation.end,
    nucleusText: text.slice(annotation.start, annotation.end)
  }));

  function tokenStyle(start: number, end: number): CSSProperties {
    const marks = annotations.filter((annotation) => visibleAnnotationKinds.has(annotation.kind) && start < annotation.end && end > annotation.start);
    const visual = [...marks].reverse().find((annotation) => annotation.visualEffect?.kind === "color")?.visualEffect;
    const nucleus = nucleusAnnotations.some((annotation) => start < annotation.end && end > annotation.start);
    return { color: nucleus ? "#d93434" : visual?.color };
  }

  return (
    <section className="correction-print-snapshot">
      <header><span>Étape de correction</span><h2>{snapshot.title}</h2></header>
      <div className="correction-print-surface" ref={surfaceRef}>
        <RangeMarksLayer targets={groupTargets} positions={positions} leftIds={groupTargets.map((target) => target.id)} rightIds={groupTargets.map((target) => target.id)} mode={groupMode} />
        <RangeMarksLayer targets={functionAnnotations} positions={positions} leftIds={functionAnnotations.map((target) => target.id)} rightIds={functionAnnotations.map((target) => target.id)} mode={functionAnnotations.some((annotation) => annotation.responseMode === "brackets" || annotation.visualEffect?.kind === "brackets") ? "brackets" : "frame"} />

        {groupAnnotations.map((annotation) => {
          const position = positions[annotation.id];
          return position ? <span className="correction-print-label" key={annotation.id} style={{ left: position.x, top: position.y }}>{annotation.label}</span> : null;
        })}
        {functionAnnotations.map((annotation) => {
          const position = positions[annotation.id];
          return position ? <span className="correction-print-label function" key={annotation.id} style={{ left: position.x, top: position.y }}>{grammarFunctionInstructionLabel(annotation.label)}</span> : null;
        })}
        {classAnnotations.map((annotation) => {
          const position = positions[annotation.id];
          if (!position) return null;
          const details = genderAnnotations.find((candidate) => candidate.start === annotation.start && candidate.end === annotation.end);
          const gender = details?.grammaticalGender === "feminine" ? "Fém." : details?.grammaticalGender === "masculine" ? "Masc." : "";
          const number = details?.grammaticalNumber === "singular" ? "Sing." : details?.grammaticalNumber === "plural" ? "Plur." : "";
          return <span className="correction-print-label class" key={annotation.id} style={{ left: position.x, top: position.y }}>{annotation.label}{gender || number ? <small>({[gender, number].filter(Boolean).join(", ")})</small> : null}</span>;
        })}
        {snapshot.kinds.has("correction") && showCorrectionCodes && correctionTargets.map((target) => {
          const position = positions[target.id];
          const code = codes.find((candidate) => candidate.id === target.correction.correctionCodeId)?.code;
          return position && code ? <span className="correction-print-label correction" key={target.id} style={{ left: position.x, top: position.y }}>({code})</span> : null;
        })}

        {snapshot.kinds.has("agreements") && (sentence.agreementCorrectionArrows?.length ?? 0) > 0 && (
          <svg className="correction-print-arrows" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              {(sentence.agreementCorrectionArrows ?? []).map((arrow) => <marker key={`marker-${arrow.id}`} id={`print-arrow-${snapshot.id}-${arrow.id}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L8,4 L0,8 Z" fill={arrow.color} /></marker>)}
            </defs>
            {(sentence.agreementCorrectionArrows ?? []).map((arrow) => <polyline key={arrow.id} points={arrow.points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={arrow.color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" markerEnd={`url(#print-arrow-${snapshot.id}-${arrow.id})`} />)}
          </svg>
        )}

        <div className="correction-print-text shared-grammar-reader-text">
          {tokens.map((token) => <span key={token.id} data-correction-print-token-id={token.id} style={tokenStyle(token.start, token.end)}>{token.text}</span>)}
        </div>
      </div>
    </section>
  );
}

export function CorrectionPrintSheet({ sentence, correctionCodes }: { sentence: Sentence; correctionCodes: CorrectionCode[] }) {
  const snapshots = useMemo(() => buildCorrectionPrintSnapshots(sentence), [sentence]);
  return (
    <article className="correction-print-root" aria-hidden="true">
      <header className="correction-print-document-header"><span>Corrigé</span><h1>{sentence.title}</h1></header>
      {snapshots.map((snapshot) => <PrintSnapshot key={snapshot.id} sentence={sentence} codes={correctionCodes} snapshot={snapshot} />)}
    </article>
  );
}
