"use client";

import { ChevronDown, ChevronRight, ChevronUp, Link2, Plus, Trash2, Unlink } from "lucide-react";
import type { GrammarPhaseKind, GrammarWorkflowAction, GrammarWorkflowPhase } from "@/types";
import { grammarActionLabels, grammarPhaseLabels, createWorkflowPhase } from "@/lib/grammar-workflow";

type Props = { phases: GrammarWorkflowPhase[]; onChange: (phases: GrammarWorkflowPhase[]) => void };

export function GrammarWorkflowPlanner({ phases, onChange }: Props) {
  const available = (Object.keys(grammarPhaseLabels) as GrammarPhaseKind[]).filter((kind) => !phases.some((phase) => phase.kind === kind));
  const updatePhase = (id: string, patch: Partial<GrammarWorkflowPhase>) => onChange(phases.map((phase) => phase.id === id ? { ...phase, ...patch } : phase));
  const updateAction = (phase: GrammarWorkflowPhase, id: string, patch: Partial<GrammarWorkflowAction>) => updatePhase(phase.id, { actions: phase.actions.map((action) => action.id === id ? { ...action, ...patch } : action) });
  const movePhase = (index: number, delta: number) => { const target = index + delta; if (target < 0 || target >= phases.length) return; const next = [...phases]; [next[index], next[target]] = [next[target], next[index]]; onChange(next); };
  const moveAction = (phase: GrammarWorkflowPhase, index: number, delta: number) => { const target = index + delta; if (target < 0 || target >= phase.actions.length) return; const actions = [...phase.actions]; [actions[index], actions[target]] = [actions[target], actions[index]]; updatePhase(phase.id, { actions }); };

  return <section className="workflow-planner mixed-workflow-planner" aria-label="Déroulement de l’activité">
    <div className="workflow-planner-heading"><div><span className="eyebrow">Déroulement</span><h2>Phases et actions</h2></div><span className="workflow-count">{phases.length}</span></div>
    <p className="workflow-help">Une action liée s’exécute immédiatement sur la cible choisie. Sans lien, toutes les cibles sont terminées avant l’action suivante.</p>
    <div className="workflow-phase-list">{phases.map((phase, phaseIndex) => <div className="workflow-phase" key={phase.id}>
      <div className="workflow-phase-row">
        <span className="workflow-phase-number">{phaseIndex + 1}</span>
        <button type="button" className="workflow-phase-toggle" onClick={() => updatePhase(phase.id, { collapsed: !phase.collapsed })}>{phase.collapsed ? <ChevronRight size={17}/> : <ChevronDown size={17}/>}<strong>{phase.title}</strong></button>
        <button type="button" onClick={() => movePhase(phaseIndex, -1)} disabled={!phaseIndex} aria-label="Monter la phase"><ChevronUp size={15}/></button>
        <button type="button" onClick={() => movePhase(phaseIndex, 1)} disabled={phaseIndex === phases.length - 1} aria-label="Descendre la phase"><ChevronDown size={15}/></button>
        <button type="button" className="workflow-remove" onClick={() => onChange(phases.filter((item) => item.id !== phase.id))} aria-label={`Supprimer ${phase.title}`}><Trash2 size={15}/></button>
      </div>
      {!phase.collapsed && <div className="workflow-actions">{phase.actions.map((action, actionIndex) => {
        const possibleParents = [...phases.slice(0, phaseIndex).flatMap((item) => item.actions), ...phase.actions.slice(0, actionIndex)].filter((candidate) => candidate.enabled);
        return <div className={`workflow-action-card ${action.parentActionId ? "nested" : ""}`} key={action.id}>
          <div className="workflow-action-row">
            {action.parentActionId && <span className="workflow-action-branch">↳</span>}
            <label><input type="checkbox" checked={action.enabled} onChange={(event) => updateAction(phase, action.id, { enabled: event.target.checked })}/><strong>{grammarActionLabels[action.kind]}</strong></label>
            <button type="button" onClick={() => moveAction(phase, actionIndex, -1)} disabled={!actionIndex} aria-label="Monter l’action"><ChevronUp size={14}/></button>
            <button type="button" onClick={() => moveAction(phase, actionIndex, 1)} disabled={actionIndex === phase.actions.length - 1} aria-label="Descendre l’action"><ChevronDown size={14}/></button>
          </div>
          {action.enabled && <div className="workflow-action-options">
            <label>Réponse<select value={action.responseMode ?? "click"} onChange={(event) => updateAction(phase, action.id, { responseMode: event.target.value as GrammarWorkflowAction["responseMode"] })}><option value="click">Cliquer sur le mot ou le passage</option><option value="frame">Tracer un encadrement</option><option value="brackets">Tracer les crochets</option></select></label>
            <label>Ordre des cibles<select value={action.targetOrder ?? "free"} onChange={(event) => updateAction(phase, action.id, { targetOrder: event.target.value as "free" | "fixed" })}><option value="free">Libre — n’importe quelle cible</option><option value="fixed">Fixe — ordre de la phrase</option></select></label>
            <label>{action.parentActionId ? <Link2 size={14}/> : <Unlink size={14}/>} Enchaînement<select value={action.parentActionId ?? ""} onChange={(event) => updateAction(phase, action.id, { parentActionId: event.target.value || undefined, progressionMode: event.target.value ? "linked" : "batch" })}><option value="">Par lots — aucune action parente</option>{possibleParents.map((parent) => <option value={parent.id} key={parent.id}>Après chaque « {grammarActionLabels[parent.kind]} »</option>)}</select></label>
          </div>}
        </div>;
      })}</div>}
    </div>)}</div>
    {available.length > 0 && <label className="workflow-add"><Plus size={16}/><select value="" onChange={(event) => event.target.value && onChange([...phases, createWorkflowPhase(event.target.value as GrammarPhaseKind)])}><option value="">Ajouter une phase…</option>{available.map((kind) => <option value={kind} key={kind}>{grammarPhaseLabels[kind]}</option>)}</select></label>}
  </section>;
}
