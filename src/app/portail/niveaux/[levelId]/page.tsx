"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, UsersRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useAppStore } from "@/store/app-store";
import { getTheme } from "@/themes/themes";

export default function StudentLevelPage({
  params
}: {
  params: Promise<{ levelId: string }>;
}) {
  const { levelId } = use(params);
  const { data } = useAppStore();

  const level = data.levels.find((item) => item.id === levelId);
  const groups = data.groups.filter(
    (group) =>
      group.levelId === levelId &&
      group.studentPortalEnabled !== false
  );

  if (!level) {
    return (
      <div className="student-page">
        <Card>
          <h1>Niveau introuvable</h1>
          <Link href="/portail">Retour au portail</Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="student-page">
      <Link href="/portail" className="student-back-link">
        <ArrowLeft size={18} />
        Retour aux niveaux
      </Link>

      <section className="student-hero compact">
        <span className="student-kicker">Niveau</span>
        <h1>{level.name}</h1>
        <p>Choisis ton groupe.</p>
      </section>

      <div className="student-card-grid">
        {groups.map((group) => {
          const theme = getTheme(group.themeId);
          const activityCount = data.sentences.filter((sentence) =>
            sentence.assignedGroupIds.includes(group.id)
          ).length;

          return (
            <Link
              key={group.id}
              href={`/portail/groupes/${group.id}`}
              className="student-card-link"
            >
              <Card
                className="student-group-card"
                data-preview-theme={group.themeId}
              >
                <div className="student-card-icon">
                  <UsersRound size={28} />
                </div>
                <div>
                  <span className="student-card-label">{theme.name}</span>
                  <h2>{group.name}</h2>
                  <p>{group.description ?? "Groupe"}</p>
                </div>
                <div className="student-card-meta">
                  <span>{activityCount} activité{activityCount > 1 ? "s" : ""}</span>
                  <ArrowRight size={22} />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
