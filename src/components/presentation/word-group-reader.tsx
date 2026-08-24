"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReaderChromePortal } from "@/components/presentation/reader-chrome";
import { CorrectionPause } from "@/components/presentation/correction-pause";
import { useRangeTargetPositions } from "@/components/grammar/use-range-target-positions";
import { chooseBracketTarget, matchDrawnRange, recognizeBracketStroke, tokenizeGrammarText } from "@/components/grammar/range-interaction-engine";
import type { GrammarRangeToken, InteractionPoint } from "@/components/grammar/range-interaction-engine";
import { RangeMarksLayer } from "@/components/grammar/range-marks-layer";
import { ResolvedCorrectionLabels } from "@/components/grammar/resolved-correction-labels";
import type { ResolvedCorrectionMark } from "@/components/grammar/resolved-correction-labels";
import { grammarFunctionInstructionLabel } from "@/lib/grammar-definitions";
import { reviewPhaseImmediatelyAfter } from "@/lib/grammar-workflow";
import { protectFrenchElisionBreaks } from "@/lib/french-typography";
import type { Sentence, WordGroupTarget, WordGroupType } from "@/types";

type Boundary = "left_bracket" | "right_bracket";
type WordGroupStage = Boundary | "group_type" | "nucleus" | "contracted_answer" | "gprep_nucleus" | "nested_presence" | "nested_type";

const groupLabels: Record<WordGroupType, string> = {
  GN: "Groupe nominal (GN)",
  GV: "Groupe verbal (GV)",
  GAdj: "Groupe adjectival (GAdj)",
  GAdv: "Groupe adverbial (GAdv)",
  GPrep: "Groupe prépositionnel (GPrép)"
};

function isContractedNested(target?: WordGroupTarget | null) {
  return Boolean(
    target &&
      (target.mode === "contracted_nested" ||
        target.contractedGnText?.trim())
  );
}

type RestoredPoint = {
  target: WordGroupTarget;
  stage: WordGroupStage;
  points: number;
  pointId: string;
};

type Props = {
  sentence: Sentence;
  persistenceKey?: string;
  onPoint: (
    target: WordGroupTarget,
    stage: WordGroupStage,
    points: number,
    pointId: string
  ) => void;
  onRestorePoints?: (points: RestoredPoint[]) => void;
  onCompleteChange?: (complete: boolean) => void;
  finishControl?: React.ReactNode;
  boundaryMode?: "brackets" | "frame";
  continuationBoundaryMode?: "brackets" | "frame";
  identifyNuclei?: boolean;
  embedded?: boolean;
  forcedLineBreaks?: number[];
  correctionMarks?: ResolvedCorrectionMark[];
};

type Token = GrammarRangeToken;
type StrokePoint = InteractionPoint;

export function WordGroupReader({
  sentence,
  persistenceKey,
  onPoint,
  onRestorePoints,
  onCompleteChange,
  finishControl,
  boundaryMode = "brackets",
  continuationBoundaryMode = "frame",
  identifyNuclei = true,
  embedded = false,
  forcedLineBreaks = [],
  correctionMarks = []
}: Props) {
  const targets = useMemo(
    () =>
      [...(sentence.wordGroupTargets ?? [])].sort(
        (a, b) => a.start - b.start || b.end - a.end
      ),
    [sentence.wordGroupTargets]
  );
  const tokens = useMemo(
    () => tokenizeGrammarText(sentence.originalText, "group-token"),
    [sentence.originalText]
  );

  const [leftFoundIds, setLeftFoundIds] = useState<string[]>([]);
  const [rightFoundIds, setRightFoundIds] = useState<string[]>([]);
  const [functionLeftIds, setFunctionLeftIds] = useState<string[]>([]);
  const [functionRightIds, setFunctionRightIds] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [classifiedIds, setClassifiedIds] = useState<string[]>([]);
  const [nucleusFoundIds, setNucleusFoundIds] = useState<string[]>([]);
  const [contractedAnsweredIds, setContractedAnsweredIds] = useState<string[]>([]);
  const [gprepNucleusFoundIds, setGprepNucleusFoundIds] = useState<string[]>([]);
  const [nestedPresenceFoundIds, setNestedPresenceFoundIds] = useState<string[]>([]);
  const [nestedTypeFoundIds, setNestedTypeFoundIds] = useState<string[]>([]);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [typeMenuSide, setTypeMenuSide] = useState<"left" | "right">("right");
  const [contractedAnswer, setContractedAnswer] = useState("");
  const [stroke, setStroke] = useState<StrokePoint[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [frameStart, setFrameStart] = useState<StrokePoint | null>(null);
  const [frameCurrent, setFrameCurrent] = useState<StrokePoint | null>(null);
  const [message, setMessage] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [labelOffsets, setLabelOffsets] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [dismissedReviewIds, setDismissedReviewIds] = useState<string[]>([]);
  const [autoLineBreaks, setAutoLineBreaks] = useState<number[]>([]);

  const surfaceRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const restoreRef = useRef(onRestorePoints);
  const completeRef = useRef(onCompleteChange);
  const controlledLineBreaks =
    forcedLineBreaks.length > 0 ? forcedLineBreaks : autoLineBreaks;

  useEffect(() => {
    restoreRef.current = onRestorePoints;
  }, [onRestorePoints]);

  useEffect(() => {
    completeRef.current = onCompleteChange;
  }, [onCompleteChange]);

  useLayoutEffect(() => {
    if (forcedLineBreaks.length > 0) {
      setAutoLineBreaks([]);
      return;
    }

    const surface = surfaceRef.current;
    if (!surface) return;

    let frameId = 0;

    function calculateBreaks() {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const activeSurface = surfaceRef.current;
        if (!activeSurface) return;

        const tokenStarts = new Map(
          tokens.map((token) => [token.id, token.start])
        );
        const measured = Array.from(
          activeSurface.querySelectorAll<HTMLElement>("[data-group-token-id]")
        ).filter((element) => element.dataset.groupTokenId);

        const nextBreaks: number[] = [];
        let currentTop: number | null = null;
        measured.forEach((element) => {
          const tokenId = element.dataset.groupTokenId;
          if (!tokenId) return;

          const start = tokenStarts.get(tokenId);
          if (start === undefined || start <= 0) return;

          const top = element.getBoundingClientRect().top;
          if (currentTop === null) {
            currentTop = top;
            return;
          }

          if (top > currentTop + 1) {
            nextBreaks.push(start);
            currentTop = top;
          }
        });

        setAutoLineBreaks((current) =>
          current.length === nextBreaks.length &&
          current.every((value, index) => value === nextBreaks[index])
            ? current
            : nextBreaks
        );
      });
    }

    calculateBreaks();
    window.addEventListener("resize", calculateBreaks);
    const observer = new ResizeObserver(calculateBreaks);
    observer.observe(surface);
    document.fonts?.ready.then(calculateBreaks);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", calculateBreaks);
      observer.disconnect();
    };
  }, [forcedLineBreaks.length, tokens]);

  const functionAnnotations = useMemo(() => (sentence.grammarAnnotations ?? []).filter((annotation) => annotation.kind === "function"), [sentence.grammarAnnotations]);
  const functionTargets = useMemo<WordGroupTarget[]>(() => functionAnnotations.map((annotation) => ({ id: annotation.id, start: annotation.start, end: annotation.end, text: sentence.originalText.slice(annotation.start, annotation.end), groupType: "GN", nucleusStart: annotation.start, nucleusEnd: annotation.end, nucleusText: sentence.originalText.slice(annotation.start, annotation.end) })), [functionAnnotations, sentence.originalText]);
  const layoutTargets = useMemo(() => [...targets, ...functionTargets, ...correctionMarks], [correctionMarks, functionTargets, targets]);
  const labelPositions = useRangeTargetPositions(surfaceRef, layoutTargets, tokens, "data-group-token-id");
  const currentTarget = targets[currentIndex];
  const targetNeedsNucleus = (target: WordGroupTarget) =>
    identifyNuclei && target.analyzeNucleus !== false;
  const currentIsContracted =
    isContractedNested(currentTarget);
  const groupsComplete =
    targets.length === 0 || targets.every(
      (target) =>
        (targetNeedsNucleus(target) ? nucleusFoundIds.includes(target.id) : classifiedIds.includes(target.id)) &&
        (!isContractedNested(target) ||
          gprepNucleusFoundIds.includes(target.id))
    );
  const functionsComplete = functionTargets.every((target) => functionLeftIds.includes(target.id) && functionRightIds.includes(target.id));
  const groupReviewPhase = reviewPhaseImmediatelyAfter(sentence.workflowPhases, "groups");
  const functionReviewPhase = reviewPhaseImmediatelyAfter(sentence.workflowPhases, "functions");
  const groupReviewActive = Boolean(groupsComplete && groupReviewPhase && !dismissedReviewIds.includes(groupReviewPhase.id));
  const rawComplete = groupsComplete && functionsComplete;
  const functionReviewActive = Boolean(rawComplete && functionTargets.length > 0 && functionReviewPhase && !dismissedReviewIds.includes(functionReviewPhase.id));
  const complete = rawComplete && !groupReviewActive && !functionReviewActive;
  const markingFunctions = groupsComplete && !groupReviewActive && !functionsComplete;
  const activeReviewPhase = groupReviewActive ? groupReviewPhase : functionReviewActive ? functionReviewPhase : undefined;
  const currentFunctionTarget = functionTargets.find((target) => !functionLeftIds.includes(target.id) || !functionRightIds.includes(target.id));
  const currentFunctionLabel = currentFunctionTarget ? functionAnnotations.find((annotation) => annotation.id === currentFunctionTarget.id)?.label : undefined;

  const currentLeftFound = currentTarget
    ? leftFoundIds.includes(currentTarget.id)
    : false;
  const currentRightFound = currentTarget
    ? rightFoundIds.includes(currentTarget.id)
    : false;
  const currentBracketsFound = currentLeftFound && currentRightFound;
  const currentClassified = currentTarget
    ? classifiedIds.includes(currentTarget.id)
    : false;
  const currentNucleusFound = currentTarget
    ? nucleusFoundIds.includes(currentTarget.id)
    : false;
  const currentContractedAnswered = currentTarget
    ? contractedAnsweredIds.includes(currentTarget.id)
    : false;
  const currentGprepNucleusFound = currentTarget
    ? gprepNucleusFoundIds.includes(currentTarget.id)
    : false;
  const currentNestedPresenceFound = currentTarget
    ? nestedPresenceFoundIds.includes(currentTarget.id)
    : false;
  const currentNestedTypeFound = currentTarget
    ? nestedTypeFoundIds.includes(currentTarget.id)
    : false;
  const phase:
    | "brackets"
    | "type"
    | "nucleus"
    | "contracted_answer"
    | "gprep_nucleus"
    | "nested_presence"
    | "nested_type"
    | "function_brackets"
    | "review"
    | "complete" = markingFunctions
    ? "function_brackets"
    : activeReviewPhase
    ? "review"
    : complete
    ? "complete"
    : currentIsContracted
      ? currentBracketsFound && !currentClassified
        ? "type"
        : currentClassified && !currentGprepNucleusFound
          ? "gprep_nucleus"
          : currentGprepNucleusFound && !currentNestedPresenceFound
            ? "nested_presence"
            : currentNestedPresenceFound && !currentNestedTypeFound
              ? "nested_type"
              : currentNestedTypeFound && !currentContractedAnswered
                ? "contracted_answer"
                : currentContractedAnswered && !currentNucleusFound
                  ? "nucleus"
                  : "brackets"
      : currentBracketsFound && !currentClassified
        ? "type"
        : currentTarget && targetNeedsNucleus(currentTarget) && currentClassified && !currentNucleusFound
          ? "nucleus"
          : "brackets";

  useEffect(() => {
    completeRef.current?.(complete);
  }, [complete]);

  useEffect(() => {
    if (!persistenceKey || typeof window === "undefined") {
      setHydrated(true);
      return;
    }

    try {
      const raw = window.sessionStorage.getItem(persistenceKey);

      if (raw) {
        const saved = JSON.parse(raw) as {
          leftFoundIds?: string[];
          rightFoundIds?: string[];
          classifiedIds?: string[];
          nucleusFoundIds?: string[];
          contractedAnsweredIds?: string[];
          gprepNucleusFoundIds?: string[];
          nestedPresenceFoundIds?: string[];
          nestedTypeFoundIds?: string[];
          functionLeftIds?: string[];
          functionRightIds?: string[];
          dismissedReviewIds?: string[];
          currentIndex?: number;
        };
        const left = saved.leftFoundIds ?? [];
        const right = saved.rightFoundIds ?? [];
        const classified = saved.classifiedIds ?? [];
        const nuclei = saved.nucleusFoundIds ?? [];
        const contractedAnswers = saved.contractedAnsweredIds ?? [];
        const gprepNuclei = saved.gprepNucleusFoundIds ?? [];
        const nestedPresence = saved.nestedPresenceFoundIds ?? [];
        const nestedTypes = saved.nestedTypeFoundIds ?? [];
        setLeftFoundIds(left);
        setRightFoundIds(right);
        setClassifiedIds(classified);
        setNucleusFoundIds(nuclei);
        setContractedAnsweredIds(contractedAnswers);
        setGprepNucleusFoundIds(gprepNuclei);
        setNestedPresenceFoundIds(nestedPresence);
        setNestedTypeFoundIds(nestedTypes);
        setFunctionLeftIds(saved.functionLeftIds ?? []);
        setFunctionRightIds(saved.functionRightIds ?? []);
        setDismissedReviewIds(saved.dismissedReviewIds ?? []);
        setCurrentIndex(
          Math.min(
            saved.currentIndex ?? 0,
            Math.max(0, targets.length - 1)
          )
        );

        const points: RestoredPoint[] = [];
        targets.forEach((target) => {
          if (left.includes(target.id)) {
            points.push({
              target,
              stage: "left_bracket",
              points: 1,
              pointId: `group-left-${target.id}`
            });
          }
          if (right.includes(target.id)) {
            points.push({
              target,
              stage: "right_bracket",
              points: 1,
              pointId: `group-right-${target.id}`
            });
          }
          if (classified.includes(target.id)) {
            points.push({
              target,
              stage: "group_type",
              points: 1,
              pointId: `group-type-${target.id}`
            });
          }
          if (
            isContractedNested(target) &&
            contractedAnswers.includes(target.id)
          ) {
            points.push({
              target,
              stage: "contracted_answer",
              points: 1,
              pointId: `group-contracted-${target.id}`
            });
          }
          if (nuclei.includes(target.id)) {
            points.push({
              target,
              stage: "nucleus",
              points: 1,
              pointId: `group-nucleus-${target.id}`
            });
          }
          if (
            isContractedNested(target) &&
            gprepNuclei.includes(target.id)
          ) {
            points.push({
              target,
              stage: "gprep_nucleus",
              points: 1,
              pointId: `group-gprep-nucleus-${target.id}`
            });
          }
          if (
            isContractedNested(target) &&
            nestedPresence.includes(target.id)
          ) {
            points.push({
              target,
              stage: "nested_presence",
              points: 1,
              pointId: `group-nested-presence-${target.id}`
            });
          }
          if (
            isContractedNested(target) &&
            nestedTypes.includes(target.id)
          ) {
            points.push({
              target,
              stage: "nested_type",
              points: 1,
              pointId: `group-nested-type-${target.id}`
            });
          }
        });
        restoreRef.current?.(points);
      }
    } catch {
      window.sessionStorage.removeItem(persistenceKey);
    } finally {
      setHydrated(true);
    }
  }, [persistenceKey, sentence.id, targets]);

  useEffect(() => {
    if (
      !hydrated ||
      !persistenceKey ||
      typeof window === "undefined"
    ) {
      return;
    }

    window.sessionStorage.setItem(
      persistenceKey,
      JSON.stringify({
        leftFoundIds,
        rightFoundIds,
        classifiedIds,
        nucleusFoundIds,
        contractedAnsweredIds,
        gprepNucleusFoundIds,
        nestedPresenceFoundIds,
        nestedTypeFoundIds,
        functionLeftIds,
        functionRightIds,
        dismissedReviewIds,
        currentIndex
      })
    );
  }, [
    classifiedIds,
    contractedAnsweredIds,
    gprepNucleusFoundIds,
    nestedPresenceFoundIds,
    nestedTypeFoundIds,
    functionLeftIds,
    functionRightIds,
    dismissedReviewIds,
    currentIndex,
    hydrated,
    leftFoundIds,
    nucleusFoundIds,
    persistenceKey,
    rightFoundIds
  ]);


  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;

    const frame = window.requestAnimationFrame(() => {
      const anchors = Array.from(
        surface.querySelectorAll<HTMLElement>(
          "[data-word-group-label-id]"
        )
      );

      const items = anchors.map((element) => {
        const id = element.dataset.wordGroupLabelId ?? "";
        const target = targets.find((item) => item.id === id);

        return {
          id,
          target,
          contracted:
            element.classList.contains("contracted-result"),
          rect: element.getBoundingClientRect()
        };
      });

      const next: Record<string, { x: number; y: number }> = {};

      items.forEach((item) => {
        next[item.id] = { x: 0, y: 0 };
      });

      const margin = 10;

      for (let i = 0; i < items.length; i += 1) {
        for (let j = i + 1; j < items.length; j += 1) {
          const a = items[i];
          const b = items[j];

          const overlapX =
            Math.min(a.rect.right, b.rect.right) -
            Math.max(a.rect.left, b.rect.left);
          const overlapY =
            Math.min(a.rect.bottom, b.rect.bottom) -
            Math.max(a.rect.top, b.rect.top);

          if (overlapX <= -margin || overlapY <= -margin) {
            continue;
          }

          // Priorité au bloc contracté à deux lignes : on le garde
          // près de son groupe et on décale plutôt le code voisin.
          let movable = b;
          let fixed = a;

          if (a.contracted && !b.contracted) {
            movable = b;
            fixed = a;
          } else if (b.contracted && !a.contracted) {
            movable = a;
            fixed = b;
          } else if (
            (a.target?.start ?? 0) > (b.target?.start ?? 0)
          ) {
            movable = a;
            fixed = b;
          }

          const movableCenter =
            (movable.rect.left + movable.rect.right) / 2;
          const fixedCenter =
            (fixed.rect.left + fixed.rect.right) / 2;

          let direction =
            movableCenter >= fixedCenter ? 1 : -1;

          if (Math.abs(movableCenter - fixedCenter) < 2) {
            direction =
              (movable.target?.start ?? 0) >=
              (fixed.target?.start ?? 0)
                ? 1
                : -1;
          }

          const shift = Math.min(
            90,
            Math.max(16, overlapX + margin)
          );

          next[movable.id].x += direction * shift;
        }
      }

      setLabelOffsets(next);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    classifiedIds,
    contractedAnsweredIds,
    gprepNucleusFoundIds,
    labelPositions,
    nucleusFoundIds,
    targets
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const surface = surfaceRef.current;
    if (!canvas || !surface) return;

    const resize = () => {
      const rect = surface.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, rect.width * ratio);
      canvas.height = Math.max(1, rect.height * ratio);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const context = canvas.getContext("2d");
      context?.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(surface);
    window.addEventListener("resize", resize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const ratio = window.devicePixelRatio || 1;
    context.clearRect(
      0,
      0,
      canvas.width / ratio,
      canvas.height / ratio
    );

    const activeBoundaryMode = markingFunctions ? continuationBoundaryMode : boundaryMode;
    if (activeBoundaryMode === "frame" && frameStart && frameCurrent) {
      context.save();
      context.setLineDash([7, 5]);
      context.lineWidth = 2;
      context.strokeStyle = "currentColor";
      context.strokeRect(
        Math.min(frameStart.x, frameCurrent.x),
        Math.min(frameStart.y, frameCurrent.y),
        Math.abs(frameCurrent.x - frameStart.x),
        Math.abs(frameCurrent.y - frameStart.y)
      );
      context.restore();
      return;
    }

    if (stroke.length < 2) return;

    context.beginPath();
    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "currentColor";
    context.moveTo(stroke[0].x, stroke[0].y);

    stroke.slice(1).forEach((point) => {
      context.lineTo(point.x, point.y);
    });

    context.stroke();
  }, [boundaryMode, continuationBoundaryMode, frameCurrent, frameStart, markingFunctions, stroke]);

  function findTokenElement(
    position: number,
    side: "start" | "end"
  ) {
    const surface = surfaceRef.current;
    if (!surface) return null;

    const matching = tokens.find((token) =>
      side === "start"
        ? token.isWord &&
          token.start <= position &&
          token.end > position
        : token.isWord &&
          token.start < position &&
          token.end >= position
    );

    if (!matching) {
      const fallback =
        side === "start"
          ? tokens.find(
              (token) =>
                token.isWord && token.start >= position
            )
          : [...tokens]
              .reverse()
              .find(
                (token) =>
                  token.isWord && token.end <= position
              );

      if (!fallback) return null;

      return surface.querySelector<HTMLElement>(
        `[data-group-token-id="${fallback.id}"]`
      );
    }

    return surface.querySelector<HTMLElement>(
      `[data-group-token-id="${matching.id}"]`
    );
  }

  function expectedAnchor(
    target: WordGroupTarget,
    boundary: Boundary
  ) {
    const surface = surfaceRef.current;
    if (!surface) return null;

    const surfaceRect = surface.getBoundingClientRect();
    const element =
      boundary === "left_bracket"
        ? findTokenElement(target.start, "start")
        : findTokenElement(target.end, "end");

    if (!element) return null;

    const rect = element.getBoundingClientRect();

    return {
      x:
        boundary === "left_bracket"
          ? rect.left - surfaceRect.left - 7
          : rect.right - surfaceRect.left + 7,
      y: rect.top - surfaceRect.top + rect.height / 2,
      height: Math.max(34, rect.height * 1.35)
    };
  }

  function validateStroke(points: StrokePoint[]) {
    const recognized = recognizeBracketStroke(points);
    if (!recognized) {
      setMessage("Trace un crochet plus clairement.");
      return;
    }

    const boundary: Boundary =
      recognized === "[" ? "left_bracket" : "right_bracket";
    const boundaryTargets = markingFunctions ? functionTargets : targets;
    const foundLeftIds = markingFunctions ? functionLeftIds : leftFoundIds;
    const foundRightIds = markingFunctions ? functionRightIds : rightFoundIds;
    const requestedTargetId = markingFunctions ? currentFunctionTarget?.id : undefined;
    const completedGroupIds = targets
      .filter((target) => targetNeedsNucleus(target) ? nucleusFoundIds.includes(target.id) : classifiedIds.includes(target.id))
      .map((target) => target.id);
    const unavailableIds = Array.from(new Set([...completedGroupIds, ...(boundary === "left_bracket" ? foundLeftIds : foundRightIds)]));
    const otherBoundaryIds = boundary === "left_bracket" ? foundRightIds : foundLeftIds;
    const matched = chooseBracketTarget(points, boundaryTargets, unavailableIds, otherBoundaryIds, requestedTargetId, (target) => expectedAnchor(target, boundary));
    if (!matched) {
      setMessage(
        recognized === "["
          ? "Le crochet gauche n’est pas au bon endroit."
          : "Le crochet droit n’est pas au bon endroit."
      );
      return;
    }

    if (markingFunctions) {
      if (boundary === "left_bracket") setFunctionLeftIds((current) => current.includes(matched.target.id) ? current : [...current, matched.target.id]);
      else setFunctionRightIds((current) => current.includes(matched.target.id) ? current : [...current, matched.target.id]);
    } else if (boundary === "left_bracket") {
      setLeftFoundIds((current) =>
        current.includes(matched.target.id)
          ? current
          : [...current, matched.target.id]
      );
    } else {
      setRightFoundIds((current) =>
        current.includes(matched.target.id)
          ? current
          : [...current, matched.target.id]
      );
    }

    if (!markingFunctions) onPoint(matched.target, boundary, 1, boundary === "left_bracket" ? `group-left-${matched.target.id}` : `group-right-${matched.target.id}`);

    const newlyCompleted =
      boundary === "left_bracket" ? foundRightIds.includes(matched.target.id) : foundLeftIds.includes(matched.target.id);

    if (!markingFunctions) setCurrentIndex(matched.index);
    if (newlyCompleted && !markingFunctions) {
      const surfaceWidth = surfaceRef.current?.clientWidth ?? 0;
      setTypeMenuSide((labelPositions[matched.target.id]?.x ?? 0) > surfaceWidth * .58 ? "left" : "right");
      setTypeMenuOpen(true);
    }

    setMessage("");
  }

  function pointerPosition(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  function beginDrawing(
    event: React.PointerEvent<HTMLCanvasElement>
  ) {
    const activeBoundaryMode = markingFunctions ? continuationBoundaryMode : boundaryMode;
    if ((phase !== "brackets" && phase !== "function_brackets") || activeBoundaryMode === "frame") return;

    const position = pointerPosition(event.clientX, event.clientY);
    if (!position) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    setDrawing(true);
    setStroke([position]);
    setMessage("");
  }

  function handleFrameClick(event: React.MouseEvent<HTMLCanvasElement>) {
    const activeBoundaryMode = markingFunctions ? continuationBoundaryMode : boundaryMode;
    if ((phase !== "brackets" && phase !== "function_brackets") || activeBoundaryMode !== "frame") return;
    const point = pointerPosition(event.clientX, event.clientY);
    if (!point) return;
    if (!frameStart) {
      setFrameStart(point);
      setFrameCurrent(point);
      setMessage("Clique maintenant sur le coin opposé du rectangle.");
      return;
    }
    const canvas = canvasRef.current;
    const surface = surfaceRef.current;
    if (!canvas || !surface) return;
    const canvasRect = canvas.getBoundingClientRect();
    const left = Math.min(frameStart.x, point.x) - 8;
    const right = Math.max(frameStart.x, point.x) + 8;
    const top = Math.min(frameStart.y, point.y) - 12;
    const bottom = Math.max(frameStart.y, point.y) + 12;
    const selected = tokens.filter((token) => {
      if (!token.isWord) return false;
      const element = surface.querySelector<HTMLElement>(`[data-group-token-id="${token.id}"]`);
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const centerX = (rect.left + rect.right) / 2 - canvasRect.left;
      const centerY = (rect.top + rect.bottom) / 2 - canvasRect.top;
      return centerX >= left && centerX <= right && centerY >= top && centerY <= bottom;
    });
    const start = selected.length ? Math.min(...selected.map((token) => token.start)) : -1;
    const end = selected.length ? Math.max(...selected.map((token) => token.end)) : -1;
    const boundaryTargets = markingFunctions ? functionTargets : targets;
    const foundLeftIds = markingFunctions ? functionLeftIds : leftFoundIds;
    const foundRightIds = markingFunctions ? functionRightIds : rightFoundIds;
    const requestedTargetId = markingFunctions ? currentFunctionTarget?.id : undefined;
    const match = matchDrawnRange(start, end, boundaryTargets, Array.from(new Set([...foundLeftIds, ...foundRightIds])), requestedTargetId);
    setFrameStart(null);
    setFrameCurrent(null);
    if (!match) {
      setMessage("Le rectangle ne correspond pas au groupe demandé. Réessaie.");
      return;
    }
    const index = boundaryTargets.findIndex((target) => target.id === match.id);
    if (markingFunctions) {
      setFunctionLeftIds((current) => [...current, match.id]);
      setFunctionRightIds((current) => [...current, match.id]);
    } else {
      setLeftFoundIds((current) => [...current, match.id]);
      setRightFoundIds((current) => [...current, match.id]);
      setCurrentIndex(index);
      const surfaceWidth = surfaceRef.current?.clientWidth ?? 0;
      setTypeMenuSide((labelPositions[match.id]?.x ?? 0) > surfaceWidth * .58 ? "left" : "right");
      setTypeMenuOpen(true);
      onPoint(match, "left_bracket", 1, `group-left-${match.id}`);
      onPoint(match, "right_bracket", 1, `group-right-${match.id}`);
    }
    setMessage("");
  }

  function continueDrawing(
    event: React.PointerEvent<HTMLCanvasElement>
  ) {
    if (!drawing) return;

    // Read the pointer coordinates synchronously while the React event
    // still has a valid target. State updater callbacks may run later.
    const position = pointerPosition(event.clientX, event.clientY);
    if (!position) return;

    setStroke((current) => [...current, position]);
  }

  function endDrawing(
    event: React.PointerEvent<HTMLCanvasElement>
  ) {
    if (!drawing) return;

    const position = pointerPosition(event.clientX, event.clientY);
    if (!position) {
      setDrawing(false);
      setStroke([]);
      return;
    }

    const finalStroke = [...stroke, position];
    setDrawing(false);
    validateStroke(finalStroke);

    window.setTimeout(() => {
      setStroke([]);
    }, 180);
  }

  function restart() {
    setLeftFoundIds([]);
    setRightFoundIds([]);
    setFunctionLeftIds([]);
    setFunctionRightIds([]);
    setCurrentIndex(0);
    setClassifiedIds([]);
    setNucleusFoundIds([]);
    setContractedAnsweredIds([]);
    setGprepNucleusFoundIds([]);
    setNestedPresenceFoundIds([]);
    setNestedTypeFoundIds([]);
    setDismissedReviewIds([]);
    setTypeMenuOpen(false);
    setContractedAnswer("");
    setStroke([]);
    setFrameStart(null);
    setFrameCurrent(null);
    setMessage("");
    restoreRef.current?.([]);

    if (persistenceKey && typeof window !== "undefined") {
      window.sessionStorage.removeItem(persistenceKey);
    }
  }

  function returnToFreeSearch(completedTargetId: string) {
    const nextIndex = targets.findIndex(
      (target) =>
        target.id !== completedTargetId &&
        !(targetNeedsNucleus(target) ? nucleusFoundIds : classifiedIds).includes(target.id)
    );

    if (nextIndex >= 0) {
      setCurrentIndex(nextIndex);
    }
    setTypeMenuOpen(false);
  }

  function normalizeContractedAnswer(value: string) {
    return value
      .trim()
      .toLocaleLowerCase("fr")
      .replace(/[’']/g, "'")
      .replace(/\s+/g, " ");
  }

  function submitContractedAnswer() {
    if (
      !currentTarget ||
      !isContractedNested(currentTarget) ||
      phase !== "contracted_answer"
    ) {
      return;
    }

    const expected = currentTarget.contractedGnText ?? "";
    if (
      normalizeContractedAnswer(contractedAnswer) !==
      normalizeContractedAnswer(expected)
    ) {
      setMessage("Ce n’est pas le GN attendu. Essaie encore.");
      return;
    }

    setContractedAnsweredIds((current) =>
      current.includes(currentTarget.id)
        ? current
        : [...current, currentTarget.id]
    );
    setMessage("");
    onPoint(
      currentTarget,
      "contracted_answer",
      1,
      `group-contracted-${currentTarget.id}`
    );
    setContractedAnswer("");
  }

  function chooseGroupType(groupType: WordGroupType) {
    if (!currentTarget || phase !== "type") return;

    if (groupType !== currentTarget.groupType) {
      setMessage("Ce n’est pas le bon type de groupe. Essaie encore.");
      return;
    }

    setClassifiedIds((current) =>
      current.includes(currentTarget.id)
        ? current
        : [...current, currentTarget.id]
    );
    setTypeMenuOpen(false);
    setMessage("");
    onPoint(
      currentTarget,
      "group_type",
      1,
      `group-type-${currentTarget.id}`
    );
    if (!targetNeedsNucleus(currentTarget) && !isContractedNested(currentTarget)) {
      window.setTimeout(() => returnToFreeSearch(currentTarget.id), 250);
    }
  }

  function selectNucleus(token: Token) {
    if (
      !currentTarget ||
      phase !== "nucleus" ||
      !token.isWord ||
      currentTarget.nucleusStart === undefined ||
      currentTarget.nucleusEnd === undefined
    ) {
      return;
    }

    const isNucleus =
      token.start >= currentTarget.nucleusStart &&
      token.end <= currentTarget.nucleusEnd;

    if (!isNucleus) {
      setMessage("Ce mot n’est pas le noyau de ce groupe.");
      return;
    }

    setNucleusFoundIds((current) =>
      current.includes(currentTarget.id)
        ? current
        : [...current, currentTarget.id]
    );
    setMessage("");
    onPoint(
      currentTarget,
      "nucleus",
      1,
      `group-nucleus-${currentTarget.id}`
    );

    if (!isContractedNested(currentTarget)) {
      window.setTimeout(() => {
        returnToFreeSearch(currentTarget.id);
      }, 450);
    }
  }

  function chooseGprepNucleus(value: "de" | "à" | "le" | "les") {
    if (
      !currentTarget ||
      !isContractedNested(currentTarget) ||
      phase !== "gprep_nucleus"
    ) {
      return;
    }

    const expected =
      currentTarget.contractedPrepNucleus ??
      (currentTarget.text.trim().toLowerCase().startsWith("au") ||
      currentTarget.text.trim().toLowerCase().startsWith("aux")
        ? "à"
        : "de");

    if (value !== expected) {
      setMessage("Ce n’est pas le noyau du GPrép. Essaie encore.");
      return;
    }

    setGprepNucleusFoundIds((current) =>
      current.includes(currentTarget.id)
        ? current
        : [...current, currentTarget.id]
    );
    setMessage("");
    onPoint(
      currentTarget,
      "gprep_nucleus",
      1,
      `group-gprep-nucleus-${currentTarget.id}`
    );

  }

  function chooseNestedPresence(hasNestedGroup: boolean) {
    if (
      !currentTarget ||
      !isContractedNested(currentTarget) ||
      phase !== "nested_presence"
    ) {
      return;
    }

    if (!hasNestedGroup) {
      setMessage("Ce GPrép contient bien un autre groupe. Essaie encore.");
      return;
    }

    setNestedPresenceFoundIds((current) =>
      current.includes(currentTarget.id)
        ? current
        : [...current, currentTarget.id]
    );
    setMessage("");
    onPoint(
      currentTarget,
      "nested_presence",
      1,
      `group-nested-presence-${currentTarget.id}`
    );
  }

  function chooseNestedType(groupType: WordGroupType) {
    if (
      !currentTarget ||
      !isContractedNested(currentTarget) ||
      phase !== "nested_type"
    ) {
      return;
    }

    if (groupType !== "GN") {
      setMessage("Ce n’est pas le bon type de groupe enchâssé.");
      return;
    }

    setNestedTypeFoundIds((current) =>
      current.includes(currentTarget.id)
        ? current
        : [...current, currentTarget.id]
    );
    setMessage("");
    onPoint(
      currentTarget,
      "nested_type",
      1,
      `group-nested-type-${currentTarget.id}`
    );
  }

  function instructionText() {
    if (complete) return "Activité terminée — tous les groupes ont été identifiés.";
    if (phase === "contracted_answer") {
      return "Écris le groupe enchâssé avec le déterminant décortiqué.";
    }
    if (phase === "type") return "Choisis maintenant le type du groupe que tu viens de délimiter.";
    if (phase === "nucleus") {
      return currentIsContracted
        ? "Clique sur le noyau du GN enchâssé."
        : "Clique sur le noyau du groupe.";
    }
    if (phase === "gprep_nucleus") {
      return "Identifie le noyau du GPrép.";
    }
    if (phase === "nested_presence") {
      return "Le GPrép contient-il un autre groupe?";
    }
    if (phase === "nested_type") {
      return "Quel est le groupe enchâssé?";
    }
    if (markingFunctions) {
      const functionName = grammarFunctionInstructionLabel(currentFunctionLabel);
      return continuationBoundaryMode === "frame"
        ? `Encadre ${functionName} avec un rectangle.`
        : `Mets ${functionName} entre crochets.`;
    }
    return boundaryMode === "frame"
      ? "Encadre un groupe de mots avec un rectangle. Ensuite, indique son type."
      : "Mets un groupe de mots entre crochets. Ensuite, indique son type.";
  }

  return (
    <div className={`word-group-reader ${embedded ? "embedded" : ""}`}>
      {!activeReviewPhase && <ReaderChromePortal slot="instruction">
        <div className="reader-chrome-instruction-copy"><strong>{instructionText()}</strong>{message && <span className="reader-chrome-feedback">{message}</span>}</div>
      </ReaderChromePortal>}
      {!activeReviewPhase && <ReaderChromePortal slot="progress">
        <div className="reader-chrome-progress">
          <strong>{markingFunctions ? functionTargets.filter((target) => functionLeftIds.includes(target.id) && functionRightIds.includes(target.id)).length + "/" + functionTargets.length + " fonctions" : targets.filter((target) => targetNeedsNucleus(target) ? nucleusFoundIds.includes(target.id) : classifiedIds.includes(target.id)).length + "/" + targets.length + " groupes"}</strong>
          <span className="reader-chrome-progress-dots" aria-hidden="true">
            {Array.from({ length: Math.max(1, markingFunctions ? functionTargets.length : targets.length) }, (_, index) => <i key={index} className={index < (markingFunctions ? functionTargets.filter((target) => functionLeftIds.includes(target.id) && functionRightIds.includes(target.id)).length : targets.filter((target) => targetNeedsNucleus(target) ? nucleusFoundIds.includes(target.id) : classifiedIds.includes(target.id)).length) ? "done" : ""} />)}
          </span>
        </div>
      </ReaderChromePortal>}
      {activeReviewPhase && (
        <CorrectionPause
          phase={activeReviewPhase}
          onContinue={() => setDismissedReviewIds((current) => current.includes(activeReviewPhase.id) ? current : [...current, activeReviewPhase.id])}
        />
      )}

      <div
        className={`word-group-drawing-surface phase-${phase}`}
        ref={surfaceRef}
      >
        <RangeMarksLayer targets={targets} positions={labelPositions} leftIds={leftFoundIds} rightIds={rightFoundIds} mode={boundaryMode}/>
        <RangeMarksLayer targets={functionTargets} positions={labelPositions} leftIds={functionLeftIds} rightIds={functionRightIds} mode={continuationBoundaryMode}/>
        <ResolvedCorrectionLabels marks={correctionMarks} positions={labelPositions} />
        {targets.map((target) => {
          const position = labelPositions[target.id];
          const classified = classifiedIds.includes(target.id);
          const selecting =
            phase === "type" && currentTarget?.id === target.id;

          if (!position || (!classified && !selecting)) return null;

          return (
            <div
              className={`word-group-label-anchor${
                isContractedNested(target) &&
                contractedAnsweredIds.includes(target.id)
                  ? " contracted-result"
                  : ""
              }`}
              key={`label-${target.id}`}
              data-word-group-label-id={target.id}
              style={{
                left:
                  position.x + (labelOffsets[target.id]?.x ?? 0),
                top:
                  position.y + (labelOffsets[target.id]?.y ?? 0)
              }}
            >
              {selecting ? (
                <div className="word-group-type-picker">
                  <button
                    type="button"
                    className="word-group-code-box"
                    onClick={() => {
                      const surfaceWidth = surfaceRef.current?.clientWidth ?? 0;
                      setTypeMenuSide((position?.x ?? 0) > surfaceWidth * .58 ? "left" : "right");
                      setTypeMenuOpen((open) => !open);
                    }}
                    aria-expanded={typeMenuOpen}
                    aria-label="Choisir le type de groupe"
                  >
                    <span aria-hidden="true">&nbsp;</span>
                  </button>
                  {typeMenuOpen && (
                    <div className={`word-group-type-menu open-${typeMenuSide}`}>
                      {(Object.keys(groupLabels) as WordGroupType[]).map(
                        (groupType) => (
                          <button
                            type="button"
                            key={groupType}
                            onClick={() => chooseGroupType(groupType)}
                          >
                            <strong>{groupType}</strong>
                            <span>{groupLabels[groupType]}</span>
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="word-group-completed-label">
                  <span
                    className="word-group-code-box filled"
                    aria-label={groupLabels[target.groupType]}
                  >
                    {target.groupType}
                    {isContractedNested(target) &&
                      gprepNucleusFoundIds.includes(target.id) &&
                      target.contractedPrepNucleus && (
                        <span className="word-group-inline-nucleus">
                          {" "}— Noyau : {target.contractedPrepNucleus}
                        </span>
                      )}
                  </span>
                  {isContractedNested(target) &&
                    contractedAnsweredIds.includes(target.id) &&
                    target.contractedGnText && (
                      <span className="word-group-contracted-gn">
                        (GN : {target.contractedGnText}
                        {nucleusFoundIds.includes(target.id) &&
                          target.nucleusText &&
                          ` — Noyau : ${target.nucleusText}`})
                      </span>
                    )}
                </div>
              )}
            </div>
          );
        })}

        {functionAnnotations.map((annotation) => {
          const position = labelPositions[annotation.id];
          const solved = functionLeftIds.includes(annotation.id) && functionRightIds.includes(annotation.id);
          if (!position || !solved) return null;
          return (
            <div
              className="word-group-label-anchor function-label-anchor"
              key={`function-label-${annotation.id}`}
              style={{ left: position.x, top: position.y }}
            >
              <span className="word-group-code-box filled function-code-box">
                {grammarFunctionInstructionLabel(annotation.label)}
              </span>
            </div>
          );
        })}

        <div className="word-group-reader-text shared-grammar-reader-text">
          {tokens.map((token) => {
            const breakBefore = controlledLineBreaks.some((position) => position >= token.start && position < token.end);
            const measurableToken =
              token.isWord || token.text.trim().length > 0;

            const groupConfirmed =
              token.isWord &&
              targets.some(
                (target) =>
                  classifiedIds.includes(target.id) &&
                  token.start < target.end &&
                  token.end > target.start
              );
            return (
              <span key={token.id}>
              {breakBefore && <br />}
              <span
                className={
                  token.isWord
                    ? `word-group-reader-token${
                        groupConfirmed ? " group-confirmed" : ""
                      }${
                        phase === "nucleus"
                          ? " nucleus-selectable"
                          : ""
                      }${
                        targets.some(
                          (target) =>
                            nucleusFoundIds.includes(target.id) &&
                            target.nucleusStart !== undefined &&
                            target.nucleusEnd !== undefined &&
                            token.start >= target.nucleusStart &&
                            token.end <= target.nucleusEnd
                        )
                          ? " nucleus-confirmed"
                          : ""
                      }`
                    : undefined
                }
                data-group-token-id={
                  measurableToken ? token.id : undefined
                }
                onClick={
                  token.isWord && phase === "nucleus"
                    ? () => selectNucleus(token)
                    : undefined
                }
              >
                {protectFrenchElisionBreaks(token.text)}
              </span>
              </span>
            );
          })}
        </div>

        <canvas
          ref={canvasRef}
          className={`word-group-drawing-canvas${
            phase === "brackets" || phase === "function_brackets" ? "" : " inactive"
          }`}
          onPointerDown={beginDrawing}
          onPointerMove={(event) => {
            const activeBoundaryMode = markingFunctions ? continuationBoundaryMode : boundaryMode;
            if (activeBoundaryMode === "frame" && frameStart) {
              const position = pointerPosition(event.clientX, event.clientY);
              if (position) setFrameCurrent(position);
              return;
            }
            continueDrawing(event);
          }}
          onPointerUp={endDrawing}
          onClick={handleFrameClick}
          onPointerCancel={() => {
            setDrawing(false);
            setStroke([]);
          }}
          aria-label="Dessine les crochets directement sur la phrase"
        />

        {phase === "nested_presence" && currentTarget && (
          <div className="word-group-contracted-popover">
            <strong>
              Le GPrép « {currentTarget.text} » contient-il un autre
              groupe?
            </strong>
            <div className="word-group-contraction-choices">
              <button
                type="button"
                onClick={() => chooseNestedPresence(true)}
              >
                Oui
              </button>
              <button
                type="button"
                onClick={() => chooseNestedPresence(false)}
              >
                Non
              </button>
            </div>
          </div>
        )}
        {phase === "nested_type" && currentTarget && (
          <div className="word-group-contracted-popover">
            <strong>Quel est le groupe enchâssé?</strong>
            <div className="word-group-nested-type-grid">
              {(Object.keys(groupLabels) as WordGroupType[]).map(
                (groupType) => (
                  <button
                    type="button"
                    key={groupType}
                    onClick={() => chooseNestedType(groupType)}
                  >
                    <strong>{groupType}</strong>
                    <span>{groupLabels[groupType]}</span>
                  </button>
                )
              )}
            </div>
          </div>
        )}
        {phase === "contracted_answer" && currentTarget && (
          <div className="word-group-contracted-popover">
            <strong>
              Il s’agit bien d’un groupe enchâssé avec déterminant
              contracté.
            </strong>
            <label>
              Écris le GN :
              <input
                autoFocus
                value={contractedAnswer}
                onChange={(event) =>
                  setContractedAnswer(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitContractedAnswer();
                  }
                }}
                placeholder="Ex. le quartier"
              />
            </label>
            <Button
              type="button"
              onClick={submitContractedAnswer}
            >
              Valider
            </Button>
          </div>
        )}
        {phase === "gprep_nucleus" && currentTarget && (
          <div className="word-group-contracted-popover">
            <strong>
              Quel est le noyau du GPrép « {currentTarget.text} » ?
            </strong>
            <div className="word-group-contraction-equation">
              {currentTarget.text.trim().split(/\s+/)[0]} ={" "}
              {currentTarget.contractedPrepNucleus ??
                (currentTarget.text.trim().toLowerCase().startsWith("au") ||
                currentTarget.text.trim().toLowerCase().startsWith("aux")
                  ? "à"
                  : "de")}{" "}
              +{" "}
              {currentTarget.contractedGnText?.trim().split(/\s+/)[0]}
            </div>
            <div
              className="word-group-contraction-choices"
              role="group"
              aria-label="Choisir le noyau du GPrép"
            >
              <button
                type="button"
                onClick={() =>
                  chooseGprepNucleus(
                    currentTarget.contractedPrepNucleus ??
                      (currentTarget.text.trim().toLowerCase().startsWith("au") ||
                      currentTarget.text.trim().toLowerCase().startsWith("aux")
                        ? "à"
                        : "de")
                  )
                }
              >
                {currentTarget.contractedPrepNucleus ??
                  (currentTarget.text.trim().toLowerCase().startsWith("au") ||
                  currentTarget.text.trim().toLowerCase().startsWith("aux")
                    ? "à"
                    : "de")}
              </button>
              <button
                type="button"
                onClick={() =>
                  chooseGprepNucleus(
                    (currentTarget.contractedGnText?.trim().split(/\s+/)[0] ??
                      "le") as "le" | "les"
                  )
                }
              >
                {currentTarget.contractedGnText?.trim().split(/\s+/)[0] ??
                  "le"}
              </button>
            </div>
          </div>
        )}
      </div>

      {(!embedded || (complete && finishControl)) && (
        <ReaderChromePortal slot="actions">
          {!embedded && <Button type="button" variant="secondary" onClick={restart}><RotateCcw size={18} /> Recommencer</Button>}
          {complete ? finishControl : null}
        </ReaderChromePortal>
      )}
    </div>
  );
}
