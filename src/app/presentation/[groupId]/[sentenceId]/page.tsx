"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Maximize,
  Minimize,
  Target,
  Trophy
} from "lucide-react";
import { InteractiveSentenceReader } from "@/components/presentation/interactive-sentence-reader";
import { WordClassReader } from "@/components/presentation/word-class-reader";
import { WordGroupReader } from "@/components/presentation/word-group-reader";
import { TreeAnalysisReader } from "@/components/presentation/tree-analysis-reader";
import {
  ReaderChromeProvider,
  ReaderChromeTarget
} from "@/components/presentation/reader-chrome";
import { ClassroomPointsMedal } from "@/components/classroom-portal-ornaments";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/app-store";
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
  const [, setWordClassComplete] = useState(false);
  const [, setWordGroupComplete] = useState(false);
  const [, setTreeAnalysisComplete] = useState(false);
  const [showPodium, setShowPodium] = useState(false);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [readerRunRevision, setReaderRunRevision] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const competitionTeams = useMemo(
    () => data.teams.filter((team) => team.groupId === groupId),
    [data.teams, groupId]
  );
  const storageKey = `competition-run-${groupId}-${competitionMode}-${competitionSourceId}`;
  const [competitionScores, setCompetitionScores] = useState<Record<string, number>>({});
  const [scoreInputs, setScoreInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    const handleFullscreenChange = () =>
      setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

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
      setPendingPoints((current) => [
        ...current.filter(
          (point) => !["find", "class", "role", "agreement"].includes(point.stage)
        ),
        ...points.map((point) => ({
          correction: toSyntheticCorrection(
            point.target,
            point.pointId
          ),
          stage: point.stage,
          points: point.points,
          pointId: point.pointId
        }))
      ]);
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

  function handleReaderComplete(
    complete: boolean,
    setComplete: (value: boolean) => void
  ) {
    setComplete(complete);
    if (complete) setShowCompletionDialog(true);
  }

  function restartActivity() {
    if (typeof window !== "undefined") {
      [
        readerPersistenceKey,
        `${readerPersistenceKey}-groups`,
        `${readerPersistenceKey}-word-classes`
      ].forEach((key) => window.sessionStorage.removeItem(key));
    }
    setPendingPoints([]);
    setFinished(false);
    setWordClassComplete(false);
    setWordGroupComplete(false);
    setTreeAnalysisComplete(false);
    setShowCompletionDialog(false);
    setReaderRunRevision((current) => current + 1);
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
    <ReaderChromeProvider>
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

        <div className="reader-scene-view-controls">
          <ReaderChromeTarget slot="viewTools" className="reader-scene-context-view-tools" />
          <button
            className="icon-control"
            onClick={() =>
              isFullscreen
                ? document.exitFullscreen()
                : document.documentElement.requestFullscreen()
            }
            aria-label={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
          >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
        </div>
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
        <section className="reader-command-ribbon">
          <div className="reader-command-instruction">
            <span className="reader-command-number"><Target size={25} /></span>
            <div>
              <span className="eyebrow">{sentence.title}</span>
              <ReaderChromeTarget slot="instruction" className="reader-command-instruction-slot" />
            </div>
          </div>
          <div className="reader-command-score">
            <ClassroomPointsMedal compact />
            <div>
              <strong>{pendingTotal} point{pendingTotal === 1 ? "" : "s"}</strong>
              <span>{finished ? "Enregistré" : "Pointage actuel"}</span>
            </div>
          </div>
        </section>

        <section className="reader-activity-flow" key={readerRunRevision}>
        {isTreeAnalysisActivity ? (
          <TreeAnalysisReader
            sentence={sentence}
            persistenceKey={readerPersistenceKey}
            onCompleteChange={(complete) =>
              handleReaderComplete(complete, setTreeAnalysisComplete)
            }
          />
        ) : isWordGroupActivity ? (
          <WordGroupReader
            sentence={sentence}
            boundaryMode={sentence.workflowPhases?.find((phase) => phase.kind === "groups")?.actions.find((action) => action.kind === "frame_groups")?.responseMode === "frame" ? "frame" : "brackets"}
            persistenceKey={readerPersistenceKey}
            onPoint={queueWordGroupPoint}
            onRestorePoints={restoreWordGroupPoints}
            onCompleteChange={(complete) =>
              handleReaderComplete(complete, setWordGroupComplete)
            }
          />
        ) : isWordClassActivity ? (
          <WordClassReader
            sentence={sentence}
            persistenceKey={readerPersistenceKey}
            onPoint={queueWordClassPoint}
            onRestorePoints={restoreWordClassPoints}
            onCompleteChange={(complete) =>
              handleReaderComplete(complete, setWordClassComplete)
            }
          />
        ) : (
          <InteractiveSentenceReader
            sentence={sentence}
            displayMode={isTextActivity ? "text" : "sentence"}
            correctionCodes={data.correctionCodes}
            onPoint={queuePoint}
            onWordClassPoint={queueWordClassPoint}
            persistenceKey={readerPersistenceKey}
            onRestorePoints={restorePendingPoints}
            onRestoreWordClassPoints={restoreWordClassPoints}
            onCompleteChange={(complete) => {
              if (complete) setShowCompletionDialog(true);
            }}
          />
        )}
        </section>

        <section className="reader-command-dock">
          <ReaderChromeTarget slot="progress" className="reader-command-progress-slot" />
          <ReaderChromeTarget slot="contextTools" className="reader-command-context-slot" />
          <ReaderChromeTarget slot="actions" className="reader-command-actions-slot" />
        </section>

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

        {showCompletionDialog && (
          <div className="reader-dialog-backdrop">
            <div className="reader-dialog reader-completion-dialog" role="dialog" aria-modal="true" aria-labelledby="reader-completion-title">
              <CheckCircle2 size={48} aria-hidden="true" />
              <span className="eyebrow">Activité terminée</span>
              <h2 id="reader-completion-title">Bravo, l’activité est terminée!</h2>
              <p>Les réponses et le pointage sont prêts à être enregistrés.</p>
              <div className="reader-completion-actions">
                <Button onClick={finishSentence}>Quitter</Button>
                <Button variant="secondary" onClick={restartActivity}>Recommencer</Button>
              </div>
            </div>
          </div>
        )}
      </main>

    </div>
    </ReaderChromeProvider>
  );
}
