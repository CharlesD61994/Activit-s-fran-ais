"use client";

import { useState } from "react";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { CorrectionCategory, CorrectionCode } from "@/types";

type Props = {
  codes: CorrectionCode[];
  onSave: (code: CorrectionCode) => void;
  onDelete: (codeId: string) => void;
  usedCodeIds: string[];
};

const categoryLabels: Record<CorrectionCategory, string> = {
  orthography: "Orthographe",
  agreement: "Accord",
  conjugation: "Conjugaison",
  participle: "Participe passé",
  homophone: "Homophone",
  syntax: "Syntaxe",
  punctuation: "Ponctuation",
  vocabulary: "Vocabulaire",
  other: "Autre"
};

const emptyCode: CorrectionCode = {
  id: "",
  code: "",
  name: "",
  description: "",
  category: "other",
  color: "#315a7d",
  isActive: true
};

export function CorrectionCodeManager({ codes, onSave, onDelete, usedCodeIds }: Props) {
  const [draft, setDraft] = useState<CorrectionCode | null>(null);

  function beginNew() {
    setDraft({ ...emptyCode, id: crypto.randomUUID() });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft?.code.trim() || !draft.name.trim()) return;
    onSave({
      ...draft,
      code: draft.code.trim().toUpperCase(),
      name: draft.name.trim(),
      description: draft.description?.trim() || undefined
    });
    setDraft(null);
  }

  return (
    <div className="code-manager">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Banque personnalisée</span>
          <h2>Codes de correction</h2>
        </div>
        <Button onClick={beginNew}><Plus size={18} /> Nouveau code</Button>
      </div>

      <div className="code-grid">
        {codes.map((code) => (
          <Card key={code.id} className={`code-card ${code.isActive === false ? "inactive" : ""}`}>
            <div className="code-card-top">
              <span className="code-badge-large" style={{ "--code-color": code.color ?? "#315a7d" } as React.CSSProperties}>
                {code.code}
              </span>
              <div className="row-actions">
                <button onClick={() => setDraft(code)} aria-label={`Modifier ${code.code}`}><Pencil size={17} /></button>
                <button
                  onClick={() => onDelete(code.id)}
                  disabled={usedCodeIds.includes(code.id)}
                  title={usedCodeIds.includes(code.id) ? "Ce code est utilisé dans une phrase" : "Supprimer"}
                  aria-label={`Supprimer ${code.code}`}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
            <strong>{code.name}</strong>
            <small>{categoryLabels[code.category]}</small>
            {code.description && <p>{code.description}</p>}
            <span className="status-pill">{code.isActive === false ? "Masqué" : "Actif"}</span>
          </Card>
        ))}
      </div>

      {draft && (
        <div className="modal-backdrop" role="presentation">
          <Card className="modal-card" role="dialog" aria-modal="true" aria-label="Modifier un code">
            <form onSubmit={submit}>
              <div className="modal-heading">
                <div>
                  <span className="eyebrow">{codes.some((item) => item.id === draft.id) ? "Modification" : "Création"}</span>
                  <h2>Code de correction</h2>
                </div>
                <button type="button" className="icon-control" onClick={() => setDraft(null)} aria-label="Fermer"><X size={20} /></button>
              </div>

              <div className="form-grid">
                <label>Code
                  <input value={draft.code} maxLength={8} onChange={(event) => setDraft({ ...draft, code: event.target.value })} placeholder="Ex. GN" />
                </label>
                <label>Nom
                  <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Ex. Accord dans le groupe du nom" />
                </label>
                <label>Catégorie
                  <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as CorrectionCategory })}>
                    {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label>Couleur
                  <input type="color" value={draft.color ?? "#315a7d"} onChange={(event) => setDraft({ ...draft, color: event.target.value })} />
                </label>
              </div>

              <label>Description facultative
                <textarea rows={3} value={draft.description ?? ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
              </label>

              <label className="switch-row">
                <input type="checkbox" checked={draft.isActive !== false} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} />
                <span>Afficher ce code dans l’éditeur</span>
              </label>

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
