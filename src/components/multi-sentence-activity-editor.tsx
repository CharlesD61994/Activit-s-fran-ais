"use client";

import { useCallback, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MixedActivityEditor } from "@/components/mixed-activity-editor";
import { assembleActivity, getActivitySentences } from "@/lib/activity-sentences";
import type { CorrectionCode, SchoolLevel, Sentence } from "@/types";

type Props = {
  initialSentence?: Sentence;
  levels: SchoolLevel[];
  correctionCodes: CorrectionCode[];
  onSave: (sentence: Sentence) => void;
};

function blankSentence(levelId: string, template?: Sentence): Sentence {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(), title: template?.title ?? "", levelId,
    difficulty: template?.difficulty ?? "medium", tags: template?.tags ?? [],
    assignedGroupIds: template?.assignedGroupIds ?? [],
    activityType: "sentence_correction", isMixedActivity: true,
    primaryObjective: template?.primaryObjective ?? "mixed_grammar",
    originalText: "", corrections: [], grammarAnnotations: [], workflowPhases: [],
    agreementCorrectionArrows: [], createdAt: now, updatedAt: now
  };
}

export function MultiSentenceActivityEditor({ initialSentence, levels, correctionCodes, onSave }: Props) {
  const [activityId] = useState(() => initialSentence?.id ?? crypto.randomUUID());
  const [sentences, setSentences] = useState<Sentence[]>(() => initialSentence
    ? getActivitySentences(initialSentence) : [blankSentence(levels[0]?.id ?? "")]);
  const [activeId, setActiveId] = useState(() => sentences[0].id);
  const [message, setMessage] = useState("");
  const index = sentences.findIndex((part) => part.id === activeId);
  const active = sentences[index];

  const updateDraft = useCallback((draft: Sentence) => {
    setSentences((current) => current.map((part) => part.id === draft.id ? draft : {
      ...part, title: draft.title, levelId: draft.levelId, difficulty: draft.difficulty
    }));
  }, []);

  function select(id: string) {
    // Clicking a tab blurs the editable surface first, committing its text.
    setActiveId(id);
    setMessage("");
  }

  function add() {
    const next = blankSentence(active.levelId, active);
    setSentences((current) => [...current, next]);
    select(next.id);
  }

  function move(direction: -1 | 1) {
    setSentences((current) => {
      const next = [...current];
      const at = next.findIndex((part) => part.id === activeId);
      if (at + direction < 0 || at + direction >= next.length) return current;
      [next[at], next[at + direction]] = [next[at + direction], next[at]];
      return next;
    });
  }

  function save(draft: Sentence) {
    const next = sentences.map((part) => part.id === draft.id ? draft : part);
    const empty = next.findIndex((part) => !part.originalText.trim());
    if (empty >= 0) {
      setMessage(`La phrase ${empty + 1} est vide. Écris son texte ou supprime-la avant d’enregistrer.`);
      return;
    }
    onSave(assembleActivity(next, activityId, draft));
  }

  return <>
    <section className="activity-sentence-toolbar" aria-label="Phrases de l’activité">
      <div className="activity-sentence-tabs" role="tablist" aria-label="Choisir une phrase">
        {sentences.map((part, position) => <button type="button" role="tab"
          aria-selected={part.id === activeId} key={part.id} onClick={() => select(part.id)}>
          Phrase {position + 1}
        </button>)}
      </div>
      <div className="activity-sentence-tools">
        <Button type="button" variant="secondary" onClick={add}><Plus size={16} /> Ajouter une phrase</Button>
        <Button type="button" variant="secondary" disabled={index === 0} onClick={() => move(-1)} aria-label="Avancer cette phrase"><ArrowUp size={16} /></Button>
        <Button type="button" variant="secondary" disabled={index === sentences.length - 1} onClick={() => move(1)} aria-label="Reculer cette phrase"><ArrowDown size={16} /></Button>
        <Button type="button" variant="secondary" disabled={sentences.length === 1}
          onClick={() => {
            if (!window.confirm(`Supprimer la phrase ${index + 1} et ses réponses ?`)) return;
            const next = sentences.filter((part) => part.id !== activeId);
            setSentences(next); select(next[Math.min(index, next.length - 1)].id);
          }} aria-label="Supprimer cette phrase"><Trash2 size={16} /></Button>
      </div>
      <p>Chaque phrase a ses propres réponses et phases. Le lecteur les présente une à la fois, dans cet ordre.</p>
      {message && <p className="form-message" role="alert">{message}</p>}
    </section>
    <MixedActivityEditor key={activeId} initialSentence={active} levels={levels}
      correctionCodes={correctionCodes} onDraftChange={updateDraft} onSave={save}
      phrasePosition={sentences.length > 1 ? `${index + 1}/${sentences.length}` : undefined} />
  </>;
}
