import Link from "next/link";
import { ArrowRight, Layers3, MessageSquareText, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { ClassGroup, SchoolLevel } from "@/types";

export function LevelCard({ level, groups }: { level: SchoolLevel; groups: ClassGroup[] }) {
  const points = groups.reduce((sum, group) => sum + group.totalPoints, 0);
  const phrases = groups.reduce((sum, group) => sum + group.sentenceCount, 0);

  return (
    <Link href={`/niveaux/${level.id}`} className="card-link">
      <Card>
        <div className="card-heading">
          <div>
            <span className="eyebrow">Niveau</span>
            <h2>{level.name}</h2>
          </div>
          <ArrowRight aria-hidden="true" />
        </div>
        <div className="stats-row">
          <span><Layers3 size={17} /> {groups.length} groupe{groups.length > 1 ? "s" : ""}</span>
          <span><MessageSquareText size={17} /> {phrases} phrases</span>
          <span><Trophy size={17} /> {points} points</span>
        </div>
      </Card>
    </Link>
  );
}
