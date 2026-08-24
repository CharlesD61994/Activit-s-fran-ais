"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, MonitorPlay, Plus, Trash2, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GROUP_ACCENT_COLORS, groupAccentColor, groupShieldLabel } from "@/lib/group-colors";
import { useAppStore } from "@/store/app-store";
import { getCompletedSentenceIds, getWeeklyPoints } from "@/lib/stats";

export default function HomePage() {
  const {
    data,
    saveSchoolYear,
    deleteSchoolYear,
    addGroup,
    deleteGroup,
    resetGroupPoints,
    setGroupPoints,
    updateGroupAccentColor,
    updateGroupShieldLabel
  } = useAppStore();

  const [showYearModal, setShowYearModal] = useState(false);
  const [yearName, setYearName] = useState("");

  const [groupYearId, setGroupYearId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupLevelId, setGroupLevelId] = useState(data.levels[0]?.id ?? "");
  const [groupMenuId, setGroupMenuId] = useState<string | null>(null);
  const [scoreGroupId, setScoreGroupId] = useState<string | null>(null);
  const [scoreDraft, setScoreDraft] = useState("0");

  function createYear(event: React.FormEvent) {
    event.preventDefault();
    const name = yearName.trim();
    if (!name) return;

    saveSchoolYear({
      id: crypto.randomUUID(),
      name,
      order: data.schoolYears.length + 1
    });

    setYearName("");
    setShowYearModal(false);
  }

  function createGroup(event: React.FormEvent) {
    event.preventDefault();
    if (!groupYearId) return;

    const name = groupName.trim();
    if (!name || !groupLevelId) return;

    addGroup({
      id: crypto.randomUUID(),
      schoolYearId: groupYearId,
      levelId: groupLevelId,
      name,
      description: "",
      totalPoints: 0,
      sentenceCount: 0,
      studentPortalEnabled: false
    });

    setGroupName("");
    setGroupLevelId(data.levels[0]?.id ?? "");
    setGroupYearId(null);
  }

  return (
    <div className="page">
      <div className="home-toolbar">
        <Link href="/classe">
          <Button>
            <MonitorPlay size={18} />
            Ouvrir Classe
          </Button>
        </Link>

        <Button variant="secondary" onClick={() => setShowYearModal(true)}>
          <Plus size={18} />
          Nouvelle année scolaire
        </Button>
      </div>

      <div className="school-year-list">
        {data.schoolYears
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((year) => {
            const groups = data.groups.filter((group) => group.schoolYearId === year.id);

            return (
              <section className="school-year-section" key={year.id}>
                <div className="school-year-heading">
                  <div>
                    <h2>{year.name}</h2>
                    <span>{groups.length} groupe{groups.length > 1 ? "s" : ""}</span>
                  </div>

                  <div className="school-year-actions-row">
                    <button
                      type="button"
                      className="danger-icon-button"
                      aria-label={`Supprimer ${year.name}`}
                      title="Supprimer l’année scolaire et ses groupes"
                      onClick={() => {
                        const confirmed = window.confirm(
                          `Supprimer « ${year.name} » ainsi que tous ses groupes, équipes, séances et pointages?`
                        );
                        if (confirmed) deleteSchoolYear(year.id);
                      }}
                    >
                      <Trash2 size={18} />
                    </button>

                    <Button
                      variant="secondary"
                      onClick={() => {
                        setGroupYearId(year.id);
                        setGroupName("");
                        setGroupLevelId(data.levels[0]?.id ?? "");
                      }}
                    >
                      <Plus size={17} />
                      Ajouter un groupe
                    </Button>
                  </div>
                </div>

                <div className="group-hub-grid">
                  {groups.map((group) => {
                    const level = data.levels.find((item) => item.id === group.levelId);
                    const weeklyPoints = getWeeklyPoints(data.scoreEvents, group.id);
                    const completedCount = getCompletedSentenceIds(data.scoreEvents, group.id).length;
                    const groupIndex = data.groups.findIndex((item) => item.id === group.id);

                    return (
                      <div
                        key={group.id}
                        className="group-card-wrapper"
                        style={{
                          "--group-accent": groupAccentColor(groupIndex, group.accentColor)
                        } as React.CSSProperties}
                      >
                        <Link href={`/groupes/${group.id}`} className="card-link">
                          <Card className="group-hub-card compact">
                            <div className="group-card-title-block">
                            <span className="eyebrow">{level?.name ?? "Niveau"}</span>
                            <h2>{group.name}</h2>
                            {group.description && <p>{group.description}</p>}
                          </div>

                          <div className="group-hub-stats">
                            <div>
                              <span>Cette semaine</span>
                              <strong><Trophy size={18} /> {weeklyPoints}</strong>
                            </div>
                            <div>
                              <span>Activités réalisées</span>
                              <strong>{completedCount}</strong>
                            </div>
                            </div>
                          </Card>
                        </Link>

                        <button
                          type="button"
                          className="group-card-menu-button"
                          aria-label={`Options pour ${group.name}`}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setGroupMenuId(group.id);
                          }}
                        >
                          <MoreHorizontal size={20} />
                        </button>
                      </div>
                    );
                  })}

                  {groups.length === 0 && (
                    <Card className="empty-year-card">
                      <h3>Aucun groupe</h3>
                      <p>Ajoute un premier groupe à cette année scolaire.</p>
                    </Card>
                  )}
                </div>
              </section>
            );
          })}
      </div>


      {groupMenuId && (() => {
        const selectedGroup = data.groups.find((group) => group.id === groupMenuId);
        if (!selectedGroup) return null;
        const selectedGroupIndex = data.groups.findIndex((group) => group.id === selectedGroup.id);
        const selectedAccent = groupAccentColor(selectedGroupIndex, selectedGroup.accentColor);
        const selectedShieldLabel = selectedGroup.shieldLabel ?? groupShieldLabel(selectedGroup.name);

        return (
          <div className="modal-backdrop">
            <Card className="modal-card group-options-modal" role="dialog" aria-modal="true">
              <div className="modal-heading">
                <div>
                  <span className="eyebrow">Options du groupe</span>
                  <h2>{selectedGroup.name}</h2>
                </div>
                <button
                  type="button"
                  className="icon-control"
                  onClick={() => setGroupMenuId(null)}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="group-option-list">
                <button
                  type="button"
                  onClick={() => {
                    resetGroupPoints(selectedGroup.id);
                    setGroupMenuId(null);
                  }}
                >
                  Réinitialiser les points
                </button>

                <div className="group-color-option">
                  <span>Couleur du groupe</span>
                  <div className="group-color-swatch-row" role="list" aria-label="Couleurs du groupe">
                    {GROUP_ACCENT_COLORS.map((color) => (
                      <button
                        type="button"
                        key={color}
                        className={color === selectedAccent ? "active" : ""}
                        style={{ "--swatch-color": color } as React.CSSProperties}
                        aria-label={`Choisir la couleur ${color}`}
                        aria-pressed={color === selectedAccent}
                        onClick={() => updateGroupAccentColor(selectedGroup.id, color)}
                      />
                    ))}
                  </div>
                </div>

                <label className="group-shield-option">
                  Chiffres du bouclier
                  <input
                    value={selectedShieldLabel}
                    maxLength={4}
                    inputMode="numeric"
                    onChange={(event) => updateGroupShieldLabel(selectedGroup.id, event.target.value)}
                    aria-label="Chiffres à afficher dans le bouclier"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setScoreGroupId(selectedGroup.id);
                    setScoreDraft(String(selectedGroup.totalPoints));
                    setGroupMenuId(null);
                  }}
                >
                  Changer les points
                </button>

                <button
                  type="button"
                  className="danger-option"
                  onClick={() => {
                    const confirmed = window.confirm(
                      `Supprimer ${selectedGroup.name} ainsi que ses équipes, séances et pointages?`
                    );
                    if (confirmed) deleteGroup(selectedGroup.id);
                    setGroupMenuId(null);
                  }}
                >
                  Supprimer le groupe
                </button>
              </div>
            </Card>
          </div>
        );
      })()}

      {scoreGroupId && (
        <div className="modal-backdrop">
          <Card className="modal-card" role="dialog" aria-modal="true">
            <div className="modal-heading">
              <div>
                <span className="eyebrow">Pointage</span>
                <h2>Changer les points</h2>
              </div>
              <button
                type="button"
                className="icon-control"
                onClick={() => setScoreGroupId(null)}
              >
                <X size={20} />
              </button>
            </div>

            <label>
              Nouveau pointage
              <input
                type="number"
                value={scoreDraft}
                onChange={(event) => setScoreDraft(event.target.value)}
                autoFocus
              />
            </label>

            <div className="form-actions">
              <Button
                onClick={() => {
                  setGroupPoints(scoreGroupId, Number(scoreDraft) || 0);
                  setScoreGroupId(null);
                }}
              >
                Enregistrer
              </Button>
              <Button
                variant="secondary"
                onClick={() => setScoreGroupId(null)}
              >
                Annuler
              </Button>
            </div>
          </Card>
        </div>
      )}

      {showYearModal && (
        <div className="modal-backdrop">
          <Card className="modal-card" role="dialog" aria-modal="true" aria-label="Nouvelle année scolaire">
            <form onSubmit={createYear}>
              <div className="modal-heading">
                <div>
                  <span className="eyebrow">Organisation</span>
                  <h2>Nouvelle année scolaire</h2>
                </div>

                <button
                  type="button"
                  className="icon-control"
                  onClick={() => setShowYearModal(false)}
                  aria-label="Fermer"
                >
                  <X size={20} />
                </button>
              </div>

              <label>
                Nom
                <input
                  value={yearName}
                  onChange={(event) => setYearName(event.target.value)}
                  placeholder="Ex. Année scolaire 2027-2028"
                  autoFocus
                />
              </label>

              <div className="form-actions">
                <Button type="submit">Créer l’année</Button>
                <Button type="button" variant="secondary" onClick={() => setShowYearModal(false)}>
                  Annuler
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {groupYearId && (
        <div className="modal-backdrop">
          <Card className="modal-card" role="dialog" aria-modal="true" aria-label="Ajouter un groupe">
            <form onSubmit={createGroup}>
              <div className="modal-heading">
                <div>
                  <span className="eyebrow">Groupe</span>
                  <h2>Ajouter un groupe</h2>
                </div>

                <button
                  type="button"
                  className="icon-control"
                  onClick={() => setGroupYearId(null)}
                  aria-label="Fermer"
                >
                  <X size={20} />
                </button>
              </div>

              <label>
                Nom du groupe
                <input
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  placeholder="Ex. Groupe 103"
                  autoFocus
                />
              </label>

              <div className="form-grid">
                <label>
                  Niveau
                  <select
                    value={groupLevelId}
                    onChange={(event) => setGroupLevelId(event.target.value)}
                  >
                    {data.levels.map((level) => (
                      <option key={level.id} value={level.id}>
                        {level.name}
                      </option>
                    ))}
                  </select>
                </label>

              </div>

              <div className="form-actions">
                <Button type="submit">Créer le groupe</Button>
                <Button type="button" variant="secondary" onClick={() => setGroupYearId(null)}>
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
