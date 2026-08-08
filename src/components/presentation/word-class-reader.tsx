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
  finishControl
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
      (relationAnswers[task.targetId] ?? []).map((answerId) => ({
        task,
        answerId
      }))
    );

    if (!container || answeredLinks.length === 0) {
      setAgreementArrows((current) =>
        current.length === 0 ? current : []
      );
      setArrowCanvas((current) =>
        current.width === 0 && current.height === 0
          ? current
          : { width: 0, height: 0 }
      );
      return;
    }

    const activeContainer = container;

    let frameId = 0;

    function updateArrows() {
      window.cancelAnimationFrame(frameId);

      frameId = window.requestAnimationFrame(() => {
        const containerRect = activeContainer.getBoundingClientRect();
        const canvasWidth = Math.max(
          activeContainer.clientWidth,
          activeContainer.scrollWidth
        );
        const canvasHeight = Math.max(
          activeContainer.clientHeight,
          activeContainer.scrollHeight
        );

        setArrowCanvas((current) =>
          current.width === canvasWidth &&
          current.height === canvasHeight
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
            centerX:
              rect.left -
              containerRect.left +
              rect.width / 2,
            centerY:
              rect.top -
              containerRect.top +
              rect.height / 2
          };
        }

        const visibleWords = Array.from(
          activeContainer.querySelectorAll<HTMLElement>(
            '.word-class-reader-token[data-word-token="true"]'
          )
        ).map((element) => ({
          element,
          rect: localRect(element.getBoundingClientRect())
        }));

        const lines: Array<{
          left: number;
          right: number;
          top: number;
          bottom: number;
          centerY: number;
        }> = [];

        visibleWords
          .sort((a, b) => a.rect.centerY - b.rect.centerY)
          .forEach(({ rect }) => {
            const line = lines.find(
              (item) =>
                Math.abs(item.centerY - rect.centerY) <
                Math.max(10, rect.height * 0.35)
            );

            if (line) {
              line.left = Math.min(line.left, rect.left);
              line.right = Math.max(line.right, rect.right);
              line.top = Math.min(line.top, rect.top);
              line.bottom = Math.max(line.bottom, rect.bottom);
              line.centerY = (line.top + line.bottom) / 2;
            } else {
              lines.push({
                left: rect.left,
                right: rect.right,
                top: rect.top,
                bottom: rect.bottom,
                centerY: rect.centerY
              });
            }
          });

        lines.sort((a, b) => a.top - b.top);

        const obstaclePaddingX = 10;
        const obstaclePaddingY = 8;
        const obstacles = lines.map((line) => ({
          left: Math.max(0, line.left - obstaclePaddingX),
          right: Math.min(
            canvasWidth,
            line.right + obstaclePaddingX
          ),
          top: Math.max(0, line.top - obstaclePaddingY),
          bottom: Math.min(
            canvasHeight,
            line.bottom + obstaclePaddingY
          )
        }));

        const cellSize = 10;
        const cols = Math.max(
          2,
          Math.ceil(canvasWidth / cellSize)
        );
        const rows = Math.max(
          2,
          Math.ceil(canvasHeight / cellSize)
        );

        function toCell(x: number, y: number) {
          return {
            col: Math.max(
              0,
              Math.min(cols - 1, Math.round(x / cellSize))
            ),
            row: Math.max(
              0,
              Math.min(rows - 1, Math.round(y / cellSize))
            )
          };
        }

        function toPoint(col: number, row: number) {
          return {
            x: Math.min(
              canvasWidth - 1,
              col * cellSize
            ),
            y: Math.min(
              canvasHeight - 1,
              row * cellSize
            )
          };
        }

        function isBlocked(
          col: number,
          row: number,
          allowedCells: Set<string>
        ) {
          const key = `${col}:${row}`;
          if (allowedCells.has(key)) return false;

          const point = toPoint(col, row);

          return obstacles.some(
            (obstacle) =>
              point.x >= obstacle.left &&
              point.x <= obstacle.right &&
              point.y >= obstacle.top &&
              point.y <= obstacle.bottom
          );
        }

        function nearestFreeCell(
          initial: { col: number; row: number },
          allowedCells: Set<string>
        ) {
          if (
            !isBlocked(
              initial.col,
              initial.row,
              allowedCells
            )
          ) {
            return initial;
          }

          for (let radius = 1; radius <= 8; radius += 1) {
            for (
              let deltaRow = -radius;
              deltaRow <= radius;
              deltaRow += 1
            ) {
              for (
                let deltaCol = -radius;
                deltaCol <= radius;
                deltaCol += 1
              ) {
                if (
                  Math.abs(deltaCol) !== radius &&
                  Math.abs(deltaRow) !== radius
                ) {
                  continue;
                }

                const col = initial.col + deltaCol;
                const row = initial.row + deltaRow;

                if (
                  col < 0 ||
                  row < 0 ||
                  col >= cols ||
                  row >= rows
                ) {
                  continue;
                }

                if (!isBlocked(col, row, allowedCells)) {
                  return { col, row };
                }
              }
            }
          }

          return initial;
        }

        function findPath(
          startCell: { col: number; row: number },
          endCell: { col: number; row: number },
          allowedCells: Set<string>
        ) {
          const start = nearestFreeCell(
            startCell,
            allowedCells
          );
          const end = nearestFreeCell(
            endCell,
            allowedCells
          );
          const startKey = `${start.col}:${start.row}`;
          const endKey = `${end.col}:${end.row}`;
          const open = new Map<
            string,
            {
              col: number;
              row: number;
              g: number;
              f: number;
            }
          >();
          const cameFrom = new Map<string, string>();
          const gScore = new Map<string, number>();

          function heuristic(
            col: number,
            row: number
          ) {
            return (
              Math.abs(col - end.col) +
              Math.abs(row - end.row)
            );
          }

          open.set(startKey, {
            ...start,
            g: 0,
            f: heuristic(start.col, start.row)
          });
          gScore.set(startKey, 0);

          const directions = [
            { col: 1, row: 0 },
            { col: -1, row: 0 },
            { col: 0, row: 1 },
            { col: 0, row: -1 }
          ];

          while (open.size > 0) {
            let currentKey = "";
            let current:
              | {
                  col: number;
                  row: number;
                  g: number;
                  f: number;
                }
              | undefined;

            open.forEach((candidate, key) => {
              if (!current || candidate.f < current.f) {
                current = candidate;
                currentKey = key;
              }
            });

            if (!current) break;

            if (currentKey === endKey) {
              const cells = [currentKey];
              let cursor = currentKey;

              while (cameFrom.has(cursor)) {
                cursor = cameFrom.get(cursor) as string;
                cells.push(cursor);
              }

              cells.reverse();

              return cells.map((key) => {
                const [col, row] = key
                  .split(":")
                  .map(Number);
                return toPoint(col, row);
              });
            }

            open.delete(currentKey);

            directions.forEach((direction) => {
              const col = current!.col + direction.col;
              const row = current!.row + direction.row;

              if (
                col < 0 ||
                row < 0 ||
                col >= cols ||
                row >= rows ||
                isBlocked(col, row, allowedCells)
              ) {
                return;
              }

              const neighborKey = `${col}:${row}`;
              const tentativeG = current!.g + 1;

              if (
                tentativeG >=
                (gScore.get(neighborKey) ??
                  Number.POSITIVE_INFINITY)
              ) {
                return;
              }

              cameFrom.set(neighborKey, currentKey);
              gScore.set(neighborKey, tentativeG);

              const bendPenalty = cameFrom.has(currentKey)
                ?
                (() => {
                  const previousKey =
                    cameFrom.get(currentKey);
                  if (!previousKey) return 0;

                  const [previousCol, previousRow] =
                    previousKey.split(":").map(Number);
                  const previousDirection = {
                    col: current!.col - previousCol,
                    row: current!.row - previousRow
                  };

                  return (
                    previousDirection.col !==
                      direction.col ||
                    previousDirection.row !==
                      direction.row
                  )
                    ? 0.35
                    : 0;
                })()
                : 0;

              open.set(neighborKey, {
                col,
                row,
                g: tentativeG,
                f:
                  tentativeG +
                  heuristic(col, row) +
                  bendPenalty
              });
            });
          }

          return [];
        }

        function simplifyPath(
          points: Array<{ x: number; y: number }>
        ) {
          if (points.length <= 2) return points;

          const simplified = [points[0]];

          for (
            let index = 1;
            index < points.length - 1;
            index += 1
          ) {
            const previous =
              simplified[simplified.length - 1];
            const current = points[index];
            const next = points[index + 1];

            const sameHorizontal =
              previous.y === current.y &&
              current.y === next.y;
            const sameVertical =
              previous.x === current.x &&
              current.x === next.x;

            if (!sameHorizontal && !sameVertical) {
              simplified.push(current);
            }
          }

          simplified.push(points[points.length - 1]);
          return simplified;
        }

        function roundedPath(
          points: Array<{ x: number; y: number }>,
          radius = 7
        ) {
          if (points.length < 2) return "";

          let path = `M ${points[0].x} ${points[0].y}`;

          for (
            let index = 1;
            index < points.length - 1;
            index += 1
          ) {
            const previous = points[index - 1];
            const current = points[index];
            const next = points[index + 1];
            const incomingLength = Math.hypot(
              current.x - previous.x,
              current.y - previous.y
            );
            const outgoingLength = Math.hypot(
              next.x - current.x,
              next.y - current.y
            );
            const cornerRadius = Math.min(
              radius,
              incomingLength / 2,
              outgoingLength / 2
            );

            const before = {
              x:
                current.x -
                ((current.x - previous.x) /
                  incomingLength) *
                  cornerRadius,
              y:
                current.y -
                ((current.y - previous.y) /
                  incomingLength) *
                  cornerRadius
            };
            const after = {
              x:
                current.x +
                ((next.x - current.x) /
                  outgoingLength) *
                  cornerRadius,
              y:
                current.y +
                ((next.y - current.y) /
                  outgoingLength) *
                  cornerRadius
            };

            path += ` L ${before.x} ${before.y}`;
            path += ` Q ${current.x} ${current.y}, ${after.x} ${after.y}`;
          }

          const last = points[points.length - 1];
          path += ` L ${last.x} ${last.y}`;
          return path;
        }

        const nextArrows = answeredLinks.flatMap(
          ({ task, answerId }, linkIndex) => {
            const focusElement =
              activeContainer.querySelector<HTMLElement>(
                `[data-target-id="${task.targetId}"]`
              );
            const answerElement =
              activeContainer.querySelector<HTMLElement>(
                `[data-target-id="${answerId}"]`
              );

            if (!focusElement || !answerElement) return [];

            const donorElement =
              task.role === "donor"
                ? focusElement
                : answerElement;
            const receiverElement =
              task.role === "donor"
                ? answerElement
                : focusElement;
            const donorId =
              task.role === "donor"
                ? task.targetId
                : answerId;
            const donorLabel =
              activeContainer.querySelector<HTMLElement>(
                `[data-target-label-id="${donorId}"]`
              );

            const donor = localRect(
              (donorLabel ?? donorElement).getBoundingClientRect()
            );
            const receiver = localRect(
              receiverElement.getBoundingClientRect()
            );

            const startPoint = {
              x: donor.centerX,
              y: Math.max(4, donor.top - 7)
            };
            const receiverGate = {
              x: receiver.centerX,
              y: Math.max(4, receiver.top - 24)
            };
            const receiverCurveEntry = {
              x: receiver.centerX,
              y: Math.max(4, receiver.top - 10)
            };
            const receiverTip = {
              x: receiver.centerX,
              y: receiver.top + Math.min(
                8,
                Math.max(4, receiver.height * 0.22)
              )
            };

            const startCell = toCell(
              startPoint.x,
              startPoint.y
            );
            const gateCell = toCell(
              receiverGate.x,
              receiverGate.y
            );
            const allowedCells = new Set<string>();

            for (let offset = -3; offset <= 3; offset += 1) {
              allowedCells.add(
                `${startCell.col}:${startCell.row + offset}`
              );
              allowedCells.add(
                `${gateCell.col}:${gateCell.row + offset}`
              );
            }

            const tipCell = toCell(
              receiverTip.x,
              receiverTip.y
            );

            const minReceiverRow = Math.min(
              gateCell.row,
              tipCell.row
            );
            const maxReceiverRow = Math.max(
              gateCell.row,
              tipCell.row
            );

            for (
              let row = minReceiverRow;
              row <= maxReceiverRow;
              row += 1
            ) {
              for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
                allowedCells.add(
                  `${gateCell.col + colOffset}:${row}`
                );
              }
            }

            const pathPoints = findPath(
              startCell,
              gateCell,
              allowedCells
            );

            let routedPoints: Array<{ x: number; y: number }>;

            if (pathPoints.length > 0) {
              const shiftedPoints = pathPoints.map((point) => ({
                x:
                  point.x +
                  ((linkIndex % 3) - 1) * 2,
                y: point.y
              }));

              routedPoints = [
                startPoint,
                ...shiftedPoints,
                receiverGate
              ];
            } else {
              const lane = linkIndex % 4;
              const leftRail = 10 + lane * 8;
              const rightRail =
                canvasWidth - 10 - lane * 8;
              const railX =
                Math.abs(startPoint.x - leftRail) +
                  Math.abs(receiverGate.x - leftRail) <=
                Math.abs(startPoint.x - rightRail) +
                  Math.abs(receiverGate.x - rightRail)
                  ? leftRail
                  : rightRail;
              const startLaneY = Math.max(
                6,
                startPoint.y - 18 - lane * 5
              );
              const gateLaneY = Math.max(
                6,
                receiverGate.y - 12 - lane * 5
              );

              routedPoints = [
                startPoint,
                { x: startPoint.x, y: startLaneY },
                { x: railX, y: startLaneY },
                { x: railX, y: gateLaneY },
                { x: receiverGate.x, y: gateLaneY },
                receiverGate
              ];
            }

            const simplified = simplifyPath(routedPoints);
            const mainPath = roundedPath(simplified, 7);
            const finalCurve = ` M ${receiverGate.x} ${receiverGate.y}
              C ${receiverGate.x} ${receiverCurveEntry.y},
                ${receiverTip.x} ${receiverCurveEntry.y},
                ${receiverTip.x} ${receiverTip.y}`;
            const path = `${mainPath}${finalCurve}`;

            return [{
              id: `${task.targetId}-${answerId}`,
              path
            }];
          }
        );

        setAgreementArrows((current) => {
          const unchanged =
            current.length === nextArrows.length &&
            current.every((arrow, index) => {
              const next = nextArrows[index];

              return (
                next &&
                arrow.id === next.id &&
                arrow.path === next.path
              );
            });

          return unchanged ? current : nextArrows;
        });
      });
    }

    updateArrows();
    window.addEventListener("resize", updateArrows);

    if (document.fonts?.ready) {
      document.fonts.ready.then(updateArrows);
    }

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updateArrows);
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
    <div className="word-class-reader">
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
        className="word-class-reader-text"
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
            <defs>
              <marker
                id="agreement-arrow-head"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <path d="M0,0 L8,4 L0,8 Z" />
              </marker>
            </defs>

            {agreementArrows.map((arrow) => (
              <path
                className="agreement-arrow-path"
                d={arrow.path}
                markerEnd="url(#agreement-arrow-head)"
                key={arrow.id}
              />
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

      <div className="interactive-reader-actions">
        <Button
          type="button"
          variant="secondary"
          onClick={restart}
        >
          <RotateCcw size={18} />
          Recommencer
        </Button>

        {finishControl}
      </div>

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
