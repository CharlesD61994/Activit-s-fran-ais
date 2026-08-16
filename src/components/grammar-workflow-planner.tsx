"use client";

import { ChevronDown, ChevronRight, GripVertical, Plus, Trash2 } from "lucide-react";
import type { GrammarPhaseKind, GrammarWorkflowPhase } from "@/types";
import { grammarActionLabels, grammarPhaseLabels, createWorkflowPhase } from "@/lib/grammar-workflow";

type Props = {
  phases: GrammarWorkflowPhase[];
  onChange: (phases: GrammarWorkflowPhase[]) => void;
};

export function GrammarWorkflowPlanner({ phases, onChange }: Props) {
  const available = (Object.keys(grammarPhaseLabels) as GrammarPhaseKind[])
    .filter((kind) => kind !== "nuclei" && (kind === "review" || !phases.some((phase) => phase.kind === kind)));

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= phases.length) return;
    const next = [...phases];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <section className="workflow-planner" aria-label="Déroulement de l’activité">
      <div className="workflow-planner-heading">
        <div><span className="eyebrow">Déroulement</span><h2>Phases de l’activité</h2></div>
        <span className="workflow-count">{phases.length}</span>
      </div>
      <p className="workflow-help">Réorganise les phases. Les actions restent attachées à leur phase.</p>
      <div className="workflow-phase-list">
        {phases.map((phase, index) => (
          <div className="workflow-phase" key={phase.id}>
            <div className="workflow-phase-row">
              <button type="button" className="workflow-grip" aria-label="Réorganiser" onClick={() => move(index, index === phases.length - 1 ? -1 : 1)}><GripVertical size={16} /></button>
              <button type="button" className="workflow-phase-toggle" onClick={() => onChange(phases.map((item) => item.id === phase.id ? { ...item, collapsed: !item.collapsed } : item))}>
                {phase.collapsed ? <ChevronRight size={17} /> : <ChevronDown size={17} />}
                <strong>{phase.title}</strong>
              </button>
              <button type="button" className="workflow-remove" aria-label={`Supprimer ${phase.title}`} onClick={() => onChange(phases.filter((item) => item.id !== phase.id))}><Trash2 size={15} /></button>
            </div>
            {!phase.collapsed && (
              <div className="workflow-actions">
                {phase.kind === "review" && (
                  <div className="workflow-review-settings">
                    <label>
                      Texte affiché
                      <input
                        value={phase.title}
                        onChange={(event) => onChange(phases.map((item) => item.id === phase.id ? { ...item, title: event.target.value } : item))}
                      />
                    </label>
                    <label>
                      Minuteur au tableau
                      <select
                        value={phase.reviewDurationSeconds ?? 0}
                        onChange={(event) => onChange(phases.map((item) => item.id === phase.id ? { ...item, reviewDurationSeconds: Number(event.target.value) as 0 | 15 | 30 | 45 | 60 } : item))}
                      >
                        <option value={0}>Sans minuteur</option>
                        <option value={15}>15 secondes</option>
                        <option value={30}>30 secondes</option>
                        <option value={45}>45 secondes</option>
                        <option value={60}>60 secondes</option>
                      </select>
                    </label>
                    <small>La correction accumulée reste affichée jusqu’à ce que l’enseignant poursuive.</small>
                  </div>
                )}
                {phase.kind === "agreements" && (
                  <small className="workflow-agreement-help">
                    Active les questions de rôle seulement si l’élève doit dire si le mot est donneur ou receveur. Le tracé d’une flèche se choisit directement dans l’action de chaque donneur ou receveur.
                  </small>
                )}
                {phase.actions.map((action) => (
                  <div className="workflow-action-row" key={action.id}>
                    <label>
                      <input type="checkbox" checked={action.enabled} onChange={(event) => onChange(phases.map((item) => item.id === phase.id ? { ...item, actions: item.actions.map((candidate) => candidate.id === action.id ? { ...candidate, enabled: event.target.checked } : candidate) } : item))} />
                      <span>{grammarActionLabels[action.kind]}</span>
                    </label>
                    {action.kind === "frame_groups" && action.enabled && (
                      <select aria-label="Méthode pour délimiter les groupes" value={action.responseMode ?? "brackets"} onChange={(event) => onChange(phases.map((item) => item.id === phase.id ? { ...item, actions: item.actions.map((candidate) => candidate.id === action.id ? { ...candidate, responseMode: event.target.value as "brackets" | "frame" } : candidate) } : item))}>
                        <option value="brackets">Tracer les crochets [ ]</option>
                        <option value="frame">Tracer un rectangle</option>
                      </select>
                    )}
                    {action.kind === "frame_functions" && action.enabled && (
                      <select aria-label="Méthode pour identifier les fonctions" value={action.responseMode === "brackets" ? "brackets" : "frame"} onChange={(event) => onChange(phases.map((item) => item.id === phase.id ? { ...item, actions: item.actions.map((candidate) => candidate.id === action.id ? { ...candidate, responseMode: event.target.value as "frame" | "brackets" } : candidate) } : item))}>
                        <option value="frame">Tracer un rectangle</option>
                        <option value="brackets">Tracer les crochets [ ]</option>
                      </select>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {available.length > 0 && (
        <label className="workflow-add">
          <Plus size={16} />
          <select value="" onChange={(event) => event.target.value && onChange([...phases, createWorkflowPhase(event.target.value as GrammarPhaseKind)])}>
            <option value="">Ajouter une phase…</option>
            {available.map((kind) => <option key={kind} value={kind}>{grammarPhaseLabels[kind]}</option>)}
          </select>
        </label>
      )}
    </section>
  );
}
