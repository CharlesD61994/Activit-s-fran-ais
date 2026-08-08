"use client";

import Link from "next/link";
import { ArrowRight, BookOpenCheck, CalendarDays, UsersRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useAppStore } from "@/store/app-store";
import { getCompletedSentenceIds, getWeeklyPoints } from "@/lib/stats";

export default function ClassePage() {
  const { data } = useAppStore();

  const groups = data.groups
    .slice()
    .sort((a, b) => {
      const levelA = data.levels.find((level) => level.id === a.levelId)?.order ?? 99;
      const levelB = data.levels.find((level) => level.id === b.levelId)?.order ?? 99;
      return levelA - levelB || a.name.localeCompare(b.name, "fr");
    });

  return (
    <div className="classroom-page">
      <section className="classroom-intro">
        <h1>Choisir un groupe</h1>
      </section>

      <div className="classroom-group-grid">
        {groups.map((group) => {
          const level = data.levels.find((item) => item.id === group.levelId);
          const activities = data.sentences.filter((sentence) =>
            sentence.assignedGroupIds.includes(group.id)
          );
          const sessions = data.plannedSessions.filter(
            (session) => session.groupId === group.id
          );
          const teams = data.teams.filter((team) => team.groupId === group.id);
          const weeklyPoints = getWeeklyPoints(data.scoreEvents, group.id);
          const completed = getCompletedSentenceIds(data.scoreEvents, group.id).length;

          return (
            <Link
              href={`/classe/groupes/${group.id}`}
              key={group.id}
              className="classroom-card-link"
            >
              <Card className="classroom-group-card" data-preview-theme={group.themeId}>
                <div>
                  <span className="eyebrow">{level?.name ?? "Niveau"}</span>
                  <h2>{group.name}</h2>
                  {group.description && <p>{group.description}</p>}
                </div>

                <div className="classroom-group-summary">
                  <span><BookOpenCheck size={17} /> {activities.length} activités</span>
                  <span><CalendarDays size={17} /> {sessions.length} séances</span>
                  <span><UsersRound size={17} /> {teams.length} équipes</span>
                </div>

                <div className="classroom-group-footer">
                  <div>
                    <strong>{weeklyPoints}</strong>
                    <span>points cette semaine</span>
                  </div>
                  <div>
                    <strong>{completed}</strong>
                    <span>activités réalisées</span>
                  </div>
                  <ArrowRight size={23} />
                </div>
              </Card>
            </Link>
          );
        })}

        {groups.length === 0 && (
          <Card>
            <h2>Aucun groupe</h2>
            <p>Crée d’abord un groupe dans le tableau de bord.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
