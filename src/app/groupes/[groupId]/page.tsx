"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3, BookOpenCheck, Pencil, Play, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActivityObjectiveBadges } from "@/components/activity-objective-badges";
import { SentenceRenderer } from "@/components/sentence-renderer";
import { TeamManager } from "@/components/team-manager";
import { useAppStore } from "@/store/app-store";
import {
  getWordClassActivityPointTotal,
  getWordClassAnalysisTargetCount
} from "@/lib/activity-types";
import { themes } from "@/themes/themes";
import { buildCodeStats, getCompletedSentenceIds, getPerfectSentenceCount, getWeeklyPoints, groupEventsBySession } from "@/lib/stats";
import type { ThemeId } from "@/types";

export default function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const {
    data,
    updateGroupTheme,
    saveTeam,
    deleteTeam,
    saveReviewState,
    setActivityAssignmentStatus,
    setSessionAssignmentStatus
  } = useAppStore();
  const group = data.groups.find((item) => item.id === groupId);
  const level = data.levels.find((item) => item.id === group?.levelId);

  if (!group || !level) {
    return <div className="page"><Card><h1>Groupe introuvable</h1><Link href="/niveaux">Retour aux niveaux</Link></Card></div>;
  }

  const assignedSentences = data.sentences.filter((sentence) => sentence.assignedGroupIds.includes(group.id));
  const teams = data.teams.filter((team) => team.groupId === group.id).sort((a, b) => b.points - a.points);
  const events = data.scoreEvents.filter((event) => event.groupId === group.id);
  const sessions = groupEventsBySession(events);
  const codeStats = buildCodeStats(events, data.sentences, data.correctionCodes);
  const weeklyPoints = getWeeklyPoints(data.scoreEvents, group.id);
  const completedSentenceIds = getCompletedSentenceIds(data.scoreEvents, group.id);
  const perfectSentenceCount = getPerfectSentenceCount(data.scoreEvents, data.sentences, group.id);
  const reviewCount = data.reviewStates.filter((item) => item.groupId === group.id && item.markedForReview).length;

  const completedActivities = assignedSentences.filter(
    (sentence) =>
      sentence.assignmentStatusByGroup?.[group.id] === "completed"
  );

  const completedSessionSources = data.collections.filter(
    (session) =>
      (session.assignedGroupIds ?? []).includes(group.id) &&
      session.assignmentStatusByGroup?.[group.id] === "completed"
  );

  const completedCompetitionResults = data.competitionResults
    .filter((result) => result.groupId === group.id)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));

  function getActivityCompletionStats(activityId: string) {
    const activity = data.sentences.find(
      (sentence) => sentence.id === activityId
    );
    const activityEvents = data.scoreEvents.filter(
      (event) =>
        event.groupId === groupId &&
        event.sentenceId === activityId
    );

    return {
      score: activityEvents.reduce(
        (sum, event) => sum + event.points,
        0
      ),
      successfulCorrections: new Set(
        activityEvents
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
    const sessionEvents = data.scoreEvents.filter(
      (event) =>
        event.groupId === groupId &&
        sentenceIds.includes(event.sentenceId)
    );

    return {
      score: sessionEvents.reduce(
        (sum, event) => sum + event.points,
        0
      ),
      successfulCorrections: new Set(
        sessionEvents
          .filter((event) => event.correctionId && event.points > 0)
          .map((event) => event.correctionId)
      ).size,
      totalCorrections: data.sentences
        .filter((sentence) => sentenceIds.includes(sentence.id))
        .reduce(
          (sum, sentence) =>
          sum +
          (sentence.activityType === "word_classes"
            ? getWordClassActivityPointTotal(sentence)
            : sentence.corrections.length),
          0
        )
    };
  }

  return (
    <div className="page">
      <Link className="back-link" href="/"><ArrowLeft size={17} /> Retour à l’accueil</Link>

      <div className="hero compact">
        <div>
          <span className="eyebrow">{level.name}</span>
          <h1>{group.name}</h1>
          <p>{group.description ?? "Gestion du groupe et de son apparence."}</p>
        </div>
        <div className="form-actions">
          {assignedSentences[0] && (
            <Link href={`/presentation/${group.id}/${assignedSentences[0].id}`}>
              <Button><Play size={18} /> Démarrer la séance</Button>
            </Link>
          )}
          <Link href="/phrases/nouvelle">
            <Button variant="secondary"><Pencil size={18} /> Créer une activité</Button>
          </Link>
        </div>
      </div>

      <div className="grid summary-grid">
        <Card>
          <Trophy className="summary-icon" />
          <span className="eyebrow">Pointage de la semaine</span>
          <strong className="big-number">{weeklyPoints}</strong>
          <p>Le calcul recommence chaque dimanche, sans effacer l’historique.</p>
        </Card>

        <Card>
          <BookOpenCheck className="summary-icon" />
          <span className="eyebrow">Réussites parfaites</span>
          <strong className="big-number">
            {perfectSentenceCount}/{completedSentenceIds.length}
          </strong>
          <p>Activités réussies à 100 % sur toutes les phrases complétées.</p>
        </Card>

        <Card>
          <BarChart3 className="summary-icon" />
          <span className="eyebrow">Activités à revoir</span>
          <strong className="big-number">{reviewCount}</strong>
          <p>Activités marquées pour une reprise ultérieure.</p>
        </Card>
      </div>

      <Card className="settings-card">
        <div><span className="eyebrow">Apparence du groupe</span><h2>Choisir un thème permanent</h2><p>Le mode présentation utilisera ce thème par défaut.</p></div>
        <select value={group.themeId} onChange={(event) => updateGroupTheme(group.id, event.target.value as ThemeId)} aria-label="Thème permanent du groupe">
          {themes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </Card>

      <div className="group-section-block">
        <TeamManager
          groupId={group.id}
          teams={teams}
          onSave={saveTeam}
          onDelete={deleteTeam}
        />
      </div>

      <section className="dashboard-archive-section">
        <div className="section-heading archive-heading">
          <div>
            <span className="eyebrow">Historique du groupe</span>
            <h2>Archive</h2>
          </div>
          <span className="archive-total-count">
            {completedActivities.length +
              completedSessionSources.length +
              completedCompetitionResults.length}
          </span>
        </div>

        <details className="dashboard-archive-menu">
          <summary>
            Activités terminées ({completedActivities.length})
          </summary>

          <div className="completed-card-grid">
            {completedActivities.map((activity) => {
              const stats = getActivityCompletionStats(activity.id);

              return (
                <Card
                  className="completed-item-card"
                  key={`archive-activity-${activity.id}`}
                >
                  <div className="completed-item-main">
                    <ActivityObjectiveBadges sentence={activity} />
                    <strong>{activity.title}</strong>

                    <div className="completed-item-stats">
                      <span>Score : {stats.score}</span>
                      <span>
                        Corrections :{" "}
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
              <p className="completed-empty">
                Aucune activité terminée.
              </p>
            )}
          </div>
        </details>

        <details className="dashboard-archive-menu">
          <summary>
            Séances terminées ({completedSessionSources.length})
          </summary>

          <div className="completed-card-grid">
            {completedSessionSources.map((session) => {
              const stats = getSessionCompletionStats(
                session.sentenceIds
              );

              return (
                <Card
                  className="completed-item-card"
                  key={`archive-session-${session.id}`}
                >
                  <div className="completed-item-main">
                    <span className="activity-type-badge">Séance</span>
                    <strong>{session.name}</strong>

                    <div className="completed-item-stats">
                      <span>Score : {stats.score}</span>
                      <span>
                        Corrections :{" "}
                        {stats.successfulCorrections}/{stats.totalCorrections}
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    onClick={() =>
                      setSessionAssignmentStatus(
                        session.id,
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

            {completedSessionSources.length === 0 && (
              <p className="completed-empty">
                Aucune séance terminée.
              </p>
            )}
          </div>
        </details>

        <details className="dashboard-archive-menu">
          <summary>
            Compétitions terminées ({completedCompetitionResults.length})
          </summary>

          <div className="completed-card-grid">
            {completedCompetitionResults.map((result) => {
              const winner = result.standings.find(
                (standing) => standing.rank === 1
              );

              return (
                <Card
                  className="completed-item-card completed-competition-card"
                  key={`archive-competition-${result.id}`}
                >
                  <div className="completed-item-main">
                    <span className="activity-type-badge">
                      {result.sourceType === "session"
                        ? "Séance"
                        : "Activité"}
                    </span>
                    <strong>{result.title}</strong>

                    <div className="completed-item-stats">
                      <span>
                        {new Date(
                          result.completedAt
                        ).toLocaleDateString("fr-CA")}
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
      </section>

      <div className="analytics-grid">
        <Card>
          <span className="eyebrow">Historique</span>
          <h2>Dernières séances</h2>
          <div className="session-list">
            {sessions.slice(0, 8).map((session) => {
              const sentence = data.sentences.find((item) => item.id === session.sentenceId);
              return (
                <div className="session-row" key={session.sessionId}>
                  <div>
                    <strong>{sentence?.title ?? "Activité supprimée"}</strong>
                    <small>{new Date(session.createdAt).toLocaleString("fr-CA")}</small>
                  </div>
                  <span>+{session.points} points</span>
                </div>
              );
            })}
            {sessions.length === 0 && <p>Aucune séance enregistrée pour l’instant.</p>}
          </div>
        </Card>

        <Card>
          <span className="eyebrow">Notions</span>
          <h2>Points par code</h2>
          <div className="code-stat-list">
            {codeStats.map((stat) => (
              <div className="code-stat-row" key={stat.codeId}>
                <span className="code-chip">{stat.code}</span>
                <div>
                  <strong>{stat.name}</strong>
                  <small>{stat.attempts} attribution{stat.attempts > 1 ? "s" : ""}</small>
                </div>
                <span>{stat.points} pts</span>
              </div>
            ))}
            {codeStats.length === 0 && <p>Les statistiques apparaîtront après les premières séances.</p>}
          </div>
        </Card>
      </div>

      <div className="section-heading">
        <div><span className="eyebrow">Banque assignée</span><h2>Activités du groupe</h2></div>
        <Link href="/phrases">Voir toutes les activités</Link>
      </div>

      <div className="sentence-list">
        {assignedSentences.map((sentence) => (
          <Card key={sentence.id} className="sentence-card">
            <div className="sentence-card-top">
              <div>
                <span className="eyebrow">
                  {sentence.activityType === "word_classes"
                    ? `${getWordClassAnalysisTargetCount(sentence)} mot${
                        getWordClassAnalysisTargetCount(sentence) > 1
                          ? "s"
                          : ""
                      }`
                    : `${sentence.corrections.length} correction${
                        sentence.corrections.length > 1 ? "s" : ""
                      }`}
                </span>
                <h2>{sentence.title}</h2>
              </div>
              <div className="row-actions">
                <Link href={`/phrases/${sentence.id}/modifier`} aria-label="Modifier"><Pencil size={18} /></Link>
                <Link href={`/presentation/${group.id}/${sentence.id}`} aria-label="Présenter"><Play size={18} /></Link>
                <button
                  onClick={() => {
                    const existing = data.reviewStates.find((item) => item.groupId === group.id && item.sentenceId === sentence.id);
                    saveReviewState({
                      id: existing?.id ?? crypto.randomUUID(),
                      groupId: group.id,
                      sentenceId: sentence.id,
                      markedForReview: !(existing?.markedForReview ?? false),
                      difficultyScore: existing?.difficultyScore ?? 3,
                      lastReviewedAt: existing?.lastReviewedAt,
                      nextReviewAt: existing?.nextReviewAt
                    });
                  }}
                  aria-label="Marquer pour révision"
                  title="Marquer pour révision"
                >
                  ↻
                </button>
              </div>
            </div>
            <SentenceRenderer sentence={sentence} />
          </Card>
        ))}
        {assignedSentences.length === 0 && <Card><h2>Aucune activité assignée</h2><p>Crée une activité ou assigne une activité existante à ce groupe.</p></Card>}
      </div>
    </div>
  );
}
