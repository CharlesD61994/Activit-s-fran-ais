"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  Sparkles,
  Star,
  UsersRound
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { useAppStore } from "@/store/app-store";
import { getCompletedSentenceIds, getWeeklyPoints } from "@/lib/stats";
import {
  ClassroomGroupEmblem,
  ClassroomPointsMedal
} from "@/components/classroom-portal-ornaments";
import { groupAccentColor, groupShieldLabel } from "@/lib/group-colors";

export default function ClassePage() {
  const { data } = useAppStore();

  const groups = data.groups
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  const totalActiveActivities = groups.reduce(
    (sum, group) =>
      sum +
      data.sentences.filter(
        (sentence) =>
          sentence.assignedGroupIds.includes(group.id) &&
          !["completed", "archived"].includes(
            sentence.assignmentStatusByGroup?.[group.id] ?? "todo"
          )
      ).length,
    0
  );

  return (
    <div className="classroom-page classroom-portal-home">
      <section className="classroom-portal-home-hero">
        <div>
          <span className="classroom-portal-kicker">
            <Sparkles size={18} />
            Portail de classe
          </span>
          <h1>Choisis un groupe</h1>
          <p>
            Ouvre le tableau de bord du groupe pour lancer une activité,
            une séance ou une compétition.
          </p>
        </div>

        <div className="classroom-portal-overview">
          <Star size={28} />
          <div>
            <strong>{groups.length} groupes</strong>
            <span>{totalActiveActivities} activités disponibles</span>
          </div>
        </div>
      </section>

      <div className="classroom-portal-group-grid">
        {groups.map((group, index) => {
          const activities = data.sentences.filter((sentence) =>
            sentence.assignedGroupIds.includes(group.id)
          );
          const activeActivities = activities.filter(
            (activity) =>
              !["completed", "archived"].includes(
                activity.assignmentStatusByGroup?.[group.id] ?? "todo"
              )
          );
          const sessions = data.plannedSessions.filter(
            (session) => session.groupId === group.id
          );
          const teams = data.teams.filter((team) => team.groupId === group.id);
          const weeklyPoints = getWeeklyPoints(data.scoreEvents, group.id);
          const completed = getCompletedSentenceIds(
            data.scoreEvents,
            group.id
          ).length;
          const groupCode = groupShieldLabel(group.name, group.shieldLabel);
          const groupIndex = data.groups.findIndex((item) => item.id === group.id);

          return (
            <Link
              href={"/classe/groupes/" + group.id}
              key={group.id}
              className="classroom-portal-group-link"
            >
              <Card
                className={"classroom-portal-group-card accent-" + ((index % 4) + 1)}
                style={{
                  "--group-accent": groupAccentColor(groupIndex, group.accentColor)
                } as React.CSSProperties}
              >
                <div className="classroom-portal-group-card-main">
                  <ClassroomGroupEmblem label={groupCode} />

                  <div className="classroom-portal-group-copy">
                    <span className="classroom-portal-card-label">
                      Tableau de classe
                    </span>
                    <h2>{group.name}</h2>
                    <p>Activités, séances et compétition</p>
                  </div>

                  <span className="classroom-portal-open-icon">
                    <ArrowRight size={25} />
                  </span>
                </div>

                <div className="classroom-portal-group-metrics">
                  <span>
                    <BookOpenCheck size={19} />
                    <strong>{activeActivities.length}</strong>
                    activités
                  </span>
                  <span>
                    <CalendarDays size={19} />
                    <strong>{sessions.length}</strong>
                    séances
                  </span>
                  <span>
                    <UsersRound size={19} />
                    <strong>{teams.length}</strong>
                    équipes
                  </span>
                </div>

                <div className="classroom-portal-group-reward">
                  <ClassroomPointsMedal compact />
                  <div>
                    <strong>{group.totalPoints} points</strong>
                    <span>
                      +{weeklyPoints} cette semaine · {completed} activités réalisées
                    </span>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}

        {groups.length === 0 && (
          <Card className="classroom-portal-empty">
            <h2>Aucun groupe</h2>
            <p>Crée d’abord un groupe dans le tableau de bord.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
