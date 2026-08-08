"use client";

import { useState } from "react";
import { Pencil, Plus, Save, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Team } from "@/types";

type Props = {
  groupId: string;
  teams: Team[];
  onSave: (team: Team) => void;
  onDelete: (teamId: string) => void;
};

const icons = [
  "🦊", "🦉", "🐺", "🐯", "🦁", "🐻", "🐼", "🐸", "🐙", "🦈",
  "🐉", "🦄", "🤖", "👾", "🚀", "🛸", "⚡", "🔥", "⭐", "💎",
  "🏆", "🎯", "🧠", "🛡️", "⚔️", "🎲", "🎮", "🌙", "☀️", "🌈"
];

export function TeamManager({ groupId, teams, onSave, onDelete }: Props) {
  const [draft, setDraft] = useState<Team | null>(null);
  const [newMember, setNewMember] = useState("");

  function newTeam() {
    setDraft({
      id: crypto.randomUUID(),
      groupId,
      name: "",
      icon: "⭐",
      points: 0,
      members: []
    });
    setNewMember("");
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft?.name.trim()) return;

    onSave({
      ...draft,
      name: draft.name.trim(),
      members: (draft.members ?? []).map((member) => member.trim()).filter(Boolean)
    });

    setDraft(null);
    setNewMember("");
  }

  function addMember() {
    if (!draft) return;
    const value = newMember.trim();
    if (!value || (draft.members ?? []).includes(value)) return;

    setDraft({
      ...draft,
      members: [...(draft.members ?? []), value]
    });
    setNewMember("");
  }

  function removeMember(member: string) {
    if (!draft) return;
    setDraft({
      ...draft,
      members: (draft.members ?? []).filter((item) => item !== member)
    });
  }

  return (
    <Card className="team-manager-card">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Compétition amicale</span>
          <h2>Équipes</h2>
        </div>
        <Button onClick={newTeam}><Plus size={18} /> Ajouter</Button>
      </div>

      <div className="team-list">
        {teams.map((team) => (
          <div className="team-row" key={team.id}>
            <span className="team-icon">{team.icon ?? "⭐"}</span>
            <div>
              <strong>{team.name}</strong>
              <small>
                {team.points} points · {(team.members ?? []).length} élève{(team.members ?? []).length > 1 ? "s" : ""}
              </small>
            </div>
            <div className="row-actions">
              <button
                onClick={() => {
                  setDraft({ ...team, members: team.members ?? [] });
                  setNewMember("");
                }}
                aria-label={`Modifier ${team.name}`}
              >
                <Pencil size={17} />
              </button>
              <button onClick={() => onDelete(team.id)} aria-label={`Supprimer ${team.name}`}>
                <Trash2 size={17} />
              </button>
            </div>
          </div>
        ))}

        {teams.length === 0 && <p>Aucune équipe créée pour ce groupe.</p>}
      </div>

      {draft && (
        <div className="modal-backdrop">
          <Card className="modal-card team-modal" role="dialog" aria-modal="true" aria-label="Modifier une équipe">
            <form onSubmit={submit}>
              <div className="modal-heading">
                <div>
                  <span className="eyebrow">Équipe</span>
                  <h2>{teams.some((item) => item.id === draft.id) ? "Modifier" : "Créer"}</h2>
                </div>
                <button type="button" className="icon-control" onClick={() => setDraft(null)}>
                  <X size={20} />
                </button>
              </div>

              <div className="form-grid">
                <label>Nom
                  <input
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    placeholder="Ex. Les Lynx"
                  />
                </label>

                <label>Points de départ
                  <input
                    type="number"
                    value={draft.points}
                    onChange={(event) => setDraft({ ...draft, points: Number(event.target.value) })}
                  />
                </label>
              </div>

              <label>Icône
                <div className="icon-picker expanded">
                  {icons.map((icon) => (
                    <button
                      type="button"
                      className={draft.icon === icon ? "selected" : ""}
                      key={icon}
                      onClick={() => setDraft({ ...draft, icon })}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </label>

              <div className="team-members-editor">
                <div>
                  <span className="eyebrow">Élèves</span>
                  <h3>Membres de l’équipe</h3>
                </div>

                <div className="member-add-row">
                  <input
                    value={newMember}
                    onChange={(event) => setNewMember(event.target.value)}
                    placeholder="Nom de l’élève"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addMember();
                      }
                    }}
                  />
                  <Button type="button" variant="secondary" onClick={addMember}>
                    <UserPlus size={17} />
                    Ajouter
                  </Button>
                </div>

                <div className="member-chip-list">
                  {(draft.members ?? []).map((member) => (
                    <span className="member-chip" key={member}>
                      {member}
                      <button
                        type="button"
                        onClick={() => removeMember(member)}
                        aria-label={`Retirer ${member}`}
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                  {(draft.members ?? []).length === 0 && (
                    <p>Aucun élève ajouté.</p>
                  )}
                </div>
              </div>

              <div className="form-actions">
                <Button type="submit"><Save size={18} /> Enregistrer</Button>
                <Button type="button" variant="secondary" onClick={() => setDraft(null)}>
                  Annuler
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </Card>
  );
}
