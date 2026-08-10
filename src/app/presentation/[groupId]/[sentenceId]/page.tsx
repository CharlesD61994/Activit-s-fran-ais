"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Maximize,
  Trophy
} from "lucide-react";
import { InteractiveSentenceReader } from "@/components/presentation/interactive-sentence-reader";
import { WordClassReader } from "@/components/presentation/word-class-reader";
import { WordGroupReader } from "@/components/presentation/word-group-reader";
import { TreeAnalysisReader } from "@/components/presentation/tree-analysis-reader";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/app-store";
import { getWordClassAnalysisTargetCount } from "@/lib/activity-types";
import { buildCompetitionStandings } from "@/lib/competition";
import type { CompetitionResult, ScoreEvent, SentenceCorrection, WordClassTarget, WordGroupTarget } from "@/types";

type PendingPoint = {
  correction: SentenceCorrection;
  stage:
    | "click"
    | "word"
    | "code"
    | "find"
    | "class"
    | "role"
    | "agreement"
    | "left_bracket"
    | "right_bracket"
    | "group_type"
    | "nucleus"
    | "contracted_answer"
    | "gprep_nucleus"
    | "nested_presence"
    | "nested_type";
  points: number;
  pointId?: string;
};

export default function PresentationPage({
  params
}: {
  params: Promise<{ groupId: string; sentenceId: string }>;
}) {
  const { groupId, sentenceId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    data,
    addScoreEvent,
    saveCompetitionResult,
    setActivityAssignmentStatus,
    setSessionAssignmentStatus
  } = useAppStore();

  const group = data.groups.find((item) => item.id === groupId);
  const sentence = data.sentences.find((item) => item.id === sentenceId);
  const plannedSessionId = searchParams.get("plan");
  const launchedFromClasse = searchParams.get("from") === "classe";
  const competitionMode = searchParams.get("competition");
  const competitionSourceId = searchParams.get("source");
  const competitionActive =
    competitionMode === "activity" || competitionMode === "session";
  const plannedSession = data.plannedSessions.find((item) => item.id === plannedSessionId);

  const sequence = useMemo(() => {
    if (!plannedSession) return [];
    return plannedSession.sentenceIds
      .map((id) => data.sentences.find((item) => item.id === id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [data.sentences, plannedSession]);

  const sentenceIndex = sequence.findIndex((item) => item.id === sentenceId);
  const nextSentence =
    sentenceIndex >= 0 && sentenceIndex < sequence.length - 1
      ? sequence[sentenceIndex + 1]
      : null;

  const [sessionId] = useState(() => crypto.randomUUID());
  const readerPersistenceKey = `reader-progress-${groupId}-${plannedSessionId ?? "single"}-${sentenceId}-${competitionSourceId ?? "normal"}`;
  const [pendingPoints, setPendingPoints] = useState<PendingPoint[]>([]);
  const [finished, setFinished] = useState(false);
  const [wordClassComplete, setWordClassComplete] = useState(false);
  const [wordGroupComplete, setWordGroupComplete] = useState(false);
  const [treeAnalysisComplete, setTreeAnalysisComplete] = useState(false);
  const [showPodium, setShowPodium] = useState(false);
  const competitionTeams = useMemo(
    () => data.teams.filter((team) => team.groupId === groupId),
    [data.teams, groupId]
  );
  const storageKey = `competition-run-${groupId}-${competitionMode}-${competitionSourceId}`;
  const [competitionScores, setCompetitionScores] = useState<Record<string, number>>({});
  const [scoreInputs, setScoreInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!competitionActive || typeof window === "undefined") return;

    const saved = window.sessionStorage.getItem(storageKey);
    if (saved) {
      setCompetitionScores(JSON.parse(saved));
      return;
    }

    setCompetitionScores(
      Object.fromEntries(competitionTeams.map((team) => [team.id, 0]))
    );
  }, [competitionActive, competitionTeams, storageKey]);

  useEffect(() => {
    if (!group) return;

    if (plannedSession?.sourceSessionId) {
      setSessionAssignmentStatus(
        plannedSession.sourceSessionId,
        groupId,
        "in_progress",
        Math.max(0, sentenceIndex)
      );
    } else {
      setActivityAssignmentStatus(sentenceId, groupId, "in_progress", 0);
    }
    // The assignment should change only when the displayed activity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, sentenceId, plannedSession?.sourceSessionId]);

  useEffect(() => {
    if (!group) return;
    document.documentElement.dataset.theme = group.themeId;
    return () => {
      document.documentElement.dataset.theme = data.globalThemeId;
    };
  }, [data.globalThemeId, group]);

  const pendingTotal = pendingPoints.reduce((sum, item) => sum + item.points, 0);
  const isTextActivity = sentence?.activityType === "text_correction";
  const isWordClassActivity = sentence?.activityType === "word_classes";
  const isWordGroupActivity = sentence?.activityType === "word_groups";
  const isTreeAnalysisActivity = sentence?.activityType === "tree_analysis";

  const restorePendingPoints = useCallback((points: PendingPoint[]) => {
    setPendingPoints(points);
  }, []);

  function queuePoint(
    correction: SentenceCorrection,
    stage:
      | "click"
      | "word"
      | "code"
      | "find"
      | "class"
      | "role"
      | "agreement"
      | "left_bracket"
      | "right_bracket"
      | "group_type"
      | "nucleus"
      | "contracted_answer"
      | "gprep_nucleus"
      | "nested_presence"
      | "nested_type",
    points: number,
    pointId?: string
  ) {
    setPendingPoints((items) => {
      if (
        pointId &&
        items.some((item) => item.pointId === pointId)
      ) {
        return items;
      }

      return [
        ...items,
        { correction, stage, points, pointId }
      ];
    });
  }

  function toSyntheticCorrection(
    target: WordClassTarget,
    pointId?: string
  ): SentenceCorrection {
    return {
      id: pointId ?? target.id,
      start: target.start,
      end: target.end,
      originalText: target.text,
      correctedText: target.text,
      correctionCodeId: "",
      points: 1,
      revealOrder: 0,
      explanation: target.wordClass
    };
  }

  function queueWordClassPoint(
    target: WordClassTarget,
    stage: "find" | "class" | "role" | "agreement",
    points: number,
    pointId?: string
  ) {
    queuePoint(
      toSyntheticCorrection(target, pointId),
      stage,
      points,
      pointId
    );
  }

  const restoreWordClassPoints = useCallback(
    (
      points: Array<{
        target: WordClassTarget;
        stage: "find" | "class" | "role" | "agreement";
        points: number;
        pointId?: string;
      }>
    ) => {
      setPendingPoints(
        points.map((point) => ({
          correction: toSyntheticCorrection(
            point.target,
            point.pointId
          ),
          stage: point.stage,
          points: point.points,
          pointId: point.pointId
        }))
      );
    },
    []
  );

  function toSyntheticGroupCorrection(
    target: WordGroupTarget,
    pointId: string
  ): SentenceCorrection {
    return {
      id: pointId,
      start: target.start,
      end: target.end,
      originalText: target.text,
      correctedText: target.text,
      correctionCodeId: "",
      points: 1,
      revealOrder: 0,
      explanation: target.groupType
    };
  }

  function queueWordGroupPoint(
    target: WordGroupTarget,
    stage:
      | "left_bracket"
      | "right_bracket"
      | "group_type"
      | "nucleus"
      | "contracted_answer"
      | "gprep_nucleus"
      | "nested_presence"
      | "nested_type",
    points: number,
    pointId: string
  ) {
    queuePoint(
      toSyntheticGroupCorrection(target, pointId),
      stage,
      points,
      pointId
    );
  }

  const restoreWordGroupPoints = useCallback(
    (
      points: Array<{
        target: WordGroupTarget;
        stage:
          | "left_bracket"
          | "right_bracket"
          | "group_type"
          | "nucleus"
          | "contracted_answer"
          | "gprep_nucleus"
          | "nested_presence"
          | "nested_type";
        points: number;
        pointId: string;
      }>
    ) => {
      setPendingPoints(
        points.map((point) => ({
          correction: toSyntheticGroupCorrection(
            point.target,
            point.pointId
          ),
          stage: point.stage,
          points: point.points,
          pointId: point.pointId
        }))
      );
    },
    []
  );

  if (!group || !sentence) {
    return (
      <div className="presentation-error">
        <h1>Présentation introuvable</h1>
        <Link href="/">Retour à l’accueil</Link>
      </div>
    );
  }

  function addCompetitionScore(teamId: string) {
    const value = Number(scoreInputs[teamId]);
    if (!Number.isFinite(value) || value === 0) return;

    setCompetitionScores((current) => {
      const next = {
        ...current,
        [teamId]: (current[teamId] ?? 0) + value
      };
      window.sessionStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });

    setScoreInputs((current) => ({ ...current, [teamId]: "" }));
  }

  function buildStandings() {
    return buildCompetitionStandings(competitionTeams, competitionScores);
  }

  function finishSentence() {
    if (finished) return;

    pendingPoints.forEach(
      ({ correction, stage, points, pointId }) => {
      const event: ScoreEvent = {
        id: crypto.randomUUID(),
        groupId,
        sentenceId,
        sessionId,
        correctionId: pointId ?? correction.id,
        correctionCodeId: correction.correctionCodeId,
        points,
        reason:
          stage === "code" ||
          stage === "class" ||
          stage === "role" ||
          stage === "agreement" ||
          stage === "group_type" ||
          stage === "nucleus" ||
          stage === "contracted_answer" ||
          stage === "gprep_nucleus" ||
          stage === "nested_presence" ||
          stage === "nested_type"
            ? "justification"
            : "correction",
        createdAt: new Date().toISOString()
      };

        addScoreEvent(event);
      }
    );

    setFinished(true);
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(readerPersistenceKey);
    }

    if (plannedSession && nextSentence) {
      if (plannedSession.sourceSessionId) {
        setSessionAssignmentStatus(
          plannedSession.sourceSessionId,
          groupId,
          "in_progress",
          sentenceIndex + 1
        );
      }

      const params = new URLSearchParams();
      if (plannedSessionId) params.set("plan", plannedSessionId);
      if (launchedFromClasse) params.set("from", "classe");
      if (competitionActive && competitionMode && competitionSourceId) {
        params.set("competition", competitionMode);
        params.set("source", competitionSourceId);
      }
      const suffix = params.toString() ? `?${params.toString()}` : "";
      router.push(`/presentation/${groupId}/${nextSentence.id}${suffix}`);
      return;
    }

    if (plannedSession?.sourceSessionId) {
      setSessionAssignmentStatus(
        plannedSession.sourceSessionId,
        groupId,
        "completed",
        sequence.length
      );
    } else {
      setActivityAssignmentStatus(sentenceId, groupId, "completed", 1);
    }

    if (competitionActive && competitionSourceId) {
      const standings = buildStandings();
      const sourceTitle =
        competitionMode === "session"
          ? data.collections.find((item) => item.id === competitionSourceId)?.name
          : data.sentences.find((item) => item.id === competitionSourceId)?.title;

      const result: CompetitionResult = {
        id: crypto.randomUUID(),
        groupId,
        sourceType: competitionMode === "session" ? "session" : "activity",
        sourceId: competitionSourceId,
        title: sourceTitle ?? data.sentences.find((item) => item.id === sentenceId)?.title ?? "Activité",
        standings,
        completedAt: new Date().toISOString()
      };

      saveCompetitionResult(result);
      window.sessionStorage.removeItem(storageKey);
      setShowPodium(true);
      return;
    }

    router.push(
      launchedFromClasse
        ? `/classe/groupes/${groupId}`
        : `/groupes/${groupId}`
    );
  }

  const standings = buildStandings();

  if (showPodium) {
    return (
      <div className="competition-podium-screen">
        <div className="competition-confetti" aria-hidden="true">
          🎉 ✨ 🏆 🎊 ⭐ 🎉 ✨ 🏆
        </div>

        <div className="competition-podium-heading">
          <span className="eyebrow">Compétition terminée</span>
          <h1>
            {standings.filter((item) => item.rank === 1).length > 1
              ? "Égalité en première place!"
              : `${standings[0]?.teamName ?? "Équipe"} remporte la compétition!`}
          </h1>
        </div>

        <div className="competition-final-podium">
          {standings.slice(0, 3).map((standing) => (
            <div
              className={`competition-final-place final-rank-${standing.rank}`}
              key={standing.teamId}
            >
              <span className="final-medal">
                {standing.rank === 1 ? "🥇" : standing.rank === 2 ? "🥈" : "🥉"}
              </span>
              <span className="final-team-icon">{standing.teamIcon ?? "⭐"}</span>
              <strong>{standing.teamName}</strong>
              <b>{standing.score} points</b>
            </div>
          ))}
        </div>

        <div className="competition-complete-ranking">
          {standings.map((standing) => (
            <div key={standing.teamId}>
              <span>{standing.rank}</span>
              <span>{standing.teamIcon ?? "⭐"} {standing.teamName}</span>
              <strong>{standing.score}</strong>
            </div>
          ))}
        </div>

        <Button onClick={() => router.push(`/classe/groupes/${groupId}`)}>
          Retour au groupe
        </Button>
      </div>
    );
  }

  return (
    <div className="reader-scene">
      <header className="reader-scene-header">
        <Link
          href={
            launchedFromClasse
              ? `/classe/groupes/${groupId}`
              : `/groupes/${groupId}`
          }
          className="presentation-back"
        >
          <ArrowLeft size={19} />
          Quitter
        </Link>

        <strong>{group.name}</strong>

        <button
          className="icon-control"
          onClick={() => document.documentElement.requestFullscreen()}
          aria-label="Plein écran"
        >
          <Maximize size={20} />
        </button>
      </header>

      <main
        className={`reader-scene-main ${
          isTextActivity ? "reader-scene-main-text" : ""
        } ${
          isWordClassActivity || isWordGroupActivity || isTreeAnalysisActivity
            ? "reader-scene-main-word-classes"
            : ""
        }`}
      >
        <section className="reader-title-panel">
          <h1>{sentence.title}</h1>
          {plannedSession && sequence.length > 1 && (
            <span>
              {isWordClassActivity || isWordGroupActivity || isTreeAnalysisActivity
                ? "Activité"
                : "Phrase"}{" "}
              {sentenceIndex + 1}/{sequence.length}
            </span>
          )}
        </section>

        <div className="reader-meta-row">
          <span className="reader-live-points">Points : {pendingTotal}</span>
          {isTreeAnalysisActivity ? (
            <span>{(sentence.treeAnalysisFlow?.orderedStepIds.length || ((sentence.treeAnalysisNodes?.length ?? 0) + (sentence.treeAnalysisInteractions?.length ?? 0) + (sentence.treeAnalysisTables?.length ?? 0)))} étape(s)</span>
          ) : isWordClassActivity ? (
            <span>
              {getWordClassAnalysisTargetCount(sentence)} mot
              {getWordClassAnalysisTargetCount(sentence) > 1
                ? "s"
                : ""} à trouver
            </span>
          ) : isWordGroupActivity ? (
            <span>
              {(sentence.wordGroupTargets ?? []).length} groupe
              {(sentence.wordGroupTargets ?? []).length > 1 ? "s" : ""} à trouver
            </span>
          ) : sentence.showCorrectionCount !== false ? (
            <span>
              {sentence.corrections.length} correction
              {sentence.corrections.length > 1 ? "s" : ""}
            </span>
          ) : null}
          {finished && (
            <span className="saved-score">
              Enregistré
            </span>
          )}
        </div>

        {isTreeAnalysisActivity ? (
          <TreeAnalysisReader
            sentence={sentence}
            persistenceKey={readerPersistenceKey}
            onCompleteChange={setTreeAnalysisComplete}
            finishControl={
              <Button className="finish-button" onClick={finishSentence} disabled={finished || !treeAnalysisComplete}>
                <CheckCircle2 size={20} />
                {finished ? "Terminé" : "Terminer"}
              </Button>
            }
          />
        ) : isWordGroupActivity ? (
          <WordGroupReader
            sentence={sentence}
            boundaryMode={sentence.workflowPhases?.find((phase) => phase.kind === "groups")?.actions.find((action) => action.kind === "frame_groups")?.responseMode === "frame" ? "frame" : "brackets"}
            persistenceKey={readerPersistenceKey}
            onPoint={queueWordGroupPoint}
            onRestorePoints={restoreWordGroupPoints}
            onCompleteChange={setWordGroupComplete}
            finishControl={
              <Button
                className="finish-button"
                onClick={finishSentence}
                disabled={finished || !wordGroupComplete}
              >
                <CheckCircle2 size={20} />
                {finished ? "Terminé" : "Terminer"}
              </Button>
            }
          />
        ) : isWordClassActivity ? (
          <WordClassReader
            sentence={sentence}
            persistenceKey={readerPersistenceKey}
            onPoint={queueWordClassPoint}
            onRestorePoints={restoreWordClassPoints}
            onCompleteChange={setWordClassComplete}
            finishControl={
              <Button
                className="finish-button"
                onClick={finishSentence}
                disabled={finished || !wordClassComplete}
              >
                <CheckCircle2 size={20} />
                {finished ? "Terminé" : "Terminer"}
              </Button>
            }
          />
        ) : (
          <InteractiveSentenceReader
            sentence={sentence}
            displayMode={isTextActivity ? "text" : "sentence"}
            correctionCodes={data.correctionCodes}
            onPoint={queuePoint}
            persistenceKey={readerPersistenceKey}
            onRestorePoints={restorePendingPoints}
            finishControl={
              <Button
                className="finish-button"
                onClick={finishSentence}
                disabled={finished}
              >
                <CheckCircle2 size={20} />
                {finished ? "Terminé" : "Terminer"}
              </Button>
            }
          />
        )}

        {competitionActive && (
          <section className="competition-scoreboard">
            <div className="competition-scoreboard-title">
              <Trophy size={18} />
              <span>Pointage de la compétition</span>
            </div>

            <div className="competition-scoreboard-teams">
              {competitionTeams.map((team) => (
                <div className="competition-score-team" key={team.id}>
                  <span className="competition-score-icon">{team.icon ?? "⭐"}</span>
                  <div>
                    <strong>{team.name}</strong>
                    <span>{competitionScores[team.id] ?? 0} pts</span>
                  </div>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="+"
                    value={scoreInputs[team.id] ?? ""}
                    onChange={(event) =>
                      setScoreInputs((current) => ({
                        ...current,
                        [team.id]: event.target.value
                      }))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addCompetitionScore(team.id);
                        const inputs = Array.from(
                          document.querySelectorAll<HTMLInputElement>(
                            ".competition-score-team input"
                          )
                        );
                        const index = inputs.indexOf(event.currentTarget);
                        inputs[(index + 1) % inputs.length]?.focus();
                      }
                    }}
                    aria-label={`Ajouter des points à ${team.name}`}
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

    </div>
  );
}
