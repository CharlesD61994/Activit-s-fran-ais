"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Pilcrow, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SentenceRenderer } from "@/components/sentence-renderer";
import type { ActivityType, ClassGroup, CorrectionCode, SchoolLevel, Sentence, SentenceCorrection, SentenceDifficulty } from "@/types";

type Props = {
  initialSentence?: Sentence;
  activityType?: ActivityType;
  levels: SchoolLevel[];
  groups: ClassGroup[];
  correctionCodes: CorrectionCode[];
  onSave: (sentence: Sentence) => void;
};

type DraftCorrection = {
  start: number;
  end: number;
  originalText: string;
  correctedText: string;
  correctionCodeId: string;
  points: number;
  explanation: string;
};

const emptyDraft: DraftCorrection = {
  start: 0,
  end: 0,
  originalText: "",
  correctedText: "",
  correctionCodeId: "",
  points: 1,
  explanation: ""
};

export function SentenceEditor({
  initialSentence,
  activityType: requestedActivityType,
  levels,
  correctionCodes,
  onSave
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const now = new Date().toISOString();

  const activityType: ActivityType =
    initialSentence?.activityType ?? requestedActivityType ?? "sentence_correction";
  const isTextActivity = activityType === "text_correction";

  const [title, setTitle] = useState(initialSentence?.title ?? "");
  const [levelId, setLevelId] = useState(initialSentence?.levelId ?? levels[0]?.id ?? "");
  const [difficulty, setDifficulty] = useState<SentenceDifficulty>(initialSentence?.difficulty ?? "easy");
  const [tagsText, setTagsText] = useState(initialSentence?.tags.join(", ") ?? "");
  const [originalText, setOriginalText] = useState(initialSentence?.originalText ?? "");
  const [showCorrectionCount, setShowCorrectionCount] = useState(initialSentence?.showCorrectionCount ?? true);
  const [assignedGroupIds, setAssignedGroupIds] = useState<string[]>(initialSentence?.assignedGroupIds ?? []);
  const [corrections, setCorrections] = useState<SentenceCorrection[]>(initialSentence?.corrections ?? []);
  const [draft, setDraft] = useState<DraftCorrection>(emptyDraft);
  const [isInsertionDraft, setIsInsertionDraft] = useState(false);
  const [message, setMessage] = useState("");

  const activeCodes = correctionCodes.filter((code) => code.isActive !== false);

  const previewSentence = useMemo<Sentence>(() => ({
    id: initialSentence?.id ?? "preview",
    activityType,
    title,
    levelId,
    difficulty,
    tags: tagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
    originalText,
    showCorrectionCount,
    corrections,
    assignedGroupIds,
    createdAt: initialSentence?.createdAt ?? now,
    updatedAt: now
  }), [activityType, assignedGroupIds, corrections, difficulty, initialSentence, levelId, now, originalText, showCorrectionCount, tagsText, title]);

  function captureSelection() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    let start = textarea.selectionStart;
    let end = textarea.selectionEnd;

    if (start === end) {
      setMessage("Sélectionne d’abord un mot ou un segment dans la phrase.");
      return;
    }

    while (start < end && /\s/.test(originalText[start] ?? "")) {
      start += 1;
    }

    while (end > start && /\s/.test(originalText[end - 1] ?? "")) {
      end -= 1;
    }

    if (start === end) {
      setMessage("La sélection contient seulement des espaces.");
      return;
    }

    const overlaps = corrections.some(
      (correction) => start < correction.end && end > correction.start
    );

    if (overlaps) {
      setMessage("Cette sélection chevauche une correction existante.");
      return;
    }

    setMessage("");
    setIsInsertionDraft(false);
    setDraft({
      ...emptyDraft,
      start,
      end,
      originalText: originalText.slice(start, end),
      correctionCodeId: activeCodes[0]?.id ?? ""
    });
  }

  function capturePunctuationInsertion() {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const position = textarea.selectionStart;
    const overlaps = corrections.some(
      (correction) =>
        correction.start === position ||
        (position > correction.start && position < correction.end)
    );

    if (overlaps) {
      setMessage("Une correction existe déjà à cet endroit.");
      return;
    }

    const punctuationCode =
      activeCodes.find((code) => code.category === "punctuation") ??
      activeCodes[0];

    setMessage("");
    setIsInsertionDraft(true);
    setDraft({
      ...emptyDraft,
      start: position,
      end: position,
      originalText: "",
      correctionCodeId: punctuationCode?.id ?? ""
    });
  }

  function addCorrection() {
    if (
      (!draft.originalText && !isInsertionDraft) ||
      !draft.correctedText.trim() ||
      !draft.correctionCodeId
    ) {
      setMessage(
        isInsertionDraft
          ? "Entre la ponctuation attendue et choisis un code."
          : "Entre une correction et choisis un code."
      );
      return;
    }

    const correction: SentenceCorrection = {
      id: crypto.randomUUID(),
      start: draft.start,
      end: draft.end,
      originalText: draft.originalText,
      correctedText: draft.correctedText.trim(),
      correctionCodeId: draft.correctionCodeId,
      points: Math.max(1, Math.min(10, Math.round(draft.points))),
      revealOrder: corrections.length + 1,
      explanation: draft.explanation.trim() || undefined
    };

    setCorrections((items) => [...items, correction].sort((a, b) => a.revealOrder - b.revealOrder));
    setDraft(emptyDraft);
    setIsInsertionDraft(false);
    setMessage("");
  }

  function removeCorrection(id: string) {
    setCorrections((items) =>
      items.filter((item) => item.id !== id).map((item, index) => ({ ...item, revealOrder: index + 1 }))
    );
  }

  function moveCorrection(id: string, direction: -1 | 1) {
    setCorrections((items) => {
      const ordered = [...items].sort((a, b) => a.revealOrder - b.revealOrder);
      const index = ordered.findIndex((item) => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= ordered.length) return items;
      [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
      return ordered.map((item, itemIndex) => ({ ...item, revealOrder: itemIndex + 1 }));
    });
  }


  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !originalText.trim() || !levelId) {
      setMessage(
        isTextActivity
          ? "Le titre, le niveau et le texte sont obligatoires."
          : "Le titre, le niveau et la phrase sont obligatoires."
      );
      return;
    }

    const positionsValid = corrections.every((correction) =>
      originalText.slice(correction.start, correction.end) === correction.originalText
    );
    if (!positionsValid) {
      setMessage("La phrase a changé après la création des corrections. Retire les corrections invalides et sélectionne-les de nouveau.");
      return;
    }

    onSave({
      id: initialSentence?.id ?? crypto.randomUUID(),
      activityType,
      title: title.trim(),
      levelId,
      difficulty,
      tags: tagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
      originalText: originalText.trim(),
      showCorrectionCount,
      corrections: [...corrections].sort((a, b) => a.revealOrder - b.revealOrder),
      assignedGroupIds,
      createdAt: initialSentence?.createdAt ?? now,
      updatedAt: new Date().toISOString()
    });
  }

  return (
    <form onSubmit={submit} className="editor-layout">
      <div className="editor-main">
        <Card>
          <span className="eyebrow">Étape 1</span>
          <h2>Informations générales</h2>
          <div className="form-grid">
            <label>Titre
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex. Accord dans le groupe du nom" />
            </label>
            <label>Niveau
              <select value={levelId} onChange={(event) => { setLevelId(event.target.value); setAssignedGroupIds([]); }}>
                {levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}
              </select>
            </label>
            <label>Difficulté
              <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as SentenceDifficulty)}>
                <option value="easy">Facile</option>
                <option value="medium">Moyenne</option>
                <option value="hard">Difficile</option>
              </select>
            </label>
            <label>Étiquettes
              <input value={tagsText} onChange={(event) => setTagsText(event.target.value)} placeholder="accord, PPA, homophones" />
            </label>
          </div>

          <label className="switch-row editor-count-switch">
            <input
              type="checkbox"
              checked={showCorrectionCount}
              onChange={(event) => setShowCorrectionCount(event.target.checked)}
            />
            <span>Afficher le nombre de corrections dans le lecteur</span>
          </label>
        </Card>

        <Card>
          <span className="eyebrow">Étape 2</span>
          <h2>{isTextActivity ? "Texte à corriger" : "Phrase fautive"}</h2>
          <label>
            {isTextActivity
              ? "Écris ou colle le texte, puis sélectionne chaque mot ou segment fautif."
              : "Écris la phrase, puis sélectionne un mot ou un segment."}
            <textarea
              ref={textareaRef}
              value={originalText}
              onChange={(event) => {
                setOriginalText(event.target.value);
                if (corrections.length > 0) setMessage("Attention : modifier la phrase peut invalider les positions des corrections.");
              }}
              rows={isTextActivity ? 15 : 5}
              className={isTextActivity ? "activity-textarea activity-textarea-long" : "activity-textarea"}
              placeholder={
                isTextActivity
                  ? "Colle ici le texte à corriger..."
                  : "Les élèves se sont demander pourquoi..."
              }
            />
          </label>
          <div className="selection-toolbar">
            <Button type="button" onClick={captureSelection}>
              <Plus size={18} />
              Ajouter la sélection comme faute
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={capturePunctuationInsertion}
            >
              <Pilcrow size={18} />
              Ponctuation manquante
            </Button>

            <span>
              Sélectionne une faute, ou place le curseur à l’endroit où une
              virgule, un point ou un autre signe devrait être ajouté.
            </span>
          </div>
        </Card>

        {(draft.originalText || isInsertionDraft) && (
          <Card className="correction-draft">
            <span className="eyebrow">Nouvelle correction</span>
            <h2>
              {isInsertionDraft
                ? "Ponctuation manquante"
                : `« ${draft.originalText} »`}
            </h2>
            <div className="form-grid">
              <label>
                {isInsertionDraft ? "Ponctuation attendue" : "Correction"}
                <input
                  value={draft.correctedText}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      correctedText: event.target.value
                    }))
                  }
                  placeholder={isInsertionDraft ? "Ex. , ou ." : undefined}
                />
              </label>
              <label>Code
                <select value={draft.correctionCodeId} onChange={(event) => setDraft((current) => ({ ...current, correctionCodeId: event.target.value }))}>
                  {activeCodes.map((code) => <option key={code.id} value={code.id}>{code.code} — {code.name}</option>)}
                </select>
              </label>
              <label>Points
                <input type="number" min={1} max={10} value={draft.points} onChange={(event) => setDraft((current) => ({ ...current, points: Number(event.target.value) }))} />
              </label>
              <label>Explication facultative
                <input value={draft.explanation} onChange={(event) => setDraft((current) => ({ ...current, explanation: event.target.value }))} />
              </label>
            </div>
            <div className="form-actions">
              <Button type="button" onClick={addCorrection}>Ajouter la correction</Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setDraft(emptyDraft);
                  setIsInsertionDraft(false);
                }}
              >
                Annuler
              </Button>
            </div>
          </Card>
        )}

        <Card>
          <span className="eyebrow">Étape 3</span>
          <h2>{isTextActivity ? "Corrections du texte" : "Ordre des corrections"}</h2>
          {corrections.length === 0 ? (
            <p>Aucune correction définie.</p>
          ) : (
            <div className="correction-list">
              {[...corrections].sort((a, b) => a.revealOrder - b.revealOrder).map((correction, index) => {
                const code = correctionCodes.find((item) => item.id === correction.correctionCodeId);
                return (
                  <div className="correction-row" key={correction.id}>
                    <span className="order-chip">{correction.revealOrder}</span>
                    <div>
                      <strong>{correction.originalText} → {correction.correctedText}</strong>
                      <small>{code?.code ?? "?"} · {correction.points} point{correction.points > 1 ? "s" : ""}</small>
                    </div>
                    <div className="row-actions">
                      <button type="button" aria-label="Monter" disabled={index === 0} onClick={() => moveCorrection(correction.id, -1)}><ArrowUp size={17} /></button>
                      <button type="button" aria-label="Descendre" disabled={index === corrections.length - 1} onClick={() => moveCorrection(correction.id, 1)}><ArrowDown size={17} /></button>
                      <button type="button" aria-label="Supprimer" onClick={() => removeCorrection(correction.id)}><Trash2 size={17} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>


        {message && <div className="form-message" role="alert">{message}</div>}

        <div className="editor-save-row">
          <Button type="submit">
            <Save size={18} />
            {isTextActivity ? "Enregistrer le texte" : "Enregistrer l’activité"}
          </Button>
        </div>
      </div>

      <aside className="editor-preview">
        <Card>
          <span className="eyebrow">Aperçu</span>
          <span className="activity-type-badge">
            {isTextActivity ? "Texte à corriger" : "Phrase à corriger"}
          </span>
          <h2>{title || "Sans titre"}</h2>
          <div className="teacher-preview-frame">
            <SentenceRenderer sentence={previewSentence} />
          </div>
          <div className="corrected-preview">
            <span className="eyebrow">
              {isTextActivity ? "Texte corrigé" : "Phrase corrigée"}
            </span>
            <SentenceRenderer sentence={previewSentence} showCorrected />
          </div>
          <div className="preview-meta">
            <span>{corrections.length} correction{corrections.length > 1 ? "s" : ""}</span>
            <span>{corrections.reduce((sum, item) => sum + item.points, 0)} points</span>
          </div>
        </Card>
      </aside>
    </form>
  );
}
