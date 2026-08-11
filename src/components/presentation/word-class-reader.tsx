"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCircle2, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { wordClassLabels } from "@/lib/activity-types";
import { buildRelationTasks } from "@/lib/word-class-relations";
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

type AgreementArrow = {
  id: string;
  path: string;
  tipPath: string;
};

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

  const relations = useMemo(
    () => sentence.agreementRelations ?? [],
    [sentence.agreementRelations]
  );
  const relationTasks = useMemo(
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

  const [foundIds, setFoundIds] = useState<string[]>([]);
  const [classPointIds, setClassPointIds] = useState<string[]>([]);
  const [resolvedRoleIds, setResolvedRoleIds] = useState<string[]>([]);
  const [rolePointIds, setRolePointIds] = useState<string[]>([]);
  const [relationAnswers, setRelationAnswers] = useState<
    Record<string, string[]>
  >({});
  const [activeToken, setActiveToken] = useState<WordToken | null>(null);
  const [selectedClass, setSelectedClass] = useState<WordClass>(
    selectedClasses[0] ?? "noun"
  );
  const [roleTargetId, setRoleTargetId] = useState<string | null>(null);
  const [activeRelationTargetId, setActiveRelationTargetId] =
    useState<string | null>(null);
  const [roleFeedback, setRoleFeedback] = useState("");
  const [message, setMessage] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [agreementArrows, setAgreementArrows] = useState<
    AgreementArrow[]
  >([]);
  const [arrowCanvas, setArrowCanvas] = useState({
    width: 0,
    height: 0
  });

  const textContainerRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef(onRestorePoints);
  const completeRef = useRef(onCompleteChange);

  useEffect(() => {
    restoreRef.current = onRestorePoints;
  }, [onRestorePoints]);

  useEffect(() => {
    completeRef.current = onCompleteChange;
  }, [onCompleteChange]);

  const persistenceSignature = useMemo(
    () =>
      JSON.stringify({
        sentenceId: sentence.id,
        targets: allTargets.map((target) => ({
          id: target.id,
          start: target.start,
          end: target.end,
          wordClass: target.wordClass,
          isAnalysisTarget: target.isAnalysisTarget
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
      setRolePointIds([]);
      setRelationAnswers({});
      setActiveRelationTargetId(null);
      setHydrated(true);
      return;
    }

    const raw = window.sessionStorage.getItem(persistenceKey);

    if (!raw) {
      setFoundIds([]);
      setClassPointIds([]);
      setResolvedRoleIds([]);
      setRolePointIds([]);
      setRelationAnswers({});
      setActiveRelationTargetId(null);
      setHydrated(true);
      return;
    }

    try {
      const saved = JSON.parse(raw) as {
        foundIds?: string[];
        classPointIds?: string[];
        resolvedRoleIds?: string[];
        rolePointIds?: string[];
        relationAnswers?: Record<string, string[]>;
        activeRelationTargetId?: string | null;
      };

      const restoredFoundIds = saved.foundIds ?? [];
      const restoredClassPointIds = saved.classPointIds ?? [];
      const restoredResolvedRoleIds = saved.resolvedRoleIds ?? [];
      const restoredRolePointIds = saved.rolePointIds ?? [];
      const restoredRelationAnswers = saved.relationAnswers ?? {};

      setFoundIds(restoredFoundIds);
      setClassPointIds(restoredClassPointIds);
      setResolvedRoleIds(restoredResolvedRoleIds);
      setRolePointIds(restoredRolePointIds);
      setRelationAnswers(restoredRelationAnswers);
      setActiveRelationTargetId(
        saved.activeRelationTargetId ?? null
      );

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
          multipleClasses &&
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
        rolePointIds,
        relationAnswers,
        activeRelationTargetId
      })
    );
  }, [
    activeRelationTargetId,
    classPointIds,
    foundIds,
    hydrated,
    persistenceKey,
    relationAnswers,
    resolvedRoleIds,
    rolePointIds
  ]);

  const currentTask = activeRelationTargetId
    ? taskMap.get(activeRelationTargetId)
    : undefined;

  const currentAnswers = currentTask
    ? relationAnswers[currentTask.targetId] ?? []
    : [];


  const persistentAgreementAnswerIds = useMemo(
    () =>
      new Set(
        Object.values(relationAnswers).flat()
      ),
    [relationAnswers]
  );

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

  useLayoutEffect(() => {
    const container = textContainerRef.current;
    const answeredLinks = relationTasks.flatMap((task) =>
      (relationAnswers[task.targetId] ?? []).map((answerId) => ({ task, answerId }))
    );

    if (!container || answeredLinks.length === 0) {
      setAgreementArrows((current) => current.length === 0 ? current : []);
      setArrowCanvas((current) =>
        current.width === 0 && current.height === 0 ? current : { width: 0, height: 0 }
      );
      return;
    }

    let frameId = 0;

    function updateArrows() {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const activeContainer = textContainerRef.current;
        if (!activeContainer) return;
        const containerRect = activeContainer.getBoundingClientRect();
        const canvasWidth = Math.max(activeContainer.clientWidth, activeContainer.scrollWidth);
        const canvasHeight = Math.max(activeContainer.clientHeight, activeContainer.scrollHeight);
        setArrowCanvas((current) =>
          current.width === canvasWidth && current.height === canvasHeight
            ? current
            : { width: canvasWidth, height: canvasHeight }
        );

        function localRect(rect: DOMRect) {
          return {
            left: rect.left - containerRect.left,
            right: rect.right - containerRect.left,
            top: rect.top - containerRect.top,
            bottom: rect.bottom - containerRect.top,
            width: rect.width,
            height: rect.height,
            centerX: rect.left - containerRect.left + rect.width / 2,
            centerY: rect.top - containerRect.top + rect.height / 2
          };
        }

        function glyphRect(element: HTMLElement) {
          const textNode = Array.from(element.childNodes).find(
            (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
          );
          if (!textNode) return localRect(element.getBoundingClientRect());
          const range = document.createRange();
          range.selectNodeContents(textNode);
          const rect = range.getBoundingClientRect();
          range.detach();
          return localRect(rect.width > 0 ? rect : element.getBoundingClientRect());
        }

        const tokenRects = new Map<string, ReturnType<typeof localRect>>();
        activeContainer
          .querySelectorAll<HTMLElement>('.word-class-reader-token[data-target-id]')
          .forEach((element) => {
            const id = element.dataset.targetId;
            if (id) tokenRects.set(id, glyphRect(element));
          });
        const labelRects = new Map<string, ReturnType<typeof localRect>>();
        activeContainer
          .querySelectorAll<HTMLElement>('[data-target-label-id]')
          .forEach((element) => {
            const id = element.dataset.targetLabelId;
            if (id) labelRects.set(id, localRect(element.getBoundingClientRect()));
          });

        const lineBands: Array<{ top: number; bottom: number; centerY: number }> = [];
        Array.from(tokenRects.values())
          .sort((a, b) => a.centerY - b.centerY)
          .forEach((rect) => {
            const line = lineBands.find((candidate) =>
              Math.abs(candidate.centerY - rect.centerY) < Math.max(8, rect.height * .7)
            );
            if (line) {
              line.top = Math.min(line.top, rect.top);
              line.bottom = Math.max(line.bottom, rect.bottom);
              line.centerY = (line.top + line.bottom) / 2;
            } else {
              lineBands.push({ top: rect.top, bottom: rect.bottom, centerY: rect.centerY });
            }
          });
        lineBands.sort((a, b) => a.top - b.top);

        function lineIndex(rect: ReturnType<typeof localRect>) {
          return Math.max(0, lineBands.findIndex((line) =>
            rect.centerY >= line.top - 4 && rect.centerY <= line.bottom + 4
          ));
        }

        const resolvedLinks = answeredLinks.flatMap(({ task, answerId }) => {
          const donorId = task.role === "donor" ? task.targetId : answerId;
          const receiverId = task.role === "donor" ? answerId : task.targetId;
          const donor = tokenRects.get(donorId);
          const receiver = tokenRects.get(receiverId);
          return donor && receiver ? [{ task, answerId, donorId, receiverId, donor, receiver }] : [];
        });
        const nextArrows = resolvedLinks.map((link, linkIndex) => {
          const { task, answerId, donorId, donor, receiver } = link;
          const donorLine = lineIndex(donor);
          const receiverLine = lineIndex(receiver);
          const siblings = resolvedLinks
            .filter((candidate) =>
              candidate.donorId === donorId &&
              lineIndex(candidate.donor) === donorLine &&
              lineIndex(candidate.receiver) === receiverLine
            )
            .sort((a, b) =>
              Math.abs(a.receiver.centerX - a.donor.centerX) -
              Math.abs(b.receiver.centerX - b.donor.centerX)
            );
          const laneRank = Math.max(0, siblings.findIndex((candidate) => candidate.answerId === answerId));
          const startSpread = (laneRank - (siblings.length - 1) / 2) * 8;
          const donorAnchor = labelRects.get(donorId) ?? donor;
          const receiverAnchor = labelRects.get(link.receiverId) ?? receiver;
          const startX = donorAnchor.centerX + startSpread;
          const startY = donorAnchor.top - 3;
          const endX = receiverAnchor.centerX;
          const endY = receiverAnchor.top - 3;
          const laneOffset = 18 + laneRank * 15;
          let path: string;
          let finalControl = { x: endX, y: endY - 18 };

          if (donorLine === receiverLine) {
            const laneY = Math.max(
              10,
              Math.min(donorAnchor.top, receiverAnchor.top) - laneOffset
            );
            const approachDirection = endX < startX ? 1 : -1;
            finalControl = {
              x: endX + approachDirection * Math.min(28, Math.max(18, Math.abs(endX - startX) * .08)),
              y: laneY
            };
            path = `M ${startX} ${startY} C ${startX} ${laneY}, ${finalControl.x} ${laneY}, ${endX} ${endY}`;
          } else {
            const railLane = linkIndex % 3;
            const leftRail = 18 + railLane * 9;
            const rightRail = canvasWidth - 18 - railLane * 9;
            const railX =
              Math.abs(startX - leftRail) + Math.abs(endX - leftRail) <=
              Math.abs(startX - rightRail) + Math.abs(endX - rightRail)
                ? leftRail
                : rightRail;
            const startLaneY = Math.max(10, donorAnchor.top - laneOffset);
            const endLaneY = Math.max(10, receiverAnchor.top - laneOffset);
            const approachDirection = railX < endX ? -1 : 1;
            finalControl = { x: endX + approachDirection * 22, y: endLaneY };
            path = [
              `M ${startX} ${startY}`,
              `C ${startX} ${startLaneY}, ${railX} ${startLaneY}, ${railX} ${startLaneY}`,
              `C ${railX} ${(startLaneY + endLaneY) / 2}, ${railX} ${endLaneY}, ${railX} ${endLaneY}`,
              `C ${finalControl.x} ${endLaneY}, ${finalControl.x} ${endLaneY}, ${endX} ${endY}`
            ].join(" ");
          }

          const tangentX = endX - finalControl.x;
          const tangentY = endY - finalControl.y;
          const tangentLength = Math.max(1, Math.hypot(tangentX, tangentY));
          const unitX = tangentX / tangentLength;
          const unitY = tangentY / tangentLength;
          const baseX = endX - unitX * 10;
          const baseY = endY - unitY * 10;
          const perpendicularX = -unitY * 4.5;
          const perpendicularY = unitX * 4.5;
          return {
            id: `${task.targetId}-${answerId}`,
            path,
            tipPath: `M ${baseX + perpendicularX} ${baseY + perpendicularY} L ${endX} ${endY} L ${baseX - perpendicularX} ${baseY - perpendicularY}`
          };
        });

        setAgreementArrows((current) => {
          const unchanged = current.length === nextArrows.length && current.every((arrow, index) => {
            const next = nextArrows[index];
            return next && arrow.id === next.id && arrow.path === next.path && arrow.tipPath === next.tipPath;
          });
          return unchanged ? current : nextArrows;
        });
      });
    }

    updateArrows();
    window.addEventListener("resize", updateArrows);
    const observer = new ResizeObserver(updateArrows);
    observer.observe(container);
    document.fonts?.ready.then(updateArrows);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updateArrows);
      observer.disconnect();
    };
  }, [relationAnswers, relationTasks]);

  const classesComplete =
    analysisTargets.length > 0 &&
    foundIds.length === analysisTargets.length;

  const rolesComplete = relationTasks.every((task) =>
    resolvedRoleIds.includes(task.targetId)
  );

  const relationsComplete = relationTasks.every((task) =>
    task.expectedIds.every((id) =>
      (relationAnswers[task.targetId] ?? []).includes(id)
    )
  );

  const complete =
    classesComplete && rolesComplete && relationsComplete;

  useEffect(() => {
    completeRef.current?.(complete);
  }, [complete]);

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
    const task = taskMap.get(target.id);

    if (!task) return;

    setRoleTargetId(target.id);
    setRoleFeedback("");
  }

  function validateSingleClass(token: WordToken) {
    if (activeRelationTargetId || roleTargetId) return;

    const target = findTarget(token);

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
    startRoleOrContinue(target);
  }

  function openClassDialog(token: WordToken) {
    if (activeRelationTargetId || roleTargetId || !token.isWord) {
      return;
    }

    const target = findTarget(token);
    if (target && foundIds.includes(target.id)) return;

    setActiveToken(token);
    setSelectedClass(selectedClasses[0] ?? "noun");
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

    if (!classPointIds.includes(target.id)) {
      setClassPointIds((current) => [...current, target.id]);
      onPoint(target, "class", 1, `class-${target.id}`);
    }

    setActiveToken(null);
    setMessage("");
    startRoleOrContinue(target);
  }

  function answerRole(answer: TargetRole) {
    if (!roleTargetId) return;

    const task = taskMap.get(roleTargetId);
    const target = targetMap.get(roleTargetId);
    if (!task || !target) return;

    const correct = answer === task.role;

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
      setActiveRelationTargetId(task.targetId);
    }, 700);
  }

  function validateRelationClick(token: WordToken) {
    if (!currentTask) return;

    const target = findTarget(token);

    if (!target || !currentTask.expectedIds.includes(target.id)) {
      setMessage(
        currentTask.role === "donor"
          ? "Ce mot ne reçoit pas l’accord du donneur."
          : "Ce mot ne donne pas son accord au receveur."
      );
      return;
    }

    if (currentAnswers.includes(target.id)) return;

    setRelationAnswers((current) => ({
      ...current,
      [currentTask.targetId]: [
        ...(current[currentTask.targetId] ?? []),
        target.id
      ]
    }));

    onPoint(
      target,
      "agreement",
      1,
      `agreement-${currentTask.targetId}-${target.id}`
    );
    setMessage("");
  }

  function restart() {
    setFoundIds([]);
    setClassPointIds([]);
    setResolvedRoleIds([]);
    setRolePointIds([]);
    setRelationAnswers({});
    setActiveToken(null);
    setRoleTargetId(null);
    setActiveRelationTargetId(null);
    setRoleFeedback("");
    setMessage("");

    if (persistenceKey && typeof window !== "undefined") {
      window.sessionStorage.removeItem(persistenceKey);
    }

    restoreRef.current?.([]);
  }

  const instruction =
    selectedClasses.length === 1
      ? `Trouve tous les ${wordClassLabels[
          selectedClasses[0]
        ].toLocaleLowerCase("fr-CA")}s.`
      : "Trouve les mots appartenant aux classes demandées.";

  const currentFocusTarget = currentTask
    ? targetMap.get(currentTask.targetId)
    : undefined;

  const toolbarText = currentTask
    ? currentTask.role === "donor"
      ? `Clique sur les ${currentTask.expectedIds.length} mot${
          currentTask.expectedIds.length > 1 ? "s" : ""
        } qui reçoivent l’accord de « ${
          currentFocusTarget?.text ?? ""
        } ».`
      : `Clique sur le mot qui donne son accord à « ${
          currentFocusTarget?.text ?? ""
        } ».`
    : complete
      ? "Toutes les réponses ont été trouvées."
      : instruction;

  return (
    <div className={`word-class-reader ${embedded ? "embedded" : ""}`}>
      <div className="word-class-reader-toolbar">
        <div className="word-class-reader-instruction-group">
          <strong>{toolbarText}</strong>

          {currentTask ? (
            <span
              className={`word-class-reader-counter ${
                currentAnswers.length ===
                currentTask.expectedIds.length
                  ? "complete"
                  : ""
              }`}
            >
              {currentAnswers.length}/{currentTask.expectedIds.length}{" "}
              {currentTask.role === "donor"
                ? "receveur"
                : "donneur"}
              {currentTask.expectedIds.length > 1 ? "s" : ""}
            </span>
          ) : (
            <span
              className={`word-class-reader-counter ${
                foundIds.length === analysisTargets.length
                  ? "complete"
                  : ""
              }`}
            >
              {foundIds.length}/{analysisTargets.length} mot
              {analysisTargets.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

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
        className={`word-class-reader-text ${sentence.agreementRelationsEnabled ? "has-agreement-relations" : ""}`}
        aria-live="polite"
      >
        {agreementArrows.length > 0 && (
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
                  className="agreement-arrow-path"
                  d={arrow.path}
                  pathLength={1}
                />
                <path
                  className="agreement-arrow-tip"
                  d={arrow.tipPath}
                />
              </g>
            ))}
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
            ? persistentAgreementAnswerIds.has(target.id)
            : false;
          const focus =
            currentTask &&
            target?.id === currentTask.targetId;

          return (
            <button
              type="button"
              className={`word-class-reader-token ${
                found ? "found" : ""
              } ${relationSelected ? "agreement-selected" : ""} ${
                focus ? "agreement-focus" : ""
              }`}
              key={token.id}
              data-word-token="true"
              data-target-id={target?.id}
              aria-pressed={found || relationSelected}
              onClick={() => {
                if (currentTask) {
                  validateRelationClick(token);
                  return;
                }

                if (multipleClasses) {
                  openClassDialog(token);
                } else {
                  validateSingleClass(token);
                }
              }}
            >
              {found && target && (
                <span
                  className="word-class-reader-label"
                  data-target-label-id={target.id}
                >
                  {wordClassLabels[target.wordClass]}
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
            </button>
          );
        })}
      </div>

      {message && (
        <p className="word-class-reader-message">{message}</p>
      )}

      {(!embedded || (complete && finishControl)) && (
        <div className="interactive-reader-actions">
          {!embedded && (
            <Button
              type="button"
              variant="secondary"
              onClick={restart}
            >
              <RotateCcw size={18} />
              Recommencer
            </Button>
          )}

          {!embedded || complete ? finishControl : null}
        </div>
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
                {selectedClasses.map((wordClass) => (
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
