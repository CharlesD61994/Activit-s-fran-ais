"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent
} from "react";
import { Check, CheckCircle2, RotateCcw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReaderChromePortal } from "@/components/presentation/reader-chrome";
import { wordClassLabels } from "@/lib/activity-types";
import { buildRelationTasks } from "@/lib/word-class-relations";
import { getAgreementWorkflowSettings } from "@/lib/grammar-workflow";
import type {
  Sentence,
  WordClass,
  WordClassTarget
} from "@/types";

type PointStage = "find" | "class" | "role" | "agreement";

type RestoredPoint = {
  target: WordClassTarget;
  stage: PointStage;
  points: number;
  pointId?: string;
};

type Props = {
  sentence: Sentence;
  persistenceKey?: string;
  onPoint: (
    target: WordClassTarget,
    stage: PointStage,
    points: number,
    pointId?: string
  ) => void;
  onRestorePoints?: (points: RestoredPoint[]) => void;
  onCompleteChange?: (complete: boolean) => void;
  finishControl?: React.ReactNode;
  embedded?: boolean;
};

type WordToken = {
  id: string;
  start: number;
  end: number;
  text: string;
  isWord: boolean;
};

type TargetRole = "donor" | "receiver";

type AgreementPoint = {
  x: number;
  y: number;
};

type DrawnAgreementArrow = {
  id: string;
  taskTargetId: string;
  answerId: string;
  color: string;
  points: AgreementPoint[];
};

type AgreementArrow = {
  id: string;
  color: string;
  path: string;
  tipPath: string;
};

const AGREEMENT_INK_COLORS = [
  { value: "#315f84", label: "Bleu" },
  { value: "#d93636", label: "Rouge" },
  { value: "#2f8f5b", label: "Vert" },
  { value: "#7a4bb3", label: "Violet" },
  { value: "#d97706", label: "Orange" }
] as const;

const ALL_WORD_CLASSES = Object.keys(wordClassLabels) as WordClass[];

const DEFAULT_AGREEMENT_INK_COLOR =
  AGREEMENT_INK_COLORS[0].value;

function tokenize(text: string): WordToken[] {
  return Array.from(
    text.matchAll(/[\p{L}\p{M}]+|[^\p{L}\p{M}]+/gu)
  ).map((match, index) => {
    const value = match[0];
    const start = match.index ?? 0;

    return {
      id: `token-${index}-${start}`,
      start,
      end: start + value.length,
      text: value,
      isWord: /[\p{L}\p{M}]/u.test(value)
    };
  });
}

function normalizeTargets(
  text: string,
  targets: WordClassTarget[]
): WordClassTarget[] {
  return targets.map((target) => {
    const raw = text.slice(target.start, target.end);
    const leadingWhitespace = raw.match(/^\s*/)?.[0].length ?? 0;
    const trailingWhitespace = raw.match(/\s*$/)?.[0].length ?? 0;
    const start = target.start + leadingWhitespace;
    const end = target.end - trailingWhitespace;

    return {
      ...target,
      start,
      end,
      text: text.slice(start, end)
    };
  });
}


function usesClassChoice(
  target: WordClassTarget,
  multipleClasses: boolean,
  hasExplicitClassModes: boolean
) {
  if (hasExplicitClassModes) {
    return target.wordClassInteractionMode === "choose_class";
  }

  return multipleClasses;
}

function buildAgreementArrow(
  id: string,
  points: AgreementPoint[],
  color: string
): AgreementArrow | null {
  if (points.length < 2) return null;

  const path = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`
    )
    .join(" ");

  const end = points[points.length - 1];
  let previousIndex = points.length - 2;

  while (
    previousIndex > 0 &&
    Math.hypot(
      end.x - points[previousIndex].x,
      end.y - points[previousIndex].y
    ) < 7
  ) {
    previousIndex -= 1;
  }

  const previous = points[previousIndex];
  const length = Math.max(
    1,
    Math.hypot(end.x - previous.x, end.y - previous.y)
  );
  const unitX = (end.x - previous.x) / length;
  const unitY = (end.y - previous.y) / length;
  const baseX = end.x - unitX * 12;
  const baseY = end.y - unitY * 12;
  const perpendicularX = -unitY * 5;
  const perpendicularY = unitX * 5;

  return {
    id,
    color,
    path,
    tipPath: [
      `M ${(baseX + perpendicularX).toFixed(1)} ${(
        baseY + perpendicularY
      ).toFixed(1)}`,
      `L ${end.x.toFixed(1)} ${end.y.toFixed(1)}`,
      `L ${(baseX - perpendicularX).toFixed(1)} ${(
        baseY - perpendicularY
      ).toFixed(1)}`
    ].join(" ")
  };
}
export function WordClassReader({
  sentence,
  persistenceKey,
  onPoint,
  onRestorePoints,
  onCompleteChange,
  finishControl,
  embedded = false
}: Props) {
  const selectedClasses = useMemo(
    () => sentence.selectedWordClasses ?? [],
    [sentence.selectedWordClasses]
  );
  const multipleClasses = selectedClasses.length > 1;

  const allTargets = useMemo(
    () =>
      normalizeTargets(
        sentence.originalText,
        sentence.wordClassTargets ?? []
      ),
    [sentence.originalText, sentence.wordClassTargets]
  );

  const analysisTargets = useMemo(
    () =>
      allTargets.filter(
        (target) =>
          target.isAnalysisTarget !== false &&
          selectedClasses.includes(target.wordClass)
      ),
    [allTargets, selectedClasses]
  );

  const hasExplicitClassModes = analysisTargets.some(
    (target) => Boolean(target.wordClassInteractionMode)
  );
  const hasClassChoiceTargets = analysisTargets.some((target) =>
    usesClassChoice(target, multipleClasses, hasExplicitClassModes)
  );
  const hasDirectFindTargets = analysisTargets.some(
    (target) =>
      !usesClassChoice(target, multipleClasses, hasExplicitClassModes)
  );

  const relations = useMemo(
    () => sentence.agreementRelations ?? [],
    [sentence.agreementRelations]
  );
  const agreementWorkflow = useMemo(
    () => getAgreementWorkflowSettings(sentence),
    [sentence]
  );
  const allRelationTasks = useMemo(
    () =>
      sentence.agreementRelationsEnabled
        ? buildRelationTasks(analysisTargets, relations)
        : [],
    [
      analysisTargets,
      relations,
      sentence.agreementRelationsEnabled
    ]
  );
  const roleTasks = useMemo(
    () =>
      allRelationTasks.filter((task) =>
        task.role === "donor"
          ? agreementWorkflow.identifyDonors
          : agreementWorkflow.identifyReceivers
      ),
    [
      agreementWorkflow.identifyDonors,
      agreementWorkflow.identifyReceivers,
      allRelationTasks
    ]
  );
  const relationTasks = useMemo(
    () => (agreementWorkflow.linkAgreement ? allRelationTasks : []),
    [agreementWorkflow.linkAgreement, allRelationTasks]
  );

  const agreementBandHeight = useMemo(() => {
    const linkCount = relationTasks.reduce(
      (total, task) => total + task.expectedIds.length,
      0
    );

    return Math.min(
      36,
      32 + Math.max(1, Math.min(linkCount, 4))
    );
  }, [relationTasks]);

  const tokens = useMemo(
    () => tokenize(sentence.originalText),
    [sentence.originalText]
  );

  const targetMap = useMemo(
    () => new Map(allTargets.map((target) => [target.id, target])),
    [allTargets]
  );

  const targetByRange = useMemo(() => {
    const map = new Map<string, WordClassTarget>();
    allTargets.forEach((target) => {
      map.set(`${target.start}-${target.end}`, target);
    });
    return map;
  }, [allTargets]);

  const taskMap = useMemo(
    () =>
      new Map(
        relationTasks.map((task) => [task.targetId, task])
      ),
    [relationTasks]
  );
  const roleTaskMap = useMemo(
    () => new Map(roleTasks.map((task) => [task.targetId, task])),
    [roleTasks]
  );

  const [foundIds, setFoundIds] = useState<string[]>([]);
  const [classPointIds, setClassPointIds] = useState<string[]>([]);
  const [resolvedRoleIds, setResolvedRoleIds] = useState<string[]>([]);
  const [resolvedGenderIds, setResolvedGenderIds] = useState<string[]>([]);
  const [resolvedNumberIds, setResolvedNumberIds] = useState<string[]>([]);
  const [rolePointIds, setRolePointIds] = useState<string[]>([]);
  const [relationAnswers, setRelationAnswers] = useState<
    Record<string, string[]>
  >({});
  const [activeToken, setActiveToken] = useState<WordToken | null>(null);
  const [selectedClass, setSelectedClass] = useState<WordClass>(
    selectedClasses[0] ?? "noun"
  );
  const [roleTargetId, setRoleTargetId] = useState<string | null>(null);
  const [genderNumberTargetId, setGenderNumberTargetId] = useState<string | null>(null);
  const [genderNumberStep, setGenderNumberStep] = useState<"gender" | "number">("gender");
  const [genderNumberFeedback, setGenderNumberFeedback] = useState("");
  const [activeRelationTargetId, setActiveRelationTargetId] =
    useState<string | null>(null);
  const [roleFeedback, setRoleFeedback] = useState("");
  const [message, setMessage] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [drawnAgreementArrows, setDrawnAgreementArrows] = useState<
    DrawnAgreementArrow[]
  >([]);
  const [draftAgreementPoints, setDraftAgreementPoints] = useState<
    AgreementPoint[]
  >([]);
  const [agreementArrowsVisible, setAgreementArrowsVisible] = useState(true);
  const [agreementInkColor, setAgreementInkColor] = useState<string>(
    DEFAULT_AGREEMENT_INK_COLOR
  );
  const [confirmedWordIds, setConfirmedWordIds] = useState<string[]>(
    []
  );
  const [roleTriggeredTargetIds, setRoleTriggeredTargetIds] = useState<string[]>([]);
  const [suspendedRelationTargetId, setSuspendedRelationTargetId] = useState<string | null>(null);
  const [arrowCanvas, setArrowCanvas] = useState({
    width: 0,
    height: 0
  });

  const textContainerRef = useRef<HTMLDivElement>(null);
  const activeDrawingPointerRef = useRef<number | null>(null);
  const drawingStartTargetIdRef = useRef<string | null>(null);
  const draftAgreementPointsRef = useRef<AgreementPoint[]>([]);
  const wordSuccessTimerRef = useRef<number | null>(null);
  const restoreRef = useRef(onRestorePoints);
  const completeRef = useRef(onCompleteChange);

  useEffect(() => {
    restoreRef.current = onRestorePoints;
  }, [onRestorePoints]);

  useEffect(() => {
    completeRef.current = onCompleteChange;
  }, [onCompleteChange]);

  useEffect(
    () => () => {
      if (wordSuccessTimerRef.current !== null) {
        window.clearTimeout(wordSuccessTimerRef.current);
      }
    },
    []
  );

  const persistenceSignature = useMemo(
    () =>
      JSON.stringify({
        sentenceId: sentence.id,
        targets: allTargets.map((target) => ({
          id: target.id,
          start: target.start,
          end: target.end,
          wordClass: target.wordClass,
          isAnalysisTarget: target.isAnalysisTarget,
          grammaticalGender: target.grammaticalGender,
          grammaticalNumber: target.grammaticalNumber,
          wordClassInteractionMode: target.wordClassInteractionMode,
          triggerAfterRole: target.triggerAfterRole
        })),
        relations,
        selectedClasses
      }),
    [allTargets, relations, selectedClasses, sentence.id]
  );

  useEffect(() => {
    setHydrated(false);

    if (!persistenceKey || typeof window === "undefined") {
      setFoundIds([]);
      setClassPointIds([]);
      setResolvedRoleIds([]);
      setResolvedGenderIds([]);
      setResolvedNumberIds([]);
      setRolePointIds([]);
      setRoleTriggeredTargetIds([]);
      setSuspendedRelationTargetId(null);
      setRelationAnswers({});
      setDrawnAgreementArrows([]);
      setAgreementArrowsVisible(true);
      setAgreementInkColor(DEFAULT_AGREEMENT_INK_COLOR);
      setDraftAgreementPoints([]);
      draftAgreementPointsRef.current = [];
      setActiveRelationTargetId(null);
      setHydrated(true);
      return;
    }

    const raw = window.sessionStorage.getItem(persistenceKey);

    if (!raw) {
      setFoundIds([]);
      setClassPointIds([]);
      setResolvedRoleIds([]);
      setResolvedGenderIds([]);
      setResolvedNumberIds([]);
      setRolePointIds([]);
      setRoleTriggeredTargetIds([]);
      setSuspendedRelationTargetId(null);
      setRelationAnswers({});
      setDrawnAgreementArrows([]);
      setAgreementArrowsVisible(true);
      setAgreementInkColor(DEFAULT_AGREEMENT_INK_COLOR);
      setDraftAgreementPoints([]);
      draftAgreementPointsRef.current = [];
      setActiveRelationTargetId(null);
      setHydrated(true);
      return;
    }

    try {
      const saved = JSON.parse(raw) as {
        foundIds?: string[];
        classPointIds?: string[];
        resolvedRoleIds?: string[];
        resolvedGenderIds?: string[];
        resolvedNumberIds?: string[];
        rolePointIds?: string[];
        roleTriggeredTargetIds?: string[];
        relationAnswers?: Record<string, string[]>;
        activeRelationTargetId?: string | null;
        drawnAgreementArrows?: Array<
          Omit<DrawnAgreementArrow, "color"> & { color?: string }
        >;
        agreementInkColor?: string;
        agreementArrowsVisible?: boolean;
      };

      const restoredFoundIds = saved.foundIds ?? [];
      const restoredClassPointIds = saved.classPointIds ?? [];
      const restoredResolvedRoleIds = saved.resolvedRoleIds ?? [];
      const restoredResolvedGenderIds = saved.resolvedGenderIds ?? [];
      const restoredResolvedNumberIds = saved.resolvedNumberIds ?? [];
      const restoredRolePointIds = saved.rolePointIds ?? [];
      const restoredRoleTriggeredTargetIds = saved.roleTriggeredTargetIds ?? [];
      const restoredRelationAnswers = saved.relationAnswers ?? {};
      const restoredDrawnAgreementArrows = (
        saved.drawnAgreementArrows ?? []
      ).map((arrow) => ({
        ...arrow,
        color: arrow.color ?? DEFAULT_AGREEMENT_INK_COLOR
      }));

      setFoundIds(restoredFoundIds);
      setClassPointIds(restoredClassPointIds);
      setResolvedRoleIds(restoredResolvedRoleIds);
      setResolvedGenderIds(restoredResolvedGenderIds);
      setResolvedNumberIds(restoredResolvedNumberIds);
      setRolePointIds(restoredRolePointIds);
      setRoleTriggeredTargetIds(restoredRoleTriggeredTargetIds);
      setRelationAnswers(restoredRelationAnswers);
      setDrawnAgreementArrows(restoredDrawnAgreementArrows);
      setAgreementArrowsVisible(saved.agreementArrowsVisible ?? true);
      setAgreementInkColor(
        saved.agreementInkColor ?? DEFAULT_AGREEMENT_INK_COLOR
      );
      setDraftAgreementPoints([]);
      draftAgreementPointsRef.current = [];
      setActiveRelationTargetId(
        saved.activeRelationTargetId ?? null
      );
      setSuspendedRelationTargetId(null);

      const restoredPoints: RestoredPoint[] = [];

      analysisTargets.forEach((target) => {
        if (restoredFoundIds.includes(target.id)) {
          restoredPoints.push({
            target,
            stage: "find",
            points: 1,
            pointId: `find-${target.id}`
          });
        }

        if (
          usesClassChoice(target, multipleClasses, hasExplicitClassModes) &&
          restoredClassPointIds.includes(target.id)
        ) {
          restoredPoints.push({
            target,
            stage: "class",
            points: 1,
            pointId: `class-${target.id}`
          });
        }

        if (restoredRolePointIds.includes(target.id)) {
          restoredPoints.push({
            target,
            stage: "role",
            points: 1,
            pointId: `role-${target.id}`
          });
        }
      });

      relationTasks.forEach((task) => {
        (restoredRelationAnswers[task.targetId] ?? []).forEach(
          (answerId) => {
            const answerTarget = targetMap.get(answerId);
            if (!answerTarget) return;

            restoredPoints.push({
              target: answerTarget,
              stage: "agreement",
              points: 1,
              pointId: `agreement-${task.targetId}-${answerId}`
            });
          }
        );
      });

      restoreRef.current?.(restoredPoints);
    } catch {
      window.sessionStorage.removeItem(persistenceKey);
    } finally {
      setHydrated(true);
    }
  }, [
    analysisTargets,
    hasExplicitClassModes,
    multipleClasses,
    persistenceKey,
    persistenceSignature,
    relationTasks,
    sentence.id,
    targetMap
  ]);

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
        foundIds,
        classPointIds,
        resolvedRoleIds,
        resolvedGenderIds,
        resolvedNumberIds,
        rolePointIds,
        roleTriggeredTargetIds,
        relationAnswers,
        activeRelationTargetId,
        drawnAgreementArrows,
        agreementInkColor,
        agreementArrowsVisible
      })
    );
  }, [
    activeRelationTargetId,
    classPointIds,
    foundIds,
    hydrated,
    persistenceKey,
    relationAnswers,
    drawnAgreementArrows,
    agreementInkColor,
    agreementArrowsVisible,
    resolvedGenderIds,
    resolvedNumberIds,
    resolvedRoleIds,
    rolePointIds,
    roleTriggeredTargetIds
  ]);

  const currentTask = activeRelationTargetId
    ? taskMap.get(activeRelationTargetId)
    : undefined;

  const currentAnswers = currentTask
    ? relationAnswers[currentTask.targetId] ?? []
    : [];


  const agreementColorByTargetId = useMemo(() => {
    const colors = new Map<string, string>();

    drawnAgreementArrows.forEach((arrow) => {
      const task = taskMap.get(arrow.taskTargetId);
      const receiverId =
        task?.role === "donor"
          ? arrow.answerId
          : arrow.taskTargetId;

      colors.set(receiverId, arrow.color);
    });

    return colors;
  }, [drawnAgreementArrows, taskMap]);

  const currentTaskComplete = currentTask
    ? currentTask.expectedIds.every((id) =>
        currentAnswers.includes(id)
      )
    : true;

  useEffect(() => {
    if (!currentTask || !currentTaskComplete) return;

    const timer = window.setTimeout(() => {
      setActiveRelationTargetId(null);
      setMessage("");
    }, 900);

    return () => window.clearTimeout(timer);
  }, [currentTask, currentTaskComplete]);

  const agreementArrows = useMemo(
    () =>
      agreementArrowsVisible ? drawnAgreementArrows.flatMap((arrow) => {
        if (arrowCanvas.width <= 0 || arrowCanvas.height <= 0) {
          return [];
        }

        const rendered = buildAgreementArrow(
          arrow.id,
          arrow.points.map((point) => ({
            x: point.x * arrowCanvas.width,
            y: point.y * arrowCanvas.height
          })),
          arrow.color
        );

        return rendered ? [rendered] : [];
      }) : [],
    [agreementArrowsVisible, arrowCanvas.height, arrowCanvas.width, drawnAgreementArrows]
  );

  const draftAgreementArrow = useMemo(
    () =>
      buildAgreementArrow(
        "agreement-draft",
        draftAgreementPoints,
        agreementInkColor
      ),
    [agreementInkColor, draftAgreementPoints]
  );

  useLayoutEffect(() => {
    const container = textContainerRef.current;
    if (!container) return;

    let frameId = 0;

    function updateCanvas() {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const activeContainer = textContainerRef.current;
        if (!activeContainer) return;

        const width = Math.max(
          activeContainer.clientWidth,
          activeContainer.scrollWidth
        );
        const height = Math.max(
          activeContainer.clientHeight,
          activeContainer.scrollHeight
        );

        setArrowCanvas((current) =>
          current.width === width && current.height === height
            ? current
            : { width, height }
        );
      });
    }

    updateCanvas();
    window.addEventListener("resize", updateCanvas);
    const observer = new ResizeObserver(updateCanvas);
    observer.observe(container);
    document.fonts?.ready.then(updateCanvas);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updateCanvas);
      observer.disconnect();
    };
  }, []);


  const classesComplete =
    analysisTargets.length > 0 &&
    foundIds.length === analysisTargets.length;

  const rolesComplete = roleTasks.every((task) =>
    resolvedRoleIds.includes(task.targetId)
  );

  const relationsComplete = relationTasks.every((task) =>
    task.expectedIds.every((id) =>
      (relationAnswers[task.targetId] ?? []).includes(id)
    )
  );

  const genderNumberComplete = analysisTargets.every((target) =>
    (!target.grammaticalGender || resolvedGenderIds.includes(target.id)) &&
    (!target.grammaticalNumber || resolvedNumberIds.includes(target.id))
  );

  const complete =
    classesComplete && genderNumberComplete && rolesComplete && relationsComplete;

  useEffect(() => {
    completeRef.current?.(complete);
  }, [complete]);

  function showWordSuccess(ids: string[]) {
    if (wordSuccessTimerRef.current !== null) {
      window.clearTimeout(wordSuccessTimerRef.current);
    }

    setConfirmedWordIds(Array.from(new Set(ids)));
    wordSuccessTimerRef.current = window.setTimeout(() => {
      setConfirmedWordIds([]);
      wordSuccessTimerRef.current = null;
    }, 900);
  }

  function findTarget(token: WordToken) {
    const exact = targetByRange.get(
      `${token.start}-${token.end}`
    );
    if (exact) return exact;

    return allTargets.find(
      (target) =>
        (token.start <= target.start &&
          token.end >= target.end) ||
        (target.start <= token.start &&
          target.end >= token.end)
    );
  }

  function startRoleOrContinue(target: WordClassTarget) {
    const roleTask = roleTaskMap.get(target.id);

    if (roleTask && !resolvedRoleIds.includes(target.id)) {
      setRoleTargetId(target.id);
      setRoleFeedback("");
      return;
    }

    if (suspendedRelationTargetId) {
      setActiveRelationTargetId(suspendedRelationTargetId);
      setSuspendedRelationTargetId(null);
      return;
    }

    if (taskMap.has(target.id)) {
      setActiveRelationTargetId(target.id);
    }
  }

  function startTargetFollowup(target: WordClassTarget) {
    if (target.grammaticalGender && !resolvedGenderIds.includes(target.id)) {
      setGenderNumberTargetId(target.id);
      setGenderNumberStep("gender");
      setGenderNumberFeedback("");
      return;
    }

    if (target.grammaticalNumber && !resolvedNumberIds.includes(target.id)) {
      setGenderNumberTargetId(target.id);
      setGenderNumberStep("number");
      setGenderNumberFeedback("");
      return;
    }

    startRoleOrContinue(target);
  }

  function answerGenderNumber(answer: "feminine" | "masculine" | "singular" | "plural") {
    if (!genderNumberTargetId) return;
    const target = targetMap.get(genderNumberTargetId);
    if (!target) return;

    if (genderNumberStep === "gender") {
      const correct = answer === target.grammaticalGender;
      setResolvedGenderIds((current) => current.includes(target.id) ? current : [...current, target.id]);
      setGenderNumberFeedback(correct ? "Bonne réponse." : "Le genre attendu a été affiché. Le point est perdu.");
      window.setTimeout(() => {
        setGenderNumberStep("number");
        setGenderNumberFeedback("");
      }, 650);
      return;
    }

    const correct = answer === target.grammaticalNumber;
    setResolvedNumberIds((current) => current.includes(target.id) ? current : [...current, target.id]);
    setGenderNumberFeedback(correct ? "Bonne réponse." : "Le nombre attendu a été affiché. Le point est perdu.");
    window.setTimeout(() => {
      setGenderNumberTargetId(null);
      setGenderNumberFeedback("");
      startRoleOrContinue(target);
    }, 650);
  }

  function validateSingleClass(token: WordToken) {
    if (activeRelationTargetId || roleTargetId || genderNumberTargetId) return;

    const target = findTarget(token);

    if (target?.triggerAfterRole && !roleTriggeredTargetIds.includes(target.id)) {
      const roleTask = roleTaskMap.get(target.id);
      if (roleTask && roleTask.role === target.triggerAfterRole) {
        setRoleTargetId(target.id);
        setRoleFeedback("");
      } else {
        setMessage("Cette action se débloquera dès que ce mot aura été désigné dans l’accord.");
      }
      return;
    }

    if (!target || !analysisTargets.some((item) => item.id === target.id)) {
      setMessage(
        `« ${token.text} » ne fait pas partie des mots recherchés.`
      );
      return;
    }

    if (foundIds.includes(target.id)) return;

    setFoundIds((current) => [...current, target.id]);
    onPoint(target, "find", 1, `find-${target.id}`);
    setMessage("");
    showWordSuccess([target.id]);
    startTargetFollowup(target);
  }

  function openClassDialog(token: WordToken) {
    if (activeRelationTargetId || roleTargetId || genderNumberTargetId || !token.isWord) {
      return;
    }

    const target = findTarget(token);
    if (target?.triggerAfterRole && !roleTriggeredTargetIds.includes(target.id)) {
      const roleTask = roleTaskMap.get(target.id);
      if (roleTask && roleTask.role === target.triggerAfterRole) {
        setRoleTargetId(target.id);
        setRoleFeedback("");
      } else {
        setMessage("Cette action se débloquera dès que ce mot aura été désigné dans l’accord.");
      }
      return;
    }
    if (target && foundIds.includes(target.id)) return;

    setActiveToken(token);
    setSelectedClass("noun");
    setMessage("");
  }

  function validateMultipleClasses() {
    if (!activeToken) return;

    const target = findTarget(activeToken);

    if (
      !target ||
      !analysisTargets.some((item) => item.id === target.id) ||
      target.wordClass !== selectedClass
    ) {
      setMessage("Cette classe ne correspond pas à ce mot.");
      return;
    }

    if (!foundIds.includes(target.id)) {
      setFoundIds((current) => [...current, target.id]);
      onPoint(target, "find", 1, `find-${target.id}`);
    }

    if (usesClassChoice(target, multipleClasses, hasExplicitClassModes) && !classPointIds.includes(target.id)) {
      setClassPointIds((current) => [...current, target.id]);
      onPoint(target, "class", 1, `class-${target.id}`);
    }

    setActiveToken(null);
    setMessage("");
    showWordSuccess([target.id]);
    startTargetFollowup(target);
  }

  function answerRole(answer: TargetRole) {
    if (!roleTargetId) return;

    const task = roleTaskMap.get(roleTargetId);
    const target = targetMap.get(roleTargetId);
    if (!task || !target) return;

    const correct = answer === task.role;

    if (correct) {
      showWordSuccess([roleTargetId]);
    }

    if (correct && !rolePointIds.includes(roleTargetId)) {
      setRolePointIds((current) => [...current, roleTargetId]);
      onPoint(
        target,
        "role",
        1,
        `role-${roleTargetId}`
      );
    }

    setResolvedRoleIds((current) =>
      current.includes(roleTargetId)
        ? current
        : [...current, roleTargetId]
    );

    setRoleFeedback(
      correct
        ? "Bonne réponse."
        : `Ce mot est un ${
            task.role === "donor" ? "donneur" : "receveur"
          }. Le point est perdu.`
    );

    window.setTimeout(() => {
      setRoleTargetId(null);
      setRoleFeedback("");
      const triggeredTarget = target.triggerAfterRole === task.role;
      if (triggeredTarget && !foundIds.includes(target.id)) {
        setRoleTriggeredTargetIds((current) => current.includes(target.id) ? current : [...current, target.id]);
        const token = tokens.find((candidate) => candidate.isWord && candidate.start <= target.start && candidate.end >= target.end);
        if (usesClassChoice(target, multipleClasses, hasExplicitClassModes) && token) {
          setActiveToken(token);
          setSelectedClass("noun");
        } else {
          setMessage(`Clique maintenant sur « ${target.text} » pour confirmer sa classe.`);
        }
        return;
      }
      setActiveRelationTargetId(taskMap.has(task.targetId) ? task.targetId : null);
    }, 700);
  }

  function localDrawingPoint(
    clientX: number,
    clientY: number
  ): AgreementPoint | null {
    const container = textContainerRef.current;
    if (!container) return null;

    const rect = container.getBoundingClientRect();
    const width = Math.max(container.clientWidth, container.scrollWidth);
    const height = Math.max(container.clientHeight, container.scrollHeight);

    return {
      x: Math.min(
        width,
        Math.max(0, clientX - rect.left + container.scrollLeft)
      ),
      y: Math.min(
        height,
        Math.max(0, clientY - rect.top + container.scrollTop)
      )
    };
  }

  function targetIdNearPoint(clientX: number, clientY: number) {
    const container = textContainerRef.current;
    if (!container) return null;

    let closest: { id: string; distance: number } | null = null;

    container
      .querySelectorAll<HTMLElement>(
        ".word-class-reader-token[data-target-id]"
      )
      .forEach((element) => {
        const id = element.dataset.targetId;
        if (!id) return;

        const glyph =
          element.querySelector<HTMLElement>("[data-word-glyph]") ??
          element;
        const rect = glyph.getBoundingClientRect();
        const horizontalDistance =
          clientX < rect.left
            ? rect.left - clientX
            : clientX > rect.right
              ? clientX - rect.right
              : 0;
        const verticalDistance =
          clientY < rect.top
            ? rect.top - clientY
            : clientY > rect.bottom
              ? clientY - rect.bottom
              : 0;

        if (horizontalDistance > 28 || verticalDistance > 34) {
          return;
        }

        const distance = Math.hypot(
          horizontalDistance,
          verticalDistance
        );

        if (!closest || distance < closest.distance) {
          closest = { id, distance };
        }
      });

    return (closest as { id: string; distance: number } | null)?.id ?? null;
  }

  function clearDraftAgreementArrow() {
    activeDrawingPointerRef.current = null;
    drawingStartTargetIdRef.current = null;
    draftAgreementPointsRef.current = [];
    setDraftAgreementPoints([]);
  }

  function startAgreementDrawing(
    event: ReactPointerEvent<HTMLDivElement>
  ) {
    if (!currentTask || event.button !== 0) return;

    const point = localDrawingPoint(event.clientX, event.clientY);
    if (!point) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    activeDrawingPointerRef.current = event.pointerId;
    drawingStartTargetIdRef.current = targetIdNearPoint(
      event.clientX,
      event.clientY
    );
    draftAgreementPointsRef.current = [point];
    setDraftAgreementPoints([point]);
    setMessage("");
  }

  function continueAgreementDrawing(
    event: ReactPointerEvent<HTMLDivElement>
  ) {
    if (activeDrawingPointerRef.current !== event.pointerId) return;

    event.preventDefault();
    const point = localDrawingPoint(event.clientX, event.clientY);
    if (!point) return;

    const current = draftAgreementPointsRef.current;
    const previous = current[current.length - 1];

    if (
      previous &&
      Math.hypot(point.x - previous.x, point.y - previous.y) < 1.5
    ) {
      return;
    }

    const next = [...current, point];
    draftAgreementPointsRef.current = next;
    setDraftAgreementPoints(next);
  }

  function finishAgreementDrawing(
    event: ReactPointerEvent<HTMLDivElement>
  ) {
    if (
      !currentTask ||
      activeDrawingPointerRef.current !== event.pointerId
    ) {
      return;
    }

    event.preventDefault();

    const finalPoint = localDrawingPoint(
      event.clientX,
      event.clientY
    );
    const points = [...draftAgreementPointsRef.current];

    if (finalPoint) {
      const previous = points[points.length - 1];
      if (
        !previous ||
        Math.hypot(
          finalPoint.x - previous.x,
          finalPoint.y - previous.y
        ) >= 1
      ) {
        points.push(finalPoint);
      }
    }

    const startTargetId = drawingStartTargetIdRef.current;
    const endTargetId = targetIdNearPoint(
      event.clientX,
      event.clientY
    );
    const answerId =
      currentTask.role === "donor" ? endTargetId : startTargetId;
    const correctStartId =
      currentTask.role === "donor"
        ? currentTask.targetId
        : answerId;
    const correctEndId =
      currentTask.role === "donor"
        ? answerId
        : currentTask.targetId;
    const pathLength = points.slice(1).reduce(
      (total, point, index) =>
        total +
        Math.hypot(
          point.x - points[index].x,
          point.y - points[index].y
        ),
      0
    );
    const correct =
      Boolean(answerId) &&
      startTargetId === correctStartId &&
      endTargetId === correctEndId &&
      currentTask.expectedIds.includes(answerId ?? "") &&
      !currentAnswers.includes(answerId ?? "") &&
      pathLength >= 24;

    if (correct && answerId) {
      const container = textContainerRef.current;
      const target = targetMap.get(answerId);

      if (container && target) {
        const width = Math.max(
          1,
          container.clientWidth,
          container.scrollWidth
        );
        const height = Math.max(
          1,
          container.clientHeight,
          container.scrollHeight
        );
        const id = `${currentTask.targetId}-${answerId}`;

        setAgreementArrowsVisible(true);
        setDrawnAgreementArrows((current) => [
          ...current.filter((arrow) => arrow.id !== id),
          {
            id,
            taskTargetId: currentTask.targetId,
            answerId,
            color: agreementInkColor,
            points: points.map((point) => ({
              x: point.x / width,
              y: point.y / height
            }))
          }
        ]);
        setRelationAnswers((current) => ({
          ...current,
          [currentTask.targetId]: [
            ...(current[currentTask.targetId] ?? []),
            answerId
          ]
        }));
        onPoint(
          target,
          "agreement",
          1,
          `agreement-${currentTask.targetId}-${answerId}`
        );
        const receiverId =
          currentTask.role === "donor"
            ? answerId
            : currentTask.targetId;
        showWordSuccess([receiverId]);
        setMessage("");

        const triggeredRole = currentTask.role === "donor" ? "receiver" : "donor";
        const triggeredTarget = targetMap.get(answerId);
        if (
          triggeredTarget?.triggerAfterRole === triggeredRole &&
          !foundIds.includes(triggeredTarget.id)
        ) {
          setRoleTriggeredTargetIds((current) => current.includes(triggeredTarget.id) ? current : [...current, triggeredTarget.id]);
          setSuspendedRelationTargetId(currentTask.targetId);
          setActiveRelationTargetId(null);
          const token = tokens.find((candidate) => candidate.isWord && candidate.start <= triggeredTarget.start && candidate.end >= triggeredTarget.end);
          if (usesClassChoice(triggeredTarget, multipleClasses, hasExplicitClassModes) && token) {
            setActiveToken(token);
            setSelectedClass("noun");
          } else {
            setMessage(`Clique maintenant sur « ${triggeredTarget.text} » pour confirmer sa classe.`);
          }
        }
      }
    } else if (pathLength < 24) {
      setMessage("Trace une flèche complète d’un mot à l’autre.");
    } else {
      setMessage(
        currentTask.role === "donor"
          ? "Commence sur le donneur et termine sur un de ses receveurs."
          : "Commence sur le donneur et termine sur ce receveur."
      );
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    clearDraftAgreementArrow();
  }

  function cancelAgreementDrawing(
    event: ReactPointerEvent<HTMLDivElement>
  ) {
    if (activeDrawingPointerRef.current !== event.pointerId) return;
    clearDraftAgreementArrow();
  }

  function restart() {
    setFoundIds([]);
    setClassPointIds([]);
    setResolvedRoleIds([]);
    setRolePointIds([]);
    setRelationAnswers({});
    setDrawnAgreementArrows([]);
    setAgreementInkColor(DEFAULT_AGREEMENT_INK_COLOR);
    setConfirmedWordIds([]);
    setRoleTriggeredTargetIds([]);
    setSuspendedRelationTargetId(null);
    clearDraftAgreementArrow();
    setActiveToken(null);
    setRoleTargetId(null);
    setGenderNumberTargetId(null);
    setGenderNumberStep("gender");
    setGenderNumberFeedback("");
    setActiveRelationTargetId(null);
    setRoleFeedback("");
    setMessage("");

    if (persistenceKey && typeof window !== "undefined") {
      window.sessionStorage.removeItem(persistenceKey);
    }

    restoreRef.current?.([]);
  }

  function grammaticalDetails(target: WordClassTarget) {
    const values: string[] = [];
    if (resolvedGenderIds.includes(target.id) && target.grammaticalGender) {
      values.push(target.grammaticalGender === "feminine" ? "Fém." : "Masc.");
    }
    if (resolvedNumberIds.includes(target.id) && target.grammaticalNumber) {
      values.push(target.grammaticalNumber === "singular" ? "Sing." : "Plur.");
    }
    return values.join(", ");
  }

  const instruction = hasClassChoiceTargets && hasDirectFindTargets
    ? "Clique sur les mots demandés. Pour certains mots, tu choisiras ensuite leur classe."
    : hasClassChoiceTargets
      ? "Clique sur un mot, puis choisis sa classe."
      : selectedClasses.length === 1
      ? `Trouve tous les ${wordClassLabels[
          selectedClasses[0]
        ].toLocaleLowerCase("fr-CA")}s.`
      : "Trouve les mots appartenant aux classes demandées.";

  const currentFocusTarget = currentTask
    ? targetMap.get(currentTask.targetId)
    : undefined;

  const toolbarText = currentTask
    ? currentTask.role === "donor"
      ? `Trace une flèche de « ${currentFocusTarget?.text ?? ""} » vers chacun des ${currentTask.expectedIds.length} mot${currentTask.expectedIds.length > 1 ? "s" : ""} qui reçoivent son accord.`
      : `Trace une flèche du mot donneur vers « ${currentFocusTarget?.text ?? ""} ».`
    : complete
      ? "Toutes les réponses ont été trouvées."
      : instruction;

  return (
    <div className={`word-class-reader ${embedded ? "embedded" : ""}`}>
      <ReaderChromePortal slot="instruction">
        <div className="reader-chrome-instruction-copy"><strong>{toolbarText}</strong>{message && <span className="reader-chrome-feedback">{message}</span>}</div>
      </ReaderChromePortal>
      <ReaderChromePortal slot="progress">
        <div className="reader-chrome-progress">
          {currentTask ? (
            <strong>{currentAnswers.length}/{currentTask.expectedIds.length} {currentTask.role === "donor" ? "receveur" : "donneur"}{currentTask.expectedIds.length > 1 ? "s" : ""}</strong>
          ) : (
            <strong>{foundIds.length}/{analysisTargets.length} mot{analysisTargets.length > 1 ? "s" : ""}</strong>
          )}
          <span className="reader-chrome-progress-dots" aria-hidden="true">
            {Array.from({ length: Math.max(1, currentTask?.expectedIds.length ?? analysisTargets.length) }, (_, index) => (
              <i key={index} className={index < (currentTask ? currentAnswers.length : foundIds.length) ? "done" : ""} />
            ))}
          </span>
        </div>
      </ReaderChromePortal>
      <ReaderChromePortal slot="contextTools">
        {currentTask && (
          <div className="reader-context-tool-group">
            <span>Couleur</span>
            <div className="agreement-ink-palette" role="group" aria-label="Couleur de la prochaine flèche">
              {AGREEMENT_INK_COLORS.map((color) => (
                <button type="button" key={color.value} className={agreementInkColor === color.value ? "selected" : ""} style={{ "--agreement-ink-color": color.value } as CSSProperties} aria-label={color.label} aria-pressed={agreementInkColor === color.value} title={color.label} onClick={() => setAgreementInkColor(color.value)} />
              ))}
            </div>
          </div>
        )}
        {agreementArrowsVisible && drawnAgreementArrows.length > 0 && (
          <Button type="button" variant="secondary" className="agreement-clear-arrows" onClick={() => setAgreementArrowsVisible(false)}><Trash2 size={16} /> Supprimer les flèches</Button>
        )}
      </ReaderChromePortal>
      {complete && (
        <div className="word-class-complete-banner" role="status">
          <CheckCircle2 size={21} />
          <div>
            <strong>Toutes les réponses ont été trouvées.</strong>
            <span>Tu peux maintenant terminer l’activité.</span>
          </div>
        </div>
      )}

      <div
        ref={textContainerRef}
        className={`word-class-reader-text ${relationTasks.length > 0 ? "has-agreement-relations" : ""} ${currentTask ? "drawing-agreement" : ""}`}
        style={
          relationTasks.length > 0
            ? ({
                "--agreement-band-height": `${agreementBandHeight}px`
              } as CSSProperties)
            : undefined
        }
        onPointerDown={startAgreementDrawing}
        onPointerMove={continueAgreementDrawing}
        onPointerUp={finishAgreementDrawing}
        onPointerCancel={cancelAgreementDrawing}
        aria-live="polite"
      >
        {(agreementArrows.length > 0 || draftAgreementArrow) && (
          <svg
            className="agreement-arrow-layer"
            width={arrowCanvas.width}
            height={arrowCanvas.height}
            viewBox={`0 0 ${arrowCanvas.width} ${arrowCanvas.height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {agreementArrows.map((arrow) => (
              <g className="agreement-arrow-group" key={arrow.id}>
                <path
                  className="agreement-arrow-path frozen"
                  d={arrow.path}
                  style={{ stroke: arrow.color }}
                />
                <path
                  className="agreement-arrow-tip frozen"
                  d={arrow.tipPath}
                  style={{ stroke: arrow.color }}
                />
              </g>
            ))}

            {draftAgreementArrow && (
              <g className="agreement-arrow-group draft">
                <path
                  className="agreement-arrow-path draft"
                  d={draftAgreementArrow.path}
                  style={{ stroke: draftAgreementArrow.color }}
                />
                <path
                  className="agreement-arrow-tip draft"
                  d={draftAgreementArrow.tipPath}
                  style={{ stroke: draftAgreementArrow.color }}
                />
              </g>
            )}
          </svg>
        )}

        {tokens.map((token) => {
          if (!token.isWord) {
            return <span key={token.id}>{token.text}</span>;
          }

          const target = findTarget(token);
          const found = target
            ? foundIds.includes(target.id)
            : false;
          const relationSelected = target
            ? agreementColorByTargetId.has(target.id)
            : false;
          const agreementColor = target
            ? agreementColorByTargetId.get(target.id)
            : undefined;
          const answerConfirmed = target
            ? confirmedWordIds.includes(target.id)
            : false;
          const focus =
            currentTask &&
            target?.id === currentTask.targetId;
          const grammarDetails = target
            ? grammaticalDetails(target)
            : "";

          return (
            <button
              type="button"
              className={`word-class-reader-token ${
                found ? "found" : ""
              } ${relationSelected ? "agreement-colored" : ""} ${
                answerConfirmed ? "answer-confirmed" : ""
              } ${focus ? "agreement-focus" : ""} ${grammarDetails ? "has-grammar-details" : ""}`}
              key={token.id}
              style={
                agreementColor
                  ? ({
                      "--agreement-word-color": agreementColor
                    } as CSSProperties)
                  : undefined
              }
              data-word-token="true"
              data-target-id={target?.id}
              aria-pressed={found || relationSelected}
              onClick={() => {
                if (currentTask) return;

                const clickedTarget = findTarget(token);
                const shouldChooseClass = clickedTarget
                  ? usesClassChoice(
                      clickedTarget,
                      multipleClasses,
                      hasExplicitClassModes
                    )
                  : !hasExplicitClassModes && hasClassChoiceTargets;

                if (shouldChooseClass) {
                  openClassDialog(token);
                } else {
                  validateSingleClass(token);
                }
              }}
            >
              <span className="word-class-reader-word" data-word-glyph="true">
                {found && target && (
                <span
                  className={`word-class-reader-label ${grammarDetails ? "has-grammar-details" : ""}`}
                  data-target-label-id={target.id}
                >
                  <span className="word-class-reader-label-code">
                    {wordClassLabels[target.wordClass]}
                  </span>
                  {grammarDetails && (
                    <span className="word-class-reader-label-grammar">
                      ({grammarDetails})
                    </span>
                  )}
                </span>
              )}
              {token.text}
                {relationSelected && (
                  <span
                    className="agreement-found-indicator"
                    aria-label="Bonne réponse"
                  >
                    <Check size={13} />
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {message && (
        <p className="word-class-reader-message">{message}</p>
      )}

      {(!embedded || (complete && finishControl)) && (
        <ReaderChromePortal slot="actions">
          {!embedded && <Button type="button" variant="secondary" onClick={restart}><RotateCcw size={18} /> Recommencer</Button>}
          {!embedded || complete ? finishControl : null}
        </ReaderChromePortal>
      )}

      {activeToken && (
        <div className="reader-dialog-backdrop">
          <div
            className="reader-dialog word-class-dialog"
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              className="reader-close"
              onClick={() => setActiveToken(null)}
              aria-label="Fermer"
            >
              <X size={20} />
            </button>

            <span className="eyebrow">Classe du mot</span>
            <h2>« {activeToken.text} »</h2>

            <label>
              Choisis la classe
              <select
                value={selectedClass}
                onChange={(event) =>
                  setSelectedClass(event.target.value as WordClass)
                }
              >
                {((findTarget(activeToken)?.wordClassInteractionMode === "choose_class" ? ALL_WORD_CLASSES : selectedClasses)).map((wordClass) => (
                  <option value={wordClass} key={wordClass}>
                    {wordClassLabels[wordClass]}
                  </option>
                ))}
              </select>
            </label>

            {message && (
              <p className="word-class-reader-message">{message}</p>
            )}

            <div className="reader-dialog-actions">
              <Button type="button" onClick={validateMultipleClasses}>
                <Check size={18} />
                Valider
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setActiveToken(null)}
              >
                Annuler
              </Button>
            </div>
          </div>
        </div>
      )}

      {genderNumberTargetId && (
        <div className="reader-dialog-backdrop">
          <div className="reader-dialog word-role-dialog" role="dialog" aria-modal="true">
            <span className="eyebrow">{genderNumberStep === "gender" ? "Genre" : "Nombre"}</span>
            <h2>« {targetMap.get(genderNumberTargetId)?.text ?? ""} »</h2>
            <p>{genderNumberStep === "gender" ? "Quel est le genre de ce mot?" : "Quel est le nombre de ce mot?"}</p>
            {!genderNumberFeedback ? (
              <div className="word-role-options">
                {genderNumberStep === "gender" ? <>
                  <Button type="button" onClick={() => answerGenderNumber("feminine")}>Féminin</Button>
                  <Button type="button" variant="secondary" onClick={() => answerGenderNumber("masculine")}>Masculin</Button>
                </> : <>
                  <Button type="button" onClick={() => answerGenderNumber("singular")}>Singulier</Button>
                  <Button type="button" variant="secondary" onClick={() => answerGenderNumber("plural")}>Pluriel</Button>
                </>}
              </div>
            ) : <p className={"word-role-feedback " + (genderNumberFeedback === "Bonne réponse." ? "correct" : "incorrect")}>{genderNumberFeedback}</p>}
          </div>
        </div>
      )}

      {roleTargetId && (
        <div className="reader-dialog-backdrop">
          <div
            className="reader-dialog word-role-dialog"
            role="dialog"
            aria-modal="true"
          >
            <span className="word-role-congratulations">
              Bravo! Tu as trouvé un mot de la classe «{" "}
              {wordClassLabels[
                targetMap.get(roleTargetId)?.wordClass ?? "noun"
              ].toLocaleLowerCase("fr-CA")} ».
            </span>
            <h2>
              « {targetMap.get(roleTargetId)?.text ?? ""} » est-il…
            </h2>

            {!roleFeedback ? (
              <div className="word-role-options">
                <Button
                  type="button"
                  onClick={() => answerRole("donor")}
                >
                  Donneur
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => answerRole("receiver")}
                >
                  Receveur
                </Button>
              </div>
            ) : (
              <p
                className={`word-role-feedback ${
                  roleFeedback === "Bonne réponse."
                    ? "correct"
                    : "incorrect"
                }`}
              >
                {roleFeedback}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
