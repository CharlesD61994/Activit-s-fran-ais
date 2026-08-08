"use client";

import { useState } from "react";
import {
  CalendarPlus,
  Check,
  Pencil,
  Save,
  Trash2,
  UsersRound,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getActivityTypeLabel } from "@/lib/activity-types";
import type {
  ClassGroup,
  SchoolLevel,
  Sentence,
  SentenceCollection
} from "@/types";

type Props = {
  sessions: SentenceCollection[];
  activities: Sentence[];
  levels: SchoolLevel[];
  groups: ClassGroup[];
  onSave: (session: SentenceCollection) => void;
  onDelete: (sessionId: string) => void;
  onToggleCompetition: (sessionId: string) => void;
};

export function SessionManager({
  sessions,
  activities,
  levels,
  groups,
  onSave,
  onDelete,
  onToggleCompetition
}: Props) {
  const [draft, setDraft] = useState<SentenceCollection | null>(null);

  function beginNew() {
    const now = new Date().toISOString();

    setDraft({
      id: crypto.randomUUID(),
      levelId: levels[0]?.id ?? "",
      name: "",
      description: "",
      sentenceIds: [],
      assignedGroupIds: [],
      scheduledDate: new Date().toISOString().slice(0, 10),
      createdAt: now,
      updatedAt: now
    });
  }

  function toggleActivity(activityId: string) {
    if (!draft) return;

    setDraft({
      ...draft,
      sentenceIds: draft.sentenceIds.includes(activityId)
        ? draft.sentenceIds.filter((id) => id !== activityId)
        : [...draft.sentenceIds, activityId]
    });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();

    if (!draft?.name.trim() || !draft.levelId || draft.sentenceIds.length === 0) {
      return;
    }

    onSave({
      ...draft,
      name: draft.name.trim(),
      description: draft.description?.trim() || undefined,
      assignedGroupIds: draft.assignedGroupIds ?? [],
      updatedAt: new Date().toISOString()
    });

    setDraft(null);
  }

  function toggleGroupAssignment(session: SentenceCollection, groupId: string) {
    const assignedGroupIds = session.assignedGroupIds ?? [];
    const nextAssignedGroupIds = assignedGroupIds.includes(groupId)
      ? assignedGroupIds.filter((id) => id !== groupId)
      : [...assignedGroupIds, groupId];

    onSave({
      ...session,
      assignedGroupIds: nextAssignedGroupIds,
      updatedAt: new Date().toISOString()
    });
  }

  return (
    <div>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Planification pédagogique</span>
          <h2>Séances préparées</h2>
        </div>

        <Button onClick={beginNew}>
          <CalendarPlus size={18} />
          Nouvelle séance
        </Button>
      </div>

      <div className="session-library-grid">
        {sessions.map((session) => {
          const level = levels.find((item) => item.id === session.levelId);
          const compatibleGroups = groups.filter(
            (group) => group.levelId === session.levelId
          );

          return (
            <Card key={session.id} className="session-library-card">
              <div className="session-library-card-top">
                <div>
                  <span className="eyebrow">
                    {level?.name ?? "Niveau inconnu"}
                  </span>
                  <h3>{session.name}</h3>
                </div>

                <div className="row-actions">
                  <button
                    onClick={() =>
                      setDraft({
                        ...session,
                        assignedGroupIds: session.assignedGroupIds ?? []
                      })
                    }
                    aria-label="Modifier la séance"
                  >
                    <Pencil size={17} />
                  </button>

                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          "Supprimer cette séance et ses attributions?"
                        )
                      ) {
                        onDelete(session.id);
                      }
                    }}
                    aria-label="Supprimer la séance"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>

              {session.description && <p>{session.description}</p>}

              <div className="session-library-meta">
                <span>
                  {session.sentenceIds.length} activité
                  {session.sentenceIds.length > 1 ? "s" : ""}
                </span>

                {session.scheduledDate && (
                  <span>
                    {new Date(
                      `${session.scheduledDate}T12:00:00`
                    ).toLocaleDateString("fr-CA")}
                  </span>
                )}
              </div>

              <label className="competition-toggle session-competition-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(session.competitionEnabled)}
                  onChange={() => onToggleCompetition(session.id)}
                />
                <span>Compétition amicale</span>
              </label>

              <div className="session-assignment">
                <div className="session-assignment-heading">
                  <span>
                    <UsersRound size={17} />
                    Attribuer aux groupes
                  </span>
                </div>

                <div className="assignment-chips">
                  {compatibleGroups.map((group) => {
                    const assigned = (session.assignedGroupIds ?? []).includes(
                      group.id
                    );

                    return (
                      <button
                        key={group.id}
                        type="button"
                        className={`assignment-chip ${
                          assigned ? "assigned" : ""
                        }`}
                        onClick={() =>
                          toggleGroupAssignment(session, group.id)
                        }
                      >
                        {assigned && <Check size={15} />}
                        {group.name}
                      </button>
                    );
                  })}

                  {compatibleGroups.length === 0 && (
                    <small>Aucun groupe compatible avec ce niveau.</small>
                  )}
                </div>
              </div>
            </Card>
          );
        })}

        {sessions.length === 0 && (
          <Card>
            <h3>Aucune séance préparée</h3>
            <p>
              Crée une séance, choisis ses activités, puis attribue-la aux
              groupes directement depuis sa carte.
            </p>
          </Card>
        )}
      </div>

      {draft && (
        <div className="modal-backdrop">
          <Card
            className="modal-card session-editor-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Modifier une séance"
          >
            <form onSubmit={submit}>
              <div className="modal-heading">
                <div>
                  <span className="eyebrow">Séance</span>
                  <h2>
                    {sessions.some((item) => item.id === draft.id)
                      ? "Modifier la séance"
                      : "Préparer une séance"}
                  </h2>
                </div>

                <button
                  type="button"
                  className="icon-control"
                  onClick={() => setDraft(null)}
                  aria-label="Fermer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="form-grid">
                <label>
                  Titre de la séance
                  <input
                    value={draft.name}
                    onChange={(event) =>
                      setDraft({ ...draft, name: event.target.value })
                    }
                    placeholder="Ex. Révision des accords"
                  />
                </label>

                <label>
                  Niveau
                  <select
                    value={draft.levelId}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        levelId: event.target.value,
                        sentenceIds: [],
                        assignedGroupIds: []
                      })
                    }
                  >
                    {levels.map((level) => (
                      <option key={level.id} value={level.id}>
                        {level.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Date prévue
                  <input
                    type="date"
                    value={draft.scheduledDate ?? ""}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        scheduledDate: event.target.value
                      })
                    }
                  />
                </label>
              </div>

              <label>
                Description facultative
                <textarea
                  rows={3}
                  value={draft.description ?? ""}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      description: event.target.value
                    })
                  }
                  placeholder="Intention pédagogique, notion travaillée, consignes..."
                />
              </label>

              <section className="session-editor-section">
                <div>
                  <span className="eyebrow">Contenu de la séance</span>
                  <h3>Choisir les activités</h3>
                </div>

                <div className="session-activity-selector">
                  {activities
                    .filter((activity) => activity.levelId === draft.levelId)
                    .map((activity) => {
                      const selected = draft.sentenceIds.includes(activity.id);
                      const type = getActivityTypeLabel(activity.activityType);

                      return (
                        <button
                          type="button"
                          key={activity.id}
                          className={`session-choice-card ${
                            selected ? "selected" : ""
                          }`}
                          onClick={() => toggleActivity(activity.id)}
                        >
                          <span className="session-choice-check">
                            {selected && <Check size={15} />}
                          </span>
                          <span>
                            <strong>{activity.title}</strong>
                            <small>{type}</small>
                          </span>
                        </button>
                      );
                    })}
                </div>
              </section>

              <div className="form-actions">
                <Button type="submit">
                  <Save size={18} />
                  Enregistrer la séance
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setDraft(null)}
                >
                  Annuler
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
