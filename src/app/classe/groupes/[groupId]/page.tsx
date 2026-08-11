"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpenCheck,
  CalendarDays,
  Play,
  RotateCcw,
  Trophy,
  X
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActivityObjectiveBadges } from "@/components/activity-objective-badges";
import { useAppStore } from "@/store/app-store";
import {
  getWordClassActivityPointTotal,
  getWordClassAnalysisTargetCount
} from "@/lib/activity-types";
import {
  getCompletedSentenceIds,
  getPerfectSentenceCount,
  getWeeklyPoints
} from "@/lib/stats";

export default function ClassroomGroupPage({
  params
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = use(params);
  const {
    data,
    setActivityAssignmentStatus,
    setSessionAssignmentStatus
  } = useAppStore();

  const [showAllCompetitionScores, setShowAllCompetitionScores] = useState(false);

  const group = data.groups.find((item) => item.id === groupId);
  const level = data.levels.find((item) => item.id === group?.levelId);

  const activities = data.sentences.filter((sentence) =>
    sentence.assignedGroupIds.includes(groupId)
  );
  const sessions = data.plannedSessions
    .filter((session) => session.groupId === groupId)
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));

  const activityStatus = (activity: typeof activities[number]) =>
    activity.assignmentStatusByGroup?.[groupId] ?? "todo";

  const sessionSource = (planned: typeof sessions[number]) =>
    data.collections.find((item) => item.id === planned.sourceSessionId);

  const sessionStatus = (planned: typeof sessions[number]) =>
    sessionSource(planned)?.assignmentStatusByGroup?.[groupId] ?? "todo";

  const activeActivities = activities.filter((activity) =>
    !["completed", "archived"].includes(activityStatus(activity))
  );
  const completedActivities = activities.filter(
    (activity) => activityStatus(activity) === "completed"
  );
  const activeSessions = sessions.filter((session) =>
    !["completed", "archived"].includes(sessionStatus(session))
  );
  const completedSessions = sessions.filter(
    (session) => sessionStatus(session) === "completed"
  );
  const teams = data.teams
    .filter((team) => team.groupId === groupId)
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  const competitionActivities = activities.filter(
    (activity) =>
      activity.competitionEnabled &&
      !["completed", "archived"].includes(activityStatus(activity))
  );

  const competitionSessions = data.collections.filter(
    (session) =>
      session.competitionEnabled &&
      (session.assignedGroupIds ?? []).includes(groupId) &&
      !["completed", "archived"].includes(
        session.assignmentStatusByGroup?.[groupId] ?? "todo"
      )
  );

  const cumulativeCompetitionScores = useMemo(() => {
    const totals = new Map<string, {
      teamId: string;
      teamName: string;
      teamIcon?: string;
      score: number;
    }>();

    data.competitionResults
      .filter((result) => result.groupId === groupId)
      .forEach((result) => {
        result.standings.forEach((standing) => {
          const current = totals.get(standing.teamId);

          totals.set(standing.teamId, {
            teamId: standing.teamId,
            teamName: standing.teamName,
            teamIcon: standing.teamIcon,
            score: (current?.score ?? 0) + standing.score
          });
        });
      });

    teams.forEach((team) => {
      if (!totals.has(team.id)) {
        totals.set(team.id, {
          teamId: team.id,
          teamName: team.name,
          teamIcon: team.icon,
          score: 0
        });
      }
    });

    const sorted = Array.from(totals.values()).sort(
      (a, b) =>
        b.score - a.score ||
        a.teamName.localeCompare(b.teamName, "fr")
    );

    let previousScore: number | null = null;
    let previousRank = 0;

    return sorted.map((team, index) => {
      const rank =
        previousScore !== null && previousScore === team.score
          ? previousRank
          : index + 1;

      previousScore = team.score;
      previousRank = rank;

      return { ...team, rank };
    });
  }, [data.competitionResults, groupId, teams]);

  if (!group || !level) {
    return (
      <div className="classroom-page">
        <Card>
          <h1>Groupe introuvable</h1>
          <Link href="/classe">Retour à Classe</Link>
        </Card>
      </div>
    );
  }

  const completedCompetitionResults = data.competitionResults
    .filter((result) => result.groupId === group.id)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));


  const weeklyPoints = getWeeklyPoints(data.scoreEvents, group.id);
  const completedIds = getCompletedSentenceIds(data.scoreEvents, group.id);
  const perfectCount = getPerfectSentenceCount(
    data.scoreEvents,
    data.sentences,
    group.id
  );
  const reviewCount = data.reviewStates.filter(
    (item) => item.groupId === group.id && item.markedForReview
  ).length;

  function getActivityCompletionStats(activityId: string) {
    const events = data.scoreEvents.filter(
      (event) =>
        event.groupId === groupId &&
        event.sentenceId === activityId
    );

    const activity = data.sentences.find(
      (sentence) => sentence.id === activityId
    );

    return {
      score: events.reduce((sum, event) => sum + event.points, 0),
      successfulCorrections: new Set(
        events
          .filter((event) => event.correctionId && event.points > 0)
          .map((event) => event.correctionId)
      ).size,
      totalCorrections:
        activity?.activityType === "word_classes"
          ? getWordClassActivityPointTotal(activity)
          : activity?.corrections.length ?? 0
    };
  }

  function getSessionCompletionStats(sentenceIds: string[]) {
    const events = data.scoreEvents.filter(
      (event) =>
        event.groupId === groupId &&
        sentenceIds.includes(event.sentenceId)
    );

    const totalCorrections = data.sentences
      .filter((sentence) => sentenceIds.includes(sentence.id))
      .reduce(
        (sum, sentence) =>
          sum +
          (sentence.activityType === "word_classes"
            ? getWordClassActivityPointTotal(sentence)
            : sentence.corrections.length),
        0
      );

    return {
      score: events.reduce((sum, event) => sum + event.points, 0),
      successfulCorrections: new Set(
        events
          .filter((event) => event.correctionId && event.points > 0)
          .map((event) => event.correctionId)
      ).size,
      totalCorrections
    };
  }

  return (
    <div className="classroom-page classroom-group-page">
      <Link href="/classe" className="classroom-section-back">
        <ArrowLeft size={18} />
        Tous les groupes
      </Link>

      <section className="classroom-group-hero">
        <div>
          <span className="eyebrow">{level.name}</span>
          <h1>{group.name}</h1>
          {group.description && <p>{group.description}</p>}
        </div>
      </section>

      <div className="classroom-stats-grid">
        <Card className="classroom-stat-card">
          <Trophy size={24} />
          <span>Points cette semaine</span>
          <strong>{weeklyPoints}</strong>
        </Card>

        <Card className="classroom-stat-card">
          <BookOpenCheck size={24} />
          <span>Réussites parfaites</span>
          <strong>{perfectCount}/{completedIds.length}</strong>
        </Card>

        <Card className="classroom-stat-card">
          <RotateCcw size={24} />
          <span>À revoir</span>
          <strong>{reviewCount}</strong>
        </Card>
      </div>

      <section className="classroom-content-section">
        <div className="classroom-section-heading simple">
          <h2>Activités</h2>
          <span>{activeActivities.length}</span>
        </div>

        <div className="classroom-activity-grid">
          {activeActivities.map((activity) => (
            <Card className="classroom-activity-card" key={activity.id}>
              <div className="classroom-activity-card-content">
                <div className="classroom-activity-card-topline">
                  <ActivityObjectiveBadges sentence={activity} />
                  <span className={`assignment-status-pill status-${activityStatus(activity)}`}>
                    {activityStatus(activity) === "in_progress" ? "En cours" : "À faire"}
                  </span>
                </div>
                <h3>{activity.title}</h3>
              </div>

              <div className="classroom-activity-card-footer">
                <span>
                  {activity.activityType === "word_classes"
                    ? `${getWordClassAnalysisTargetCount(activity)} mot${
                        getWordClassAnalysisTargetCount(activity) > 1
                          ? "s"
                          : ""
                      }`
                    : `${activity.corrections.length} correction${
                        activity.corrections.length > 1 ? "s" : ""
                      }`}
                </span>
                <Link href={`/presentation/${group.id}/${activity.id}?from=classe`}>
                  <Button>
                    <Play size={18} />
                    Lancer
                  </Button>
                </Link>
              </div>
            </Card>
          ))}

          {activeActivities.length === 0 && (
            <Card>
              <h3>Aucune activité assignée</h3>
              <p>Assigne une activité à ce groupe dans le tableau de bord.</p>
            </Card>
          )}
        </div>

        <details className="section-completed-menu">
          <summary>
            Terminées ({completedActivities.length})
          </summary>

          <div className="completed-items-list">
            {completedActivities.map((activity) => {
              const stats = getActivityCompletionStats(activity.id);

              return (
                <Card
                  className="completed-item-card"
                  key={`completed-activity-${activity.id}`}
                >
                  <div className="completed-item-main">
                    <ActivityObjectiveBadges sentence={activity} />

                    <strong>{activity.title}</strong>

                    <div className="completed-item-stats">
                      <span>Score : {stats.score}</span>
                      <span>
                        {activity.activityType === "word_classes"
                          ? "Réponses"
                          : "Corrections"} :{" "}
                        {stats.successfulCorrections}/{stats.totalCorrections}
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    onClick={() =>
                      setActivityAssignmentStatus(
                        activity.id,
                        group.id,
                        "todo",
                        0
                      )
                    }
                  >
                    Rejouer
                  </Button>
                </Card>
              );
            })}

            {completedActivities.length === 0 && (
              <p className="completed-empty">Aucune activité terminée.</p>
            )}
          </div>
        </details>
      </section>

      <section className="classroom-content-section">
        <div className="classroom-section-heading simple">
          <h2>Séances</h2>
          <span>{activeSessions.length}</span>
        </div>

        <div className="classroom-session-list">
          {activeSessions.map((session) => {
            const firstActivity = data.sentences.find(
              (activity) => activity.id === session.sentenceIds[0]
            );

            return (
              <Card className="classroom-session-card" key={session.id}>
                <div className="classroom-session-icon">
                  <CalendarDays size={24} />
                </div>
                <div>
                  <h3>{session.title}</h3>
                  <span className={`assignment-status-pill status-${sessionStatus(session)}`}>
                    {sessionStatus(session) === "in_progress" ? "En cours" : "À faire"}
                  </span>
                  <p>
                    {new Date(`${session.scheduledDate}T12:00:00`).toLocaleDateString("fr-CA")}
                    {" · "}
                    {session.sentenceIds.length} activité{session.sentenceIds.length > 1 ? "s" : ""}
                  </p>
                </div>
                {firstActivity && (
                  <Link href={`/presentation/${group.id}/${firstActivity.id}?plan=${session.id}&from=classe`}>
                    <Button>
                      <Play size={18} />
                      {sessionStatus(session) === "in_progress" ? "Reprendre" : "Démarrer"}
                    </Button>
                  </Link>
                )}
              </Card>
            );
          })}

          {activeSessions.length === 0 && (
            <Card>
              <h3>Aucune séance</h3>
              <p>Prépare une séance dans la page d’administration du groupe.</p>
            </Card>
          )}
        </div>


      <details className="section-completed-menu">
        <summary>
          Terminées ({completedSessions.length})
        </summary>

        <div className="completed-items-list">
          {completedSessions.map((session) => {
            const stats = getSessionCompletionStats(session.sentenceIds);

            return (
              <Card
                className="completed-item-card"
                key={`completed-session-${session.id}`}
              >
                <div className="completed-item-main">
                  <span className="activity-type-badge">Séance</span>
                  <strong>{session.title}</strong>

                  <div className="completed-item-stats">
                    <span>Score : {stats.score}</span>
                    <span>
                      Corrections : {stats.successfulCorrections}/
                      {stats.totalCorrections}
                    </span>
                  </div>
                </div>

                <Button
                  variant="secondary"
                  onClick={() =>
                    session.sourceSessionId &&
                    setSessionAssignmentStatus(
                      session.sourceSessionId,
                      group.id,
                      "todo",
                      0
                    )
                  }
                >
                  Rejouer
                </Button>
              </Card>
            );
          })}

          {completedSessions.length === 0 && (
            <p className="completed-empty">Aucune séance terminée.</p>
          )}
        </div>
      </details>
      </section>



      <section className="classroom-content-section competition-center organic">
        <div className="classroom-section-heading simple competition-main-heading">
          <h2>Compétition amicale</h2>
        </div>

        <div className="competition-cumulative-podium">
          <div className="competition-cumulative-heading">
            <strong>Classement cumulatif</strong>
            <button
              type="button"
              className="competition-ranking-link"
              onClick={() => setShowAllCompetitionScores(true)}
            >
              Voir tous les points
            </button>
          </div>

          <div className="competition-cumulative-top3">
            {cumulativeCompetitionScores.slice(0, 3).map((team) => (
              <div
                className={`competition-cumulative-team rank-${team.rank}`}
                key={team.teamId}
              >
                <span className="competition-cumulative-medal">
                  {team.rank === 1 ? "🥇" : team.rank === 2 ? "🥈" : "🥉"}
                </span>
                <span className="competition-cumulative-icon">
                  {team.teamIcon ?? "⭐"}
                </span>
                <strong>{team.teamName}</strong>
                <span>{team.score} pts</span>
              </div>
            ))}

            {cumulativeCompetitionScores.length === 0 && (
              <span className="competition-empty-inline">
                Aucun point accumulé pour l’instant.
              </span>
            )}
          </div>
        </div>

        <div className="competition-organic-list">
          <div className="competition-organic-heading simple">
            <h3>À faire</h3>
            <span className="competition-count">
              {competitionActivities.length + competitionSessions.length}
            </span>
          </div>

          <div className="competition-organic-items">
            {competitionActivities.map((activity) => (
              <Card className="competition-activity-card" key={`activity-${activity.id}`}>
                <div>
                  <span className="activity-type-badge">Activité</span>
                  <h3>{activity.title}</h3>
                  <small>Une activité en compétition</small>
                </div>

                <Link
                  href={`/presentation/${group.id}/${activity.id}?from=classe&competition=activity&source=${activity.id}`}
                >
                  <Button>
                    <Trophy size={18} />
                    Commencer
                  </Button>
                </Link>
              </Card>
            ))}

            {competitionSessions.map((session) => {
              const firstActivity = data.sentences.find(
                (activity) => activity.id === session.sentenceIds[0]
              );
              if (!firstActivity) return null;

              const planned = data.plannedSessions.find(
                (item) =>
                  item.sourceSessionId === session.id &&
                  item.groupId === group.id
              );

              return (
                <Card className="competition-activity-card" key={`session-${session.id}`}>
                  <div>
                    <span className="activity-type-badge">Séance</span>
                    <h3>{session.name}</h3>
                    <small>
                      {session.sentenceIds.length} activité
                      {session.sentenceIds.length > 1 ? "s" : ""}
                    </small>
                  </div>

                  <Link
                    href={`/presentation/${group.id}/${firstActivity.id}?from=classe&competition=session&source=${session.id}${planned ? `&plan=${planned.id}` : ""}`}
                  >
                    <Button>
                      <Trophy size={18} />
                      Commencer
                    </Button>
                  </Link>
                </Card>
              );
            })}

            {competitionActivities.length + competitionSessions.length === 0 && (
              <div className="competition-empty-row">
                Aucune compétition assignée.
              </div>
            )}
          </div>
        </div>

        <details className="section-completed-menu competition-completed-menu">
          <summary>
            Terminées ({completedCompetitionResults.length})
          </summary>

          <div className="completed-card-grid">
            {completedCompetitionResults.map((result) => {
              const winner = result.standings.find(
                (standing) => standing.rank === 1
              );

              return (
                <Card
                  className="completed-item-card completed-competition-card"
                  key={result.id}
                >
                  <div className="completed-item-main">
                    <span className="activity-type-badge">
                      {result.sourceType === "session" ? "Séance" : "Activité"}
                    </span>

                    <strong>{result.title}</strong>

                    <div className="completed-item-stats">
                      <span>
                        {new Date(result.completedAt).toLocaleDateString("fr-CA")}
                      </span>
                      <span>
                        {winner
                          ? `🏆 ${winner.teamIcon ?? "⭐"} ${winner.teamName} : ${winner.score}`
                          : "Aucun résultat"}
                      </span>
                    </div>
                  </div>

                  <div className="completed-competition-ranking">
                    {result.standings.slice(0, 3).map((standing) => (
                      <span key={standing.teamId}>
                        {standing.rank === 1
                          ? "🥇"
                          : standing.rank === 2
                            ? "🥈"
                            : "🥉"}
                        {" "}
                        {standing.teamIcon ?? "⭐"} {standing.teamName} :
                        {" "}
                        {standing.score}
                      </span>
                    ))}
                  </div>
                </Card>
              );
            })}

            {completedCompetitionResults.length === 0 && (
              <p className="completed-empty">
                Aucune compétition terminée.
              </p>
            )}
          </div>
        </details>

        <div className="competition-organic-teams">
          <div className="competition-organic-heading simple">
            <h3>Équipes</h3>
            <span className="competition-count">{teams.length}</span>
          </div>

          <div className="competition-team-list">
            {teams.map((team) => (
              <div className="competition-team-line" key={team.id}>
                <span className="classroom-team-icon">{team.icon ?? "⭐"}</span>
                <div>
                  <strong>{team.name}</strong>
                  <small>
                    {(team.members ?? []).length > 0
                      ? (team.members ?? []).join(", ")
                      : "Aucun élève"}
                  </small>
                </div>
              </div>
            ))}

            {teams.length === 0 && (
              <div className="competition-empty-row">
                Aucune équipe créée.
              </div>
            )}
          </div>
        </div>
      </section>
      {showAllCompetitionScores && (
        <div className="modal-backdrop">
          <Card
            className="modal-card competition-ranking-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Classement cumulatif des équipes"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">Compétitions amicales</span>
                <h2>Points de toutes les équipes</h2>
              </div>

              <button
                type="button"
                className="icon-control"
                onClick={() => setShowAllCompetitionScores(false)}
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="competition-full-ranking">
              {cumulativeCompetitionScores.map((team) => (
                <div className="competition-full-ranking-row" key={team.teamId}>
                  <span className="competition-full-rank">{team.rank}</span>
                  <span className="competition-full-icon">
                    {team.teamIcon ?? "⭐"}
                  </span>
                  <strong>{team.teamName}</strong>
                  <b>{team.score} pts</b>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

    </div>
  );
}
