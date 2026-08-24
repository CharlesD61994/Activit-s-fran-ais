"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronRight,
  FileText,
  Flag,
  Play,
  Pencil,
  Sparkles,
  Star,
  Target,
  Trophy,
  UsersRound,
  X
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ActivityObjectiveBadges,
  getActivityObjectiveKey
} from "@/components/activity-objective-badges";
import { useAppStore } from "@/store/app-store";
import { getWordClassActivityPointTotal } from "@/lib/activity-types";
import { groupAccentColor, groupShieldLabel } from "@/lib/group-colors";
import { getWeeklyPoints } from "@/lib/stats";
import {
  ClassroomGroupEmblem,
  ClassroomPointsMedal
} from "@/components/classroom-portal-ornaments";

type PortalTab = "activities" | "sessions" | "competition";

export default function ClassroomGroupPage({
  params
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = use(params);
  const {
    data,
    savePlannedSession,
    setActivityAssignmentStatus,
    setSessionAssignmentStatus,
    updateGroupObjective
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<PortalTab>("activities");
  const [showAllCompetitionScores, setShowAllCompetitionScores] =
    useState(false);
  const [objectiveEditorOpen, setObjectiveEditorOpen] = useState(false);
  const [objectiveDraft, setObjectiveDraft] = useState("");
  const [objectivePointsDraft, setObjectivePointsDraft] = useState("10");

  const group = data.groups.find((item) => item.id === groupId);
  const groupIndex = data.groups.findIndex((item) => item.id === groupId);
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
    sessionSource(planned)?.assignmentStatusByGroup?.[groupId] ??
    (planned.status === "completed"
      ? "completed"
      : planned.status === "in_progress"
        ? "in_progress"
        : "todo");

  const sessionResumeActivity = (planned: typeof sessions[number]) => {
    const status = sessionStatus(planned);
    const resumeIndex =
      status === "in_progress"
        ? Math.min(
            Math.max(0, planned.currentSentenceIndex),
            Math.max(0, planned.sentenceIds.length - 1)
          )
        : 0;

    return data.sentences.find(
      (activity) => activity.id === planned.sentenceIds[resumeIndex]
    );
  };

  const activeActivities = activities.filter(
    (activity) =>
      !["completed", "archived"].includes(activityStatus(activity))
  );
  const completedActivities = activities.filter(
    (activity) => activityStatus(activity) === "completed"
  );

  const activeSessions = sessions.filter(
    (session) =>
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

  if (!group) {
    return (
      <div className="classroom-page">
        <Card>
          <h1>Groupe introuvable</h1>
          <Link href="/classe">Retour aux groupes</Link>
        </Card>
      </div>
    );
  }

  const weeklyPoints = getWeeklyPoints(data.scoreEvents, group.id);
  const objectiveTargetPoints = Math.max(1, group.weeklyObjectivePoints ?? 10);
  const objectiveTitle = group.weeklyObjective?.trim() || "Atteindre 10 points";
  const objectiveProgress = Math.min(100, (weeklyPoints / objectiveTargetPoints) * 100);

  function openObjectiveEditor() {
    setObjectiveDraft(objectiveTitle);
    setObjectivePointsDraft(String(objectiveTargetPoints));
    setObjectiveEditorOpen(true);
  }

  function saveObjective() {
    const objective = objectiveDraft.trim();
    if (!objective) return;
    const parsedPoints = Number.parseInt(objectivePointsDraft, 10);
    const targetPoints = Number.isFinite(parsedPoints)
      ? Math.min(999, Math.max(1, parsedPoints))
      : 10;
    updateGroupObjective(groupId, objective, targetPoints);
    setObjectiveEditorOpen(false);
  }
  const completedCompetitionResults = data.competitionResults
    .filter((result) => result.groupId === group.id)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));

  function activityPointTotal(activity: typeof activities[number]) {
    if (activity.activityType === "word_classes") {
      return getWordClassActivityPointTotal(activity);
    }

    const correctionPoints = activity.corrections.reduce(
      (sum, correction) => sum + correction.points,
      0
    );

    if (correctionPoints > 0) return correctionPoints;

    const interactiveTargets = activity.grammarAnnotations?.length ?? 0;
    return Math.max(1, interactiveTargets);
  }

  function activityScore(activityId: string) {
    return data.scoreEvents
      .filter(
        (event) =>
          event.groupId === groupId &&
          event.sentenceId === activityId
      )
      .reduce((sum, event) => sum + event.points, 0);
  }

  function renderActivityCard(activity: typeof activities[number]) {
    const status = activityStatus(activity);
    const totalPoints = activityPointTotal(activity);
    const score = activityScore(activity.id);
    const progress =
      totalPoints > 0
        ? Math.min(100, Math.round((score / totalPoints) * 100))
        : 0;
    const objectiveKey = getActivityObjectiveKey(activity);

    return (
      <Card
        className={
          "classroom-mission-card activity-accent-" +
          objectiveKey
        }
        key={activity.id}
      >
        <div className="classroom-mission-band">
          <ActivityObjectiveBadges sentence={activity} primaryOnly />
          <span className={"assignment-status-pill status-" + status}>
            {status === "in_progress" ? "En cours" : "À faire"}
          </span>
        </div>

        <div className="classroom-mission-body">
          <div className="classroom-mission-icon">
            {objectiveKey === "worksheet" ? (
              <FileText size={28} />
            ) : objectiveKey === "mixed_grammar" ? (
              <Sparkles size={28} />
            ) : objectiveKey === "functions" ? (
              <Flag size={28} />
            ) : (
              <BookOpen size={28} />
            )}
          </div>

          <div className="classroom-mission-copy">
            <h3>{activity.title}</h3>
            <ActivityObjectiveBadges sentence={activity} secondaryOnly />
          </div>
        </div>

        <div className="classroom-mission-footer">
          <div className="classroom-mission-progress">
            <span>
              {status === "in_progress"
                ? score > 0
                  ? progress + " % complété"
                  : "Activité commencée"
                : "Prêt à commencer"}
            </span>
            <span className="classroom-mission-progress-track">
              <span style={{ width: progress + "%" }} />
            </span>
          </div>

          <span className="classroom-mission-points">
            <Star size={18} fill="currentColor" />
            {totalPoints} point{totalPoints > 1 ? "s" : ""} à gagner
          </span>

          <Link
            href={
              "/presentation/" +
              groupId +
              "/" +
              activity.id +
              "?from=classe"
            }
          >
            <Button>
              {status === "in_progress" ? "Continuer" : "Lancer"}
              <ChevronRight size={18} />
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div
      className="classroom-page classroom-group-dashboard"
      style={{
        "--group-accent": groupAccentColor(groupIndex, group.accentColor)
      } as React.CSSProperties}
    >
      <section className="classroom-dashboard-hero">
        <Link href="/classe" className="classroom-dashboard-back">
          <ArrowLeft size={20} />
          Tous les groupes
        </Link>

        <div className="classroom-dashboard-identity">
          <ClassroomGroupEmblem
            label={groupShieldLabel(group.name, group.shieldLabel)}
            compact
          />
          <div>
            <span className="classroom-portal-kicker">
              Tableau de classe
            </span>
            <h1>{group.name}</h1>
            <p>Activités, séances et défis de la classe</p>
          </div>
        </div>

        <div className="classroom-dashboard-points">
          <ClassroomPointsMedal />
          <div>
            <strong>{group.totalPoints} points</strong>
            <span>+{weeklyPoints} cette semaine</span>
          </div>
        </div>
      </section>

      <nav className="classroom-dashboard-tabs" aria-label="Sections du groupe">
        <button
          type="button"
          className={activeTab === "activities" ? "active" : ""}
          onClick={() => setActiveTab("activities")}
          aria-pressed={activeTab === "activities"}
        >
          <BookOpen size={24} />
          <span>Activités</span>
          <b>{activeActivities.length}</b>
        </button>
        <button
          type="button"
          className={activeTab === "sessions" ? "active" : ""}
          onClick={() => setActiveTab("sessions")}
          aria-pressed={activeTab === "sessions"}
        >
          <CalendarDays size={24} />
          <span>Séances</span>
          <b>{activeSessions.length}</b>
        </button>
        <button
          type="button"
          className={activeTab === "competition" ? "active" : ""}
          onClick={() => setActiveTab("competition")}
          aria-pressed={activeTab === "competition"}
        >
          <Trophy size={24} />
          <span>Compétition amicale</span>
          <b>{competitionActivities.length + competitionSessions.length}</b>
        </button>
      </nav>

      {activeTab === "activities" && (
        <div className="classroom-dashboard-panel">
          <section className="classroom-dashboard-section">
            <div className="classroom-dashboard-section-heading">
              <div>
                <span className="classroom-dashboard-section-icon">
                  <Sparkles size={21} />
                </span>
                <h2>Activités</h2>
              </div>
              <span>{activeActivities.length}</span>
            </div>

            <div className="classroom-mission-grid">
              {activeActivities.slice(0, 2).map(renderActivityCard)}

              <Card className={`classroom-objective-card ${group.weeklyObjective ? "is-configured" : ""}`}>
                <div className="classroom-objective-pattern" aria-hidden="true" />
                <div className="classroom-objective-heading">
                  <span>Objectif de la semaine</span>
                  <span className="classroom-objective-edit-label"><Pencil size={15} /> Modifier</span>
                </div>
                <div className="classroom-objective-center">
                  <div
                    className={`classroom-objective-wheel ${weeklyPoints >= objectiveTargetPoints ? "is-complete" : ""}`}
                    style={{ "--objective-progress": `${objectiveProgress * 3.6}deg` } as React.CSSProperties}
                    aria-label={`${Math.round(objectiveProgress)} % de l’objectif atteint`}
                  >
                    <span className="classroom-objective-wheel-ticks" aria-hidden="true" />
                    <span className="classroom-objective-wheel-core">
                      <Target size={28} aria-hidden="true" />
                      <strong>{Math.round(objectiveProgress)}%</strong>
                    </span>
                  </div>
                  <strong className="classroom-objective-count">
                    {Math.min(weeklyPoints, objectiveTargetPoints)} / {objectiveTargetPoints} points
                  </strong>
                </div>
                <button
                  type="button"
                  className="classroom-objective-edit-trigger"
                  onClick={openObjectiveEditor}
                  aria-label="Modifier l’objectif de la semaine"
                />
              </Card>

              {activeActivities.slice(2).map(renderActivityCard)}
              {activeActivities.length === 0 && (
                <Card className="classroom-dashboard-empty">
                  <BookOpen size={34} />
                  <h3>Aucune activité assignée</h3>
                  <p>Assigne une activité à ce groupe dans le tableau de bord.</p>
                </Card>
              )}
            </div>
          </section>

          <details className="classroom-dashboard-completed">
            <summary>
              Activités terminées
              <span>{completedActivities.length}</span>
            </summary>
            <div className="completed-card-grid">
              {completedActivities.map((activity) => (
                <Card className="completed-item-card" key={activity.id}>
                  <div className="completed-item-main">
                    <ActivityObjectiveBadges sentence={activity} />
                    <strong>{activity.title}</strong>
                    <span className="classroom-completed-score">
                      <Star size={16} fill="currentColor" />
                      {activityScore(activity.id)} points obtenus
                    </span>
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
              ))}
              {completedActivities.length === 0 && (
                <p className="completed-empty">Aucune activité terminée.</p>
              )}
            </div>
          </details>
        </div>
      )}

      {activeTab === "sessions" && (
        <div className="classroom-dashboard-panel">
          <section className="classroom-dashboard-section">
            <div className="classroom-dashboard-section-heading">
              <div>
                <span className="classroom-dashboard-section-icon session">
                  <CalendarDays size={21} />
                </span>
                <h2>Séances disponibles</h2>
              </div>
              <span>{activeSessions.length}</span>
            </div>

            <div className="classroom-session-dashboard-grid">
              {activeSessions.map((session) => {
                const resumeActivity = sessionResumeActivity(session);
                const status = sessionStatus(session);

                return (
                  <Card className="classroom-dashboard-session-card" key={session.id}>
                    <div className="classroom-dashboard-session-date">
                      <CalendarDays size={26} />
                      <span>
                        {new Date(
                          session.scheduledDate + "T12:00:00"
                        ).toLocaleDateString("fr-CA", {
                          day: "numeric",
                          month: "short"
                        })}
                      </span>
                    </div>
                    <div>
                      <span className={"assignment-status-pill status-" + status}>
                        {status === "in_progress" ? "En cours" : "À faire"}
                      </span>
                      <h3>{session.title}</h3>
                      <p>
                        {session.sentenceIds.length} activité
                        {session.sentenceIds.length > 1 ? "s" : ""}
                      </p>
                    </div>
                    {resumeActivity && (
                      <Link
                        href={
                          "/presentation/" +
                          group.id +
                          "/" +
                          resumeActivity.id +
                          "?plan=" +
                          session.id +
                          "&from=classe"
                        }
                      >
                        <Button>
                          <Play size={18} />
                          {status === "in_progress" ? "Reprendre" : "Démarrer"}
                        </Button>
                      </Link>
                    )}
                  </Card>
                );
              })}

              {activeSessions.length === 0 && (
                <Card className="classroom-dashboard-empty">
                  <CalendarDays size={34} />
                  <h3>Aucune séance</h3>
                  <p>Prépare une séance dans la page d’administration.</p>
                </Card>
              )}
            </div>
          </section>

          <details className="classroom-dashboard-completed">
            <summary>
              Séances terminées
              <span>{completedSessions.length}</span>
            </summary>
            <div className="completed-card-grid">
              {completedSessions.map((session) => (
                <Card className="completed-item-card" key={session.id}>
                  <div className="completed-item-main">
                    <span className="activity-type-badge objective-functions">
                      Séance
                    </span>
                    <strong>{session.title}</strong>
                    <span>
                      {session.sentenceIds.length} activités réalisées
                    </span>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (session.sourceSessionId) {
                        setSessionAssignmentStatus(
                          session.sourceSessionId,
                          group.id,
                          "todo",
                          0
                        );
                      }

                      savePlannedSession({
                        ...session,
                        status: "planned",
                        currentSentenceIndex: 0,
                        updatedAt: new Date().toISOString()
                      });
                    }}
                  >
                    Rejouer
                  </Button>
                </Card>
              ))}
            </div>
          </details>
        </div>
      )}

      {activeTab === "competition" && (
        <div className="classroom-dashboard-panel competition-dashboard">
          <section className="classroom-competition-hero">
            <div>
              <span className="classroom-portal-kicker">
                <Trophy size={18} />
                Classement cumulatif
              </span>
              <h2>Compétition amicale</h2>
              <p>Les équipes accumulent leurs points au fil des défis.</p>
            </div>
            <button
              type="button"
              className="competition-ranking-link"
              onClick={() => setShowAllCompetitionScores(true)}
            >
              Voir le classement complet
            </button>
          </section>

          <div className="classroom-competition-podium">
            {cumulativeCompetitionScores.slice(0, 3).map((team) => (
              <Card
                className={"classroom-competition-team rank-" + team.rank}
                key={team.teamId}
              >
                <span className="classroom-competition-medal">
                  {team.rank === 1 ? "🥇" : team.rank === 2 ? "🥈" : "🥉"}
                </span>
                <span className="classroom-competition-icon">
                  {team.teamIcon ?? "⭐"}
                </span>
                <strong>{team.teamName}</strong>
                <b>{team.score} pts</b>
              </Card>
            ))}
          </div>

          <section className="classroom-dashboard-section">
            <div className="classroom-dashboard-section-heading">
              <div>
                <span className="classroom-dashboard-section-icon competition">
                  <Flag size={21} />
                </span>
                <h2>Défis à faire</h2>
              </div>
              <span>
                {competitionActivities.length + competitionSessions.length}
              </span>
            </div>

            <div className="competition-organic-items">
              {competitionActivities.map((activity) => (
                <Card
                  className="competition-activity-card"
                  key={"activity-" + activity.id}
                >
                  <div>
                    <ActivityObjectiveBadges sentence={activity} />
                    <h3>{activity.title}</h3>
                    <small>Une activité en compétition</small>
                  </div>
                  <Link
                    href={
                      "/presentation/" +
                      group.id +
                      "/" +
                      activity.id +
                      "?from=classe&competition=activity&source=" +
                      activity.id
                    }
                  >
                    <Button>
                      <Trophy size={18} />
                      Commencer
                    </Button>
                  </Link>
                </Card>
              ))}

              {competitionSessions.map((session) => {
                const planned = data.plannedSessions.find(
                  (item) =>
                    item.sourceSessionId === session.id &&
                    item.groupId === group.id
                );
                const resumeActivity = planned
                  ? sessionResumeActivity(planned)
                  : data.sentences.find(
                      (activity) => activity.id === session.sentenceIds[0]
                    );
                if (!resumeActivity) return null;

                return (
                  <Card
                    className="competition-activity-card"
                    key={"session-" + session.id}
                  >
                    <div>
                      <span className="activity-type-badge objective-agreements">
                        Séance
                      </span>
                      <h3>{session.name}</h3>
                      <small>
                        {session.sentenceIds.length} activités
                      </small>
                    </div>
                    <Link
                      href={
                        "/presentation/" +
                        group.id +
                        "/" +
                        resumeActivity.id +
                        "?from=classe&competition=session&source=" +
                        session.id +
                        (planned ? "&plan=" + planned.id : "")
                      }
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
                <Card className="classroom-dashboard-empty">
                  <Flag size={34} />
                  <h3>Aucun défi assigné</h3>
                </Card>
              )}
            </div>
          </section>

          <section className="classroom-competition-teams">
            <div className="classroom-dashboard-section-heading">
              <div>
                <span className="classroom-dashboard-section-icon team">
                  <UsersRound size={21} />
                </span>
                <h2>Équipes</h2>
              </div>
              <span>{teams.length}</span>
            </div>
            <div className="competition-team-list">
              {teams.map((team) => (
                <div className="competition-team-line" key={team.id}>
                  <span className="classroom-team-icon">
                    {team.icon ?? "⭐"}
                  </span>
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
            </div>
          </section>

          <details className="classroom-dashboard-completed">
            <summary>
              Compétitions terminées
              <span>{completedCompetitionResults.length}</span>
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
                      <strong>{result.title}</strong>
                      <span>
                        {winner
                          ? "🏆 " +
                            (winner.teamIcon ?? "⭐") +
                            " " +
                            winner.teamName +
                            " · " +
                            winner.score +
                            " points"
                          : "Aucun résultat"}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </details>
        </div>
      )}

      {objectiveEditorOpen && (
        <div className="modal-backdrop">
          <Card
            className="modal-card classroom-objective-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="objective-modal-title"
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                saveObjective();
              }}
            >
              <div className="modal-heading">
                <div>
                  <span className="eyebrow">Objectif de la semaine</span>
                  <h2 id="objective-modal-title">Choisir un objectif</h2>
                  <p>Écris un objectif motivant et détermine le nombre de points à atteindre.</p>
                </div>
                <button
                  type="button"
                  className="icon-control"
                  onClick={() => setObjectiveEditorOpen(false)}
                  aria-label="Fermer"
                >
                  <X size={20} />
                </button>
              </div>

              <label className="classroom-objective-field">
                <span>Objectif affiché</span>
                <input
                  value={objectiveDraft}
                  onChange={(event) => setObjectiveDraft(event.target.value)}
                  placeholder="Ex. : Réussir 3 activités sans erreur"
                  maxLength={90}
                  autoFocus
                  required
                />
              </label>

              <label className="classroom-objective-field classroom-objective-points-field">
                <span>Points à atteindre cette semaine</span>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={objectivePointsDraft}
                  onChange={(event) => setObjectivePointsDraft(event.target.value)}
                  required
                />
              </label>

              <div className="classroom-objective-modal-actions">
                <Button type="button" variant="secondary" onClick={() => setObjectiveEditorOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit">
                  Enregistrer l’objectif
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
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
                <span className="eyebrow">Compétition amicale</span>
                <h2>Classement de toutes les équipes</h2>
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
