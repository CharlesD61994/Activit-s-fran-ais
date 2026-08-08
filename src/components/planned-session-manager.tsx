"use client";

import { useState } from "react";
import { CalendarPlus, Pencil, Play, Save, Trash2, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ClassGroup, PlannedSession, Sentence } from "@/types";

type Props = {
  group: ClassGroup;
  sessions: PlannedSession[];
  sentences: Sentence[];
  onSave: (session: PlannedSession) => void;
  onDelete: (sessionId: string) => void;
};

export function PlannedSessionManager({
  group,
  sessions,
  sentences,
  onSave,
  onDelete
}: Props) {
  const [draft, setDraft] = useState<PlannedSession | null>(null);

  function beginNew() {
    const now = new Date().toISOString();
    setDraft({
      id: crypto.randomUUID(),
      groupId: group.id,
      title: "",
      scheduledDate: new Date().toISOString().slice(0, 10),
      sentenceIds: [],
      status: "planned",
      currentSentenceIndex: 0,
      createdAt: now,
      updatedAt: now
    });
  }

  function toggleSentence(sentenceId: string) {
    if (!draft) return;
    setDraft({
      ...draft,
      sentenceIds: draft.sentenceIds.includes(sentenceId)
        ? draft.sentenceIds.filter((id) => id !== sentenceId)
        : [...draft.sentenceIds, sentenceId]
    });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft?.title.trim() || draft.sentenceIds.length === 0) return;
    onSave({
      ...draft,
      title: draft.title.trim(),
      updatedAt: new Date().toISOString()
    });
    setDraft(null);
  }

  return (
    <Card>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Planification</span>
          <h2>Séances préparées</h2>
        </div>
        <Button onClick={beginNew}><CalendarPlus size={18} /> Préparer une séance</Button>
      </div>

      <div className="planned-session-list">
        {sessions.map((session) => {
          const firstSentence = sentences.find((item) => item.id === session.sentenceIds[0]);
          return (
            <div className="planned-session-row" key={session.id}>
              <div>
                <strong>{session.title}</strong>
                <small>
                  {new Date(`${session.scheduledDate}T12:00:00`).toLocaleDateString("fr-CA")}
                  {" · "}
                  {session.sentenceIds.length} activité{session.sentenceIds.length > 1 ? "s" : ""}
                </small>
              </div>
              <span className={`status-pill session-${session.status}`}>
                {session.status === "planned" ? "Planifiée" : session.status === "in_progress" ? "En cours" : "Terminée"}
              </span>
              <div className="row-actions">
                {firstSentence && (
                  <Link href={`/presentation/${group.id}/${firstSentence.id}?plan=${session.id}`} aria-label="Démarrer">
                    <Play size={17} />
                  </Link>
                )}
                <button onClick={() => setDraft(session)} aria-label="Modifier"><Pencil size={17} /></button>
                <button onClick={() => onDelete(session.id)} aria-label="Supprimer"><Trash2 size={17} /></button>
              </div>
            </div>
          );
        })}
        {sessions.length === 0 && <p>Aucune séance planifiée.</p>}
      </div>

      {draft && (
        <div className="modal-backdrop">
          <Card className="modal-card" role="dialog" aria-modal="true">
            <form onSubmit={submit}>
              <div className="modal-heading">
                <div>
                  <span className="eyebrow">Séance</span>
                  <h2>{sessions.some((item) => item.id === draft.id) ? "Modifier" : "Préparer"}</h2>
                </div>
                <button type="button" className="icon-control" onClick={() => setDraft(null)}><X size={20} /></button>
              </div>

              <div className="form-grid">
                <label>Titre
                  <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
                </label>
                <label>Date
                  <input type="date" value={draft.scheduledDate} onChange={(event) => setDraft({ ...draft, scheduledDate: event.target.value })} />
                </label>
              </div>

              <div>
                <span className="eyebrow">Activités de la séance</span>
                <div className="sentence-selector">
                  {sentences.filter((sentence) => sentence.levelId === group.levelId).map((sentence) => (
                    <label className="check-card" key={sentence.id}>
                      <input
                        type="checkbox"
                        checked={draft.sentenceIds.includes(sentence.id)}
                        onChange={() => toggleSentence(sentence.id)}
                      />
                      <span>{sentence.title}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-actions">
                <Button type="submit"><Save size={18} /> Enregistrer</Button>
                <Button type="button" variant="secondary" onClick={() => setDraft(null)}>Annuler</Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </Card>
  );
}
