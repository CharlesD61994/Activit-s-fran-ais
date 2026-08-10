"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WordClass } from "@/types";

export type GrammarInteractionKind = "function" | "group" | "nucleus";
export type GrammarInteractionDraft = { kind: GrammarInteractionKind; label: string; instruction: string; responseMode: "click" | "frame"; nucleusWordClass: WordClass; linkedTargetId: string };
type Props = { open: boolean; draft: GrammarInteractionDraft; functionOptions: string[]; wordClassLabels: Record<WordClass, string>; linkedTargetLabel?: string; onChange: (draft: GrammarInteractionDraft) => void; onCancel: () => void; onSave: () => void; onPickLinkedTarget: () => void; onClearLinkedTarget: () => void };

function instruction(kind: GrammarInteractionKind, label: string, mode: "click" | "frame") {
  const target = kind === "nucleus" ? "le noyau du groupe" : label.toLocaleLowerCase("fr-CA");
  return mode === "click" ? `Clique sur ${target}.` : `Encadre ${target}.`;
}

export function GrammarInteractionModal({ open, draft, functionOptions, wordClassLabels, linkedTargetLabel, onChange, onCancel, onSave, onPickLinkedTarget, onClearLinkedTarget }: Props) {
  if (!open) return null;
  return <div className="tree-analysis-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <aside className="tree-analysis-inspector tree-analysis-modal" role="dialog" aria-modal="true" aria-label="Créer une réponse interactive">
      <div className="tree-analysis-modal-heading"><div><span className="eyebrow">Réponse interactive</span><h3>Que représente ce passage?</h3></div><button type="button" onClick={onCancel} aria-label="Fermer"><X size={18}/></button></div>
      <label>Type de réponse<select value={draft.kind} onChange={(event) => { const kind = event.target.value as GrammarInteractionKind; const label = kind === "function" ? "Sujet" : kind === "group" ? "Groupe" : wordClassLabels[draft.nucleusWordClass]; const responseMode = kind === "nucleus" ? "click" : "frame"; onChange({ ...draft, kind, label, responseMode, linkedTargetId: "", instruction: instruction(kind, label, responseMode) }); }}><option value="function">Fonction de la phrase</option><option value="group">Groupe lié à l’arbre</option><option value="nucleus">Noyau du groupe</option></select></label>
      {draft.kind === "function" && <label>Fonction<select value={draft.label} onChange={(event) => { const label = event.target.value; onChange({ ...draft, label, instruction: instruction(draft.kind, label, draft.responseMode) }); }}>{functionOptions.map((option) => <option key={option}>{option}</option>)}</select></label>}
      {draft.kind === "nucleus" && <label>Classe du noyau<select value={draft.nucleusWordClass} onChange={(event) => { const nucleusWordClass = event.target.value as WordClass; onChange({ ...draft, nucleusWordClass, label: wordClassLabels[nucleusWordClass] }); }}>{(Object.keys(wordClassLabels) as WordClass[]).map((wordClass) => <option value={wordClass} key={wordClass}>{wordClassLabels[wordClass]}</option>)}</select></label>}
      <label>Action de l’élève<select value={draft.responseMode} onChange={(event) => { const responseMode = event.target.value as "click" | "frame"; onChange({ ...draft, responseMode, instruction: instruction(draft.kind, draft.label, responseMode) }); }}><option value="click">Cliquer sur le mot</option><option value="frame">Tracer un encadrement</option></select></label>
      <label>Consigne affichée<input value={draft.instruction} onChange={(event) => onChange({ ...draft, instruction: event.target.value })} placeholder="Ex. Encadre le sujet de la phrase."/></label>
      {draft.kind !== "function" && <div className="tree-analysis-linked-node-picker"><span>Rectangle déclenché (facultatif)</span><strong>{linkedTargetLabel ? `Rectangle sélectionné — ${linkedTargetLabel}` : "Aucun rectangle sélectionné"}</strong><div className="tree-analysis-modal-actions"><Button type="button" variant="secondary" onClick={onPickLinkedTarget}>Choisir dans l’arbre</Button>{draft.linkedTargetId && <Button type="button" variant="secondary" onClick={onClearLinkedTarget}>Ne lier aucun rectangle</Button>}</div></div>}
      <p>La marque sert à repérer la réponse dans le corrigé. Le geste demandé à l’élève est configuré séparément.</p>
      <div className="tree-analysis-modal-actions"><Button type="button" variant="secondary" onClick={onCancel}>Visuel seulement</Button><Button type="button" onClick={onSave} disabled={!draft.label.trim() || !draft.instruction.trim()}>Créer l’évènement</Button></div>
    </aside>
  </div>;
}
