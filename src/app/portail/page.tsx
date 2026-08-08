"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Layers3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useAppStore } from "@/store/app-store";

export default function StudentPortalHomePage() {
  const { data } = useAppStore();

  const visibleLevels = data.levels
    .filter((level) =>
      data.groups.some(
        (group) =>
          group.levelId === level.id &&
          group.studentPortalEnabled !== false
      )
    )
    .sort((a, b) => a.order - b.order);

  return (
    <div className="student-page">
      <section className="student-hero">
        <span className="student-kicker">Portail élève</span>
        <h1>Choisis ton niveau</h1>
        <p>Accède rapidement à ton groupe et aux activités disponibles.</p>
      </section>

      <div className="student-card-grid">
        {visibleLevels.map((level) => {
          const groups = data.groups.filter(
            (group) =>
              group.levelId === level.id &&
              group.studentPortalEnabled !== false
          );
          const sentenceCount = data.sentences.filter(
            (sentence) => sentence.levelId === level.id
          ).length;

          return (
            <Link
              key={level.id}
              href={`/portail/niveaux/${level.id}`}
              className="student-card-link"
            >
              <Card className="student-level-card">
                <div className="student-card-icon">
                  <Layers3 size={28} />
                </div>
                <div>
                  <span className="student-card-label">Niveau</span>
                  <h2>{level.name}</h2>
                  <p>{groups.length} groupe{groups.length > 1 ? "s" : ""}</p>
                </div>
                <div className="student-card-meta">
                  <span><BookOpen size={17} /> {sentenceCount} activités</span>
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
