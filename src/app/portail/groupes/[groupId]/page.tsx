"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  LockKeyhole,
  Play,
  RefreshCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ActivityObjectiveBadges } from "@/components/activity-objective-badges";
import { useAppStore } from "@/store/app-store";

export default function StudentGroupPage({
  params
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = use(params);
  const { data } = useAppStore();
  const group = data.groups.find((item) => item.id === groupId);
  const level = data.levels.find((item) => item.id === group?.levelId);

  const [code, setCode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!group?.studentAccessCode) return;

    const stored = window.sessionStorage.getItem(`portal-unlocked-${group.id}`);
    if (stored === "true") setUnlocked(true);
  }, [group]);

  if (!group || !level || group.studentPortalEnabled === false) {
    return (
      <div className="student-page">
        <Card>
          <h1>Groupe introuvable</h1>
          <Link href="/portail">Retour au portail</Link>
        </Card>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="student-page">
        <Link href={`/portail/niveaux/${level.id}`} className="student-back-link">
          <ArrowLeft size={18} />
          Retour aux groupes
        </Link>

        <Card className="student-access-card">
          <div className="student-access-icon">
            <LockKeyhole size={32} />
          </div>
          <span className="student-kicker">Accès au groupe</span>
          <h1>{group.name}</h1>
          <p>
            {group.studentAccessCode
              ? "Entre le code donné par ton enseignant."
              : "Le code d’accès de ce groupe n’est pas encore configuré."}
          </p>

          {group.studentAccessCode ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (code.trim() === group.studentAccessCode) {
                  window.sessionStorage.setItem(`portal-unlocked-${group.id}`, "true");
                  setUnlocked(true);
                  setError("");
                } else {
                  setError("Le code est incorrect.");
                }
              }}
            >
              <label>
                Code d’accès
                <input
                  inputMode="numeric"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="Ex. 1010"
                />
              </label>
              {error && <div className="form-message">{error}</div>}
              <Button type="submit">Entrer</Button>
            </form>
          ) : (
            <Link href={`/portail/niveaux/${level.id}`} className="student-back-link">
              Retour aux groupes
            </Link>
          )}
        </Card>
      </div>
    );
  }

  const assignedSentences = data.sentences.filter((sentence) =>
    sentence.assignedGroupIds.includes(group.id)
  );

  const plannedSessions = data.plannedSessions
    .filter((session) => session.groupId === group.id)
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));

  const reviewItems = data.reviewStates.filter(
    (item) => item.groupId === group.id && item.markedForReview
  );

  const firstSentence = assignedSentences[0];

  return (
    <div className="student-group-root">
      <div className="student-page">
        <Link href={`/portail/niveaux/${level.id}`} className="student-back-link">
          <ArrowLeft size={18} />
          Retour aux groupes
        </Link>

        <section className="student-hero compact">
          <span className="student-kicker">{level.name}</span>
          <h1>{group.name}</h1>
          <p>{group.description ?? "Activités du groupe"}</p>
        </section>

        <div className="student-action-grid">
          {firstSentence && (
            <Link
              href={`/presentation/${group.id}/${firstSentence.id}?from=portail`}
              className="student-action-link"
            >
              <Card className="student-action-card featured">
                <Play size={32} />
                <div>
                  <ActivityObjectiveBadges sentence={firstSentence} />
                  <h2>{firstSentence.title}</h2>
                  <p>Activité principale</p>
                </div>
              </Card>
            </Link>
          )}

          {plannedSessions.map((session) => {
            const first = data.sentences.find((item) => item.id === session.sentenceIds[0]);
            if (!first) return null;

            return (
              <Link
                key={session.id}
                href={`/presentation/${group.id}/${first.id}?plan=${session.id}&from=portail`}
                className="student-action-link"
              >
                <Card className="student-action-card">
                  <CalendarDays size={30} />
                  <div>
                    <span className="student-card-label">
                      {new Date(`${session.scheduledDate}T12:00:00`).toLocaleDateString("fr-CA")}
                    </span>
                    <h2>{session.title}</h2>
                    <p>{session.sentenceIds.length} phrase{session.sentenceIds.length > 1 ? "s" : ""}</p>
                  </div>
                </Card>
              </Link>
            );
          })}

          {reviewItems.length > 0 && (
            <Card className="student-action-card muted">
              <RefreshCcw size={30} />
              <div>
                <span className="student-card-label">Révision</span>
                <h2>À revoir</h2>
                <p>{reviewItems.length} phrase{reviewItems.length > 1 ? "s" : ""}</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
