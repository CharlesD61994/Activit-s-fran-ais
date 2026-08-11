"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent
} from "react";
import type {
  GrammarAnnotation,
  GrammarAnnotationKind,
  Sentence
} from "@/types";
import {
  grammarActionLabels,
  shuffledGrammarTargetIds
} from "@/lib/grammar-workflow";
import { grammarFunctionInstructionLabel } from "@/lib/grammar-definitions";
import {
  chooseBracketTarget,
  matchDrawnRange,
  recognizeBracketStroke,
  tokenizeGrammarText
} from "@/components/grammar/range-interaction-engine";
import type {
  BoundaryAnchor,
  InteractionPoint
} from "@/components/grammar/range-interaction-engine";
import { useRangeTargetPositions } from "@/components/grammar/use-range-target-positions";
import { RangeMarksLayer } from "@/components/grammar/range-marks-layer";

type Point = InteractionPoint;
type Boundary = "left" | "right";
type ResponseMode = "click" | "frame" | "brackets";

const actionAnnotationKind: Partial<
  Record<string, GrammarAnnotationKind>
> = {
  frame_groups: "group",
  identify_group_types: "group",
  identify_word_classes: "word_class",
  find_nuclei: "nucleus",
  frame_functions: "function",
  identify_functions: "function",
  identify_donors: "donor",
  identify_receivers: "receiver"
};

type Props = {
  sentence: Sentence;
  excludedKinds?: GrammarAnnotationKind[];
  initialSolvedIds?: string[];
  forcedLineBreaks?: number[];
  onCompleteChange?: (complete: boolean) => void;
  finishControl?: React.ReactNode;
};

export function GrammarExtensionReader({
  sentence,
  excludedKinds = [],
  initialSolvedIds = [],
  forcedLineBreaks = [],
  onCompleteChange,
  finishControl
}: Props) {
  const annotations = useMemo(
    () => sentence.grammarAnnotations ?? [],
    [sentence.grammarAnnotations]
  );
  const steps = useMemo(
    () =>
      (sentence.workflowPhases ?? []).flatMap((phase) =>
        phase.actions
          .filter((action) => {
            const kind = actionAnnotationKind[action.kind];
            if (!action.enabled || !kind || excludedKinds.includes(kind)) {
              return false;
            }
            if (
              action.kind === "identify_functions" &&
              phase.actions.some(
                (candidate) =>
                  candidate.kind === "frame_functions" && candidate.enabled
              )
            ) {
              return false;
            }
            return true;
          })
          .map((action) => ({
            phase,
            action,
            kind: actionAnnotationKind[action.kind]!
          }))
      ),
    [excludedKinds, sentence.workflowPhases]
  );

  const [functionTargetOrder] = useState(() =>
    shuffledGrammarTargetIds(
      annotations
        .filter((annotation) => annotation.kind === "function")
        .map((annotation) => annotation.id)
    )
  );
  const functionTargetRanks = useMemo(
    () => new Map(functionTargetOrder.map((id, index) => [id, index])),
    [functionTargetOrder]
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [solvedIds, setSolvedIds] = useState<string[]>(initialSolvedIds);
  const [leftIds, setLeftIds] = useState<string[]>(initialSolvedIds);
  const [rightIds, setRightIds] = useState<string[]>(initialSolvedIds);
  const [frameStart, setFrameStart] = useState<Point | null>(null);
  const [frameCurrent, setFrameCurrent] = useState<Point | null>(null);
  const [stroke, setStroke] = useState<Point[]>([]);
  const [message, setMessage] = useState("");

  const surfaceRef = useRef<HTMLDivElement>(null);
  const activePointerRef = useRef<number | null>(null);
  const frameStartRef = useRef<Point | null>(null);
  const strokeRef = useRef<Point[]>([]);

  const tokens = useMemo(
    () => tokenizeGrammarText(sentence.originalText, "extension-token"),
    [sentence.originalText]
  );
  const positions = useRangeTargetPositions(
    surfaceRef,
    annotations,
    tokens,
    "data-extension-token-id"
  );

  const step = steps[stepIndex];
  const expected = step
    ? annotations
        .filter(
          (annotation) =>
            annotation.kind === step.kind && !solvedIds.includes(annotation.id)
        )
        .sort((left, right) =>
          step.kind === "function"
            ? (functionTargetRanks.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
              (functionTargetRanks.get(right.id) ?? Number.MAX_SAFE_INTEGER)
            : 0
        )
    : [];
  const currentTarget = expected[0];
  const responseMode: ResponseMode =
    step?.action.responseMode ??
    (step?.kind === "function" || step?.kind === "group"
      ? "frame"
      : "click");
  const complete = stepIndex >= steps.length;
  const stepTargets = step
    ? annotations.filter((annotation) => annotation.kind === step.kind)
    : [];
  const solvedStepCount = stepTargets.filter((annotation) =>
    solvedIds.includes(annotation.id)
  ).length;

  const solvedBracketTargets = annotations.filter(
    (annotation) =>
      solvedIds.includes(annotation.id) &&
      (annotation.visualEffect?.kind === "brackets" ||
        (!annotation.visualEffect && annotation.kind === "group"))
  );
  const solvedFrameTargets = annotations.filter(
    (annotation) =>
      solvedIds.includes(annotation.id) &&
      (annotation.visualEffect?.kind === "frame" ||
        (!annotation.visualEffect && annotation.kind === "function"))
  );
  const partialBracketTargets = expected.filter(
    (annotation) =>
      !solvedIds.includes(annotation.id) &&
      (leftIds.includes(annotation.id) || rightIds.includes(annotation.id))
  );

  useEffect(() => {
    setSolvedIds((current) =>
      Array.from(new Set([...current, ...initialSolvedIds]))
    );
    setLeftIds((current) =>
      Array.from(new Set([...current, ...initialSolvedIds]))
    );
    setRightIds((current) =>
      Array.from(new Set([...current, ...initialSolvedIds]))
    );
  }, [initialSolvedIds]);

  useEffect(() => {
    if (step && expected.length === 0) {
      setStepIndex((index) => index + 1);
    }
  }, [expected.length, step]);

  useEffect(() => {
    onCompleteChange?.(complete);
  }, [complete, onCompleteChange]);

  useEffect(() => {
    cancelDrawing();
    setMessage("");
  }, [stepIndex]);

  function cancelDrawing() {
    activePointerRef.current = null;
    frameStartRef.current = null;
    strokeRef.current = [];
    setFrameStart(null);
    setFrameCurrent(null);
    setStroke([]);
  }

  function solve(annotation: GrammarAnnotation) {
    const next = solvedIds.includes(annotation.id)
      ? solvedIds
      : [...solvedIds, annotation.id];
    setSolvedIds(next);
    setMessage(
      annotation.label ? `Oui — ${annotation.label}.` : "Bonne réponse."
    );
    cancelDrawing();

    if (
      !annotations.some(
        (candidate) =>
          candidate.kind === step?.kind && !next.includes(candidate.id)
      )
    ) {
      setStepIndex((index) => index + 1);
    }
  }

  function pointFromEvent(event: ReactPointerEvent<HTMLDivElement>) {
    const surface = surfaceRef.current;
    if (!surface) return null;
    const rect = surface.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function expectedAnchor(
    target: GrammarAnnotation,
    boundary: Boundary
  ): BoundaryAnchor | null {
    const position = positions[target.id];
    if (!position) return null;

    return boundary === "left"
      ? {
          x: position.startX - 7,
          y: position.startY + position.startHeight / 2,
          height: Math.max(34, position.startHeight * 1.35)
        }
      : {
          x: position.endX + 7,
          y: position.endY + position.endHeight / 2,
          height: Math.max(34, position.endHeight * 1.35)
        };
  }

  function validateFrame(start: Point, endPoint: Point) {
    const surface = surfaceRef.current;
    if (!surface || !currentTarget) return;

    const width = Math.abs(endPoint.x - start.x);
    const height = Math.abs(endPoint.y - start.y);
    if (Math.hypot(width, height) < 24) {
      setMessage(
        "Maintiens le bouton enfoncé et dessine un rectangle autour du passage."
      );
      return;
    }

    const surfaceRect = surface.getBoundingClientRect();
    const left = Math.min(start.x, endPoint.x) - 8;
    const right = Math.max(start.x, endPoint.x) + 8;
    const top = Math.min(start.y, endPoint.y) - 12;
    const bottom = Math.max(start.y, endPoint.y) + 12;
    const selected = tokens.filter((token) => {
      if (!token.isWord && token.text.trim().length === 0) return false;
      const element = surface.querySelector<HTMLElement>(
        `[data-extension-token-id="${token.id}"]`
      );
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const centerX = (rect.left + rect.right) / 2 - surfaceRect.left;
      const centerY = (rect.top + rect.bottom) / 2 - surfaceRect.top;
      return (
        centerX >= left &&
        centerX <= right &&
        centerY >= top &&
        centerY <= bottom
      );
    });

    const startIndex = selected.length
      ? Math.min(...selected.map((token) => token.start))
      : -1;
    const endIndex = selected.length
      ? Math.max(...selected.map((token) => token.end))
      : -1;
    const tolerance = Math.max(
      2,
      Math.round((currentTarget.end - currentTarget.start) * 0.28)
    );
    const match = matchDrawnRange(
      startIndex,
      endIndex,
      expected,
      [],
      currentTarget.id,
      tolerance
    );

    if (match) {
      solve(match);
    } else {
      setMessage("Ce n’est pas tout à fait la bonne partie. Réessaie.");
    }
  }

  function validateBracket(points: Point[]) {
    if (!currentTarget) return;
    const recognized = recognizeBracketStroke(points);
    if (!recognized) {
      setMessage("Trace un crochet plus clairement.");
      return;
    }

    const boundary: Boundary = recognized === "[" ? "left" : "right";
    const sameBoundaryIds = boundary === "left" ? leftIds : rightIds;
    const otherBoundaryIds = boundary === "left" ? rightIds : leftIds;
    const matched = chooseBracketTarget(
      points,
      expected,
      sameBoundaryIds,
      otherBoundaryIds,
      currentTarget.id,
      (target) => expectedAnchor(target, boundary)
    );

    if (!matched) {
      setMessage(
        boundary === "left"
          ? "Le crochet gauche n’est pas au bon endroit."
          : "Le crochet droit n’est pas au bon endroit."
      );
      return;
    }

    if (boundary === "left") {
      setLeftIds((current) =>
        current.includes(matched.target.id)
          ? current
          : [...current, matched.target.id]
      );
    } else {
      setRightIds((current) =>
        current.includes(matched.target.id)
          ? current
          : [...current, matched.target.id]
      );
    }

    if (otherBoundaryIds.includes(matched.target.id)) {
      solve(matched.target);
    } else {
      setMessage(
        boundary === "left"
          ? "Trace maintenant le crochet droit."
          : "Trace maintenant le crochet gauche."
      );
    }
  }

  function beginDrawing(event: ReactPointerEvent<HTMLDivElement>) {
    if (!step || responseMode === "click" || event.button !== 0) return;
    const point = pointFromEvent(event);
    if (!point) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerRef.current = event.pointerId;
    setMessage("");

    if (responseMode === "frame") {
      frameStartRef.current = point;
      setFrameStart(point);
      setFrameCurrent(point);
    } else {
      strokeRef.current = [point];
      setStroke([point]);
    }
  }

  function continueDrawing(event: ReactPointerEvent<HTMLDivElement>) {
    if (activePointerRef.current !== event.pointerId) return;
    const point = pointFromEvent(event);
    if (!point) return;

    if (responseMode === "frame") {
      setFrameCurrent(point);
    } else {
      const next = [...strokeRef.current, point];
      strokeRef.current = next;
      setStroke(next);
    }
  }

  function finishDrawing(event: ReactPointerEvent<HTMLDivElement>) {
    if (activePointerRef.current !== event.pointerId) return;
    const point = pointFromEvent(event);
    const start = frameStartRef.current;
    const finalStroke = point ? [...strokeRef.current, point] : strokeRef.current;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    activePointerRef.current = null;

    if (responseMode === "frame" && start && point) {
      validateFrame(start, point);
    } else if (responseMode === "brackets") {
      validateBracket(finalStroke);
    }

    frameStartRef.current = null;
    strokeRef.current = [];
    setFrameStart(null);
    setFrameCurrent(null);
    setStroke([]);
  }

  function tokenStyle(start: number, end: number): CSSProperties {
    const marks = annotations.filter(
      (annotation) =>
        solvedIds.includes(annotation.id) &&
        start < annotation.end &&
        end > annotation.start
    );
    const color = [...marks]
      .reverse()
      .find((annotation) => annotation.visualEffect?.kind === "color")
      ?.visualEffect?.color;
    const backgroundColor = [...marks]
      .reverse()
      .find((annotation) => annotation.visualEffect?.kind === "highlight")
      ?.visualEffect?.color;
    const underline = [...marks]
      .reverse()
      .find((annotation) => annotation.visualEffect?.kind === "underline")
      ?.visualEffect?.color;

    return {
      color,
      backgroundColor,
      fontWeight: marks.some(
        (annotation) => annotation.visualEffect?.kind === "bold"
      )
        ? 800
        : undefined,
      textDecoration: underline ? "underline" : undefined,
      textDecorationColor: underline
    };
  }

  function instructionText() {
    if (!step) return "";
    if (step.kind === "function") {
      const functionName = grammarFunctionInstructionLabel(
        currentTarget?.label
      );
      if (responseMode === "frame") {
        return `Encadre ${functionName} avec un rectangle en glissant la souris.`;
      }
      if (responseMode === "brackets") {
        return `Mets ${functionName} entre crochets.`;
      }
      return `Clique sur ${functionName}.`;
    }

    if (responseMode === "frame") {
      return `${grammarActionLabels[step.action.kind]} en dessinant un rectangle.`;
    }
    if (responseMode === "brackets") {
      return `${grammarActionLabels[step.action.kind]} en traçant les crochets.`;
    }
    return grammarActionLabels[step.action.kind];
  }

  function counterText() {
    const noun = step?.kind === "function" ? "fonctions" : "réponses";
    return `${solvedStepCount}/${stepTargets.length} ${noun} complétées`;
  }

  if (!annotations.length || !steps.length) {
    return <>{finishControl}</>;
  }

  return (
    <section className="grammar-extension-reader word-group-reader embedded">
      {!complete && step && (
        <div className="word-group-reader-toolbar">
          <div className="word-group-reader-instruction">
            <strong>{instructionText()}</strong>
            <span className="word-group-reader-counter">
              {counterText()}
            </span>
          </div>
        </div>
      )}

      <div
          className={`word-group-drawing-surface grammar-extension-surface phase-${responseMode}`}
          ref={surfaceRef}
        >
          <RangeMarksLayer
            targets={solvedBracketTargets}
            positions={positions}
            leftIds={solvedBracketTargets.map((target) => target.id)}
            rightIds={solvedBracketTargets.map((target) => target.id)}
            mode="brackets"
          />
          <RangeMarksLayer
            targets={partialBracketTargets}
            positions={positions}
            leftIds={leftIds}
            rightIds={rightIds}
            mode="brackets"
          />
          <RangeMarksLayer
            targets={solvedFrameTargets}
            positions={positions}
            leftIds={solvedFrameTargets.map((target) => target.id)}
            rightIds={solvedFrameTargets.map((target) => target.id)}
            mode="frame"
          />

          <div className="word-group-reader-text shared-grammar-reader-text">
            {tokens.map((token) => {
              const breakBefore = forcedLineBreaks.some(
                (position) =>
                  position >= token.start && position < token.end
              );
              const measurable =
                token.isWord || token.text.trim().length > 0;
              const style = tokenStyle(token.start, token.end);

              return (
                <span key={token.id}>
                  {breakBefore && <br />}
                  {token.isWord ? (
                    <button
                      type="button"
                      className="word-group-reader-token grammar-extension-token"
                      style={style}
                      data-extension-token-id={token.id}
                      onClick={() => {
                        if (
                          responseMode !== "click" ||
                          !step ||
                          !currentTarget
                        ) {
                          return;
                        }
                        const match =
                          token.start < currentTarget.end &&
                          token.end > currentTarget.start;
                        if (match) {
                          solve(currentTarget);
                        } else {
                          setMessage("Ce n’est pas le bon mot. Réessaie.");
                        }
                      }}
                    >
                      {token.text}
                    </button>
                  ) : (
                    <span
                      style={style}
                      data-extension-token-id={
                        measurable ? token.id : undefined
                      }
                    >
                      {token.text}
                    </span>
                  )}
                </span>
              );
            })}
          </div>

          {!complete && responseMode !== "click" && (
            <div
              className="grammar-range-drawing-layer"
              onPointerDown={beginDrawing}
              onPointerMove={continueDrawing}
              onPointerUp={finishDrawing}
              onPointerCancel={() => cancelDrawing()}
              aria-label={
                responseMode === "frame"
                  ? "Dessine un rectangle directement sur la phrase"
                  : "Dessine les crochets directement sur la phrase"
              }
            />
          )}

          {frameStart && frameCurrent && (
            <span
              className="grammar-reader-drawing-frame"
              style={{
                left: Math.min(frameStart.x, frameCurrent.x),
                top: Math.min(frameStart.y, frameCurrent.y),
                width: Math.abs(frameCurrent.x - frameStart.x),
                height: Math.abs(frameCurrent.y - frameStart.y)
              }}
            />
          )}

          {stroke.length > 1 && (
            <svg
              className="grammar-reader-live-stroke"
              viewBox={`0 0 ${surfaceRef.current?.clientWidth ?? 1} ${surfaceRef.current?.clientHeight ?? 1}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polyline
                points={stroke
                  .map((point) => `${point.x},${point.y}`)
                  .join(" ")}
              />
            </svg>
          )}
        </div>

      {message && (
        <p className="word-group-reader-message">{message}</p>
      )}
      {complete && finishControl}
    </section>
  );
}
