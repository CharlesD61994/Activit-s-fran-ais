"use client";

import { useState } from "react";
import { FolderPlus, Pencil, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SchoolLevel, Sentence, SentenceCollection } from "@/types";

type Props = {
  collections: SentenceCollection[];
  sentences: Sentence[];
  levels: SchoolLevel[];
  onSave: (collection: SentenceCollection) => void;
  onDelete: (collectionId: string) => void;
};

export function CollectionManager({
  collections,
  sentences,
  levels,
  onSave,
  onDelete
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
    if (!draft?.name.trim() || !draft.levelId) return;

    onSave({
      ...draft,
      name: draft.name.trim(),
      description: draft.description?.trim() || undefined,
      updatedAt: new Date().toISOString()
    });
    setDraft(null);
  }

  return (
    <div>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Organisation pédagogique</span>
          <h2>Collections de phrases</h2>
        </div>
        <Button onClick={beginNew}><FolderPlus size={18} /> Nouvelle collection</Button>
      </div>

      <div className="collection-grid">
        {collections.map((collection) => {
          const level = levels.find((item) => item.id === collection.levelId);
          return (
            <Card key={collection.id} className="collection-card">
              <div className="collection-card-top">
                <div>
                  <span className="eyebrow">{level?.name ?? "Niveau inconnu"}</span>
                  <h3>{collection.name}</h3>
                </div>
                <div className="row-actions">
                  <button onClick={() => setDraft(collection)} aria-label="Modifier"><Pencil size={17} /></button>
                  <button onClick={() => onDelete(collection.id)} aria-label="Supprimer"><Trash2 size={17} /></button>
                </div>
              </div>
              <p>{collection.description ?? "Aucune description"}</p>
              <span className="status-pill">
                {collection.sentenceIds.length} phrase{collection.sentenceIds.length > 1 ? "s" : ""}
              </span>
            </Card>
          );
        })}
      </div>

      {draft && (
        <div className="modal-backdrop">
          <Card className="modal-card" role="dialog" aria-modal="true">
            <form onSubmit={submit}>
              <div className="modal-heading">
                <div>
                  <span className="eyebrow">Collection</span>
                  <h2>{collections.some((item) => item.id === draft.id) ? "Modifier" : "Créer"}</h2>
                </div>
                <button type="button" className="icon-control" onClick={() => setDraft(null)}><X size={20} /></button>
              </div>

              <div className="form-grid">
                <label>Nom
                  <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
                </label>
                <label>Niveau
                  <select value={draft.levelId} onChange={(event) => setDraft({ ...draft, levelId: event.target.value, sentenceIds: [] })}>
                    {levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}
                  </select>
                </label>
              </div>

              <label>Description
                <textarea rows={3} value={draft.description ?? ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
              </label>

              <div>
                <span className="eyebrow">Phrases incluses</span>
                <div className="sentence-selector">
                  {sentences.filter((sentence) => sentence.levelId === draft.levelId).map((sentence) => (
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
    </div>
  );
}
