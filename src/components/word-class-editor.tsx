"use client";

import { useMemo, useRef, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  allWordClasses,
  wordClassLabels
} from "@/lib/activity-types";
import type {
  ClassGroup,
  SchoolLevel,
  AgreementRelation,
  Sentence,
  SentenceDifficulty,
  WordClass,
  WordClassTarget
} from "@/types";

type Props = {
  initialSentence?: Sentence;
  levels: SchoolLevel[];
  groups: ClassGroup[];
  onSave: (sentence: Sentence) => void;
};

type TargetDraft = {
  start: number;
  end: number;
  text: string;
  wordClass: WordClass;
  isAnalysisTarget: boolean;
};

const difficultyLabels: Record<SentenceDifficulty, string> = {
  easy: "Facile",
  medium: "Moyenne",
  hard: "Difficile"
};


type RelationWordCandidate = {
  id: string;
  start: number;
  end: number;
  text: string;
  existingTarget?: WordClassTarget;
};

function getRelationWordCandidates(
  text: string,
  targets: WordClassTarget[]
): RelationWordCandidate[] {
  const targetByRange = new Map(
    targets.map((target) => [
      `${target.start}-${target.end}`,
      target
    ])
  );

  return Array.from(
    text.matchAll(/[\p{L}\p{M}]+/gu)
  ).map((match) => {
    const start = match.index ?? 0;
    const value = match[0];
    const end = start + value.length;
    const existingTarget = targetByRange.get(`${start}-${end}`);

    return {
      id: existingTarget?.id ?? `relation-word-${start}-${end}`,
      start,
      end,
      text: value,
      existingTarget
    };
  });
}

export function WordClassEditor({
  initialSentence,
  levels,
  groups,
  onSave
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(initialSentence?.title ?? "");
  const [levelId, setLevelId] = useState(
    initialSentence?.levelId ?? levels[0]?.id ?? ""
  );
  const [difficulty, setDifficulty] = useState<SentenceDifficulty>(
    initialSentence?.difficulty ?? "medium"
  );
  const [originalText, setOriginalText] = useState(
    initialSentence?.originalText ?? ""
  );
  const [selectedWordClasses, setSelectedWordClasses] = useState<WordClass[]>(
    initialSentence?.selectedWordClasses ?? ["noun"]
  );
  const [targets, setTargets] = useState<WordClassTarget[]>(
    initialSentence?.wordClassTargets ?? []
  );
  const [agreementRelationsEnabled, setAgreementRelationsEnabled] =
    useState(initialSentence?.agreementRelationsEnabled ?? false);
  const [agreementRelations, setAgreementRelations] = useState<
    AgreementRelation[]
  >(initialSentence?.agreementRelations ?? []);
  const [relationDonorId, setRelationDonorId] = useState("");
  const [relationReceiverIds, setRelationReceiverIds] = useState<string[]>([]);
  const [assignedGroupIds, setAssignedGroupIds] = useState<string[]>(
    initialSentence?.assignedGroupIds ?? []
  );
  const [draft, setDraft] = useState<TargetDraft | null>(null);
  const [message, setMessage] = useState("");

  const sortedTargets = useMemo(
    () => [...targets].sort((a, b) => a.start - b.start),
    [targets]
  );

  const relationWordCandidates = useMemo(
    () => getRelationWordCandidates(originalText, targets),
    [originalText, targets]
  );

  function toggleWorkingClass(wordClass: WordClass) {
    setSelectedWordClasses((current) =>
      current.includes(wordClass)
        ? current.filter((item) => item !== wordClass)
        : [...current, wordClass]
    );
  }

  function captureSelection() {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const rawStart = textarea.selectionStart;
    const rawEnd = textarea.selectionEnd;
    const rawText = originalText.slice(rawStart, rawEnd);
    const leadingWhitespace = rawText.match(/^\s*/)?.[0].length ?? 0;
    const trailingWhitespace = rawText.match(/\s*$/)?.[0].length ?? 0;
    const start = rawStart + leadingWhitespace;
    const end = rawEnd - trailingWhitespace;
    const text = originalText.slice(start, end);

    if (!text) {
      setMessage("Sélectionne précisément un mot dans le texte.");
      return;
    }

    if (/\s/.test(text)) {
      setMessage("Sélectionne un seul mot à la fois.");
      return;
    }

    const overlaps = targets.some(
      (target) => start < target.end && end > target.start
    );

    if (overlaps) {
      setMessage("Ce mot chevauche déjà un mot identifié.");
      return;
    }

    setDraft({
      start,
      end,
      text,
      wordClass: selectedWordClasses[0] ?? "noun",
      isAnalysisTarget: true
    });
    setMessage("");
  }

  function addTarget() {
    if (!draft) return;

    const normalizedDraft = {
      ...draft,
      isAnalysisTarget:
        draft.isAnalysisTarget &&
        selectedWordClasses.includes(draft.wordClass)
    };

    setTargets((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        ...normalizedDraft
      }
    ]);
    setDraft(null);
    setMessage("");
  }

  function toggleReceiver(targetId: string) {
    if (targetId === relationDonorId) return;

    setRelationReceiverIds((current) =>
      current.includes(targetId)
        ? current.filter((id) => id !== targetId)
        : [...current, targetId]
    );
  }

  function addAgreementRelation() {
    if (!relationDonorId || relationReceiverIds.length === 0) {
      setMessage("Choisis un donneur et au moins un receveur.");
      return;
    }

    const selectedIds = [
      relationDonorId,
      ...relationReceiverIds
    ];

    const selectedCandidates = relationWordCandidates.filter(
      (candidate) => selectedIds.includes(candidate.id)
    );

    const missingCandidates = selectedCandidates.filter(
      (candidate) => !candidate.existingTarget
    );

    const addedTargets: WordClassTarget[] = missingCandidates.map(
      (candidate) => ({
        id: candidate.id,
        start: candidate.start,
        end: candidate.end,
        text: candidate.text,
        wordClass: selectedWordClasses[0] ?? "noun",
        isAnalysisTarget: false
      })
    );

    const normalizedDonorId = relationDonorId;
    const normalizedReceiverIds = [...relationReceiverIds];

    const duplicate = agreementRelations.some(
      (relation) =>
        relation.donorId === normalizedDonorId &&
        relation.receiverIds.length === normalizedReceiverIds.length &&
        relation.receiverIds.every((id) =>
          normalizedReceiverIds.includes(id)
        )
    );

    if (duplicate) {
      setMessage("Cette relation existe déjà.");
      return;
    }

    if (addedTargets.length > 0) {
      setTargets((current) => [...current, ...addedTargets]);
    }

    setAgreementRelations((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        donorId: normalizedDonorId,
        receiverIds: normalizedReceiverIds
      }
    ]);
    setRelationDonorId("");
    setRelationReceiverIds([]);
    setMessage("");
  }

  function toggleGroup(groupId: string) {
    setAssignedGroupIds((current) =>
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId]
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();

    if (!title.trim() || !levelId || !originalText.trim()) {
      setMessage("Le titre, le niveau et le texte sont obligatoires.");
      return;
    }

    if (selectedWordClasses.length === 0) {
      setMessage("Choisis au moins une classe de mots à travailler.");
      return;
    }

    if (targets.length === 0) {
      setMessage("Identifie au moins un mot dans le texte.");
      return;
    }

    const analysisTargets = targets.filter(
      (target) =>
        target.isAnalysisTarget !== false &&
        selectedWordClasses.includes(target.wordClass)
    );

    if (analysisTargets.length === 0) {
      setMessage(
        "Identifie au moins un mot à trouver pour les classes travaillées."
      );
      return;
    }

    const invalid = targets.some(
      (target) =>
        originalText.slice(target.start, target.end) !== target.text
    );

    if (invalid) {
      setMessage(
        "Le texte a changé après l’identification des mots. Retire les mots invalides et sélectionne-les de nouveau."
      );
      return;
    }

    const targetIds = new Set(targets.map((target) => target.id));
    const invalidRelation = agreementRelations.some(
      (relation) =>
        !targetIds.has(relation.donorId) ||
        relation.receiverIds.length === 0 ||
        relation.receiverIds.some(
          (receiverId) =>
            !targetIds.has(receiverId) ||
            receiverId === relation.donorId
        )
    );

    if (agreementRelationsEnabled && invalidRelation) {
      setMessage(
        "Une relation d’accord contient un mot supprimé ou invalide."
      );
      return;
    }

    const now = new Date().toISOString();

    onSave({
      id: initialSentence?.id ?? crypto.randomUUID(),
      activityType: "word_classes",
      levelId,
      title: title.trim(),
      originalText,
      difficulty,
      tags: initialSentence?.tags ?? [],
      corrections: [],
      selectedWordClasses,
      wordClassTargets: sortedTargets,
      agreementRelationsEnabled,
      agreementRelations: agreementRelationsEnabled
        ? agreementRelations
        : [],
      assignedGroupIds,
      competitionEnabled: initialSentence?.competitionEnabled ?? false,
      assignmentStatusByGroup:
        initialSentence?.assignmentStatusByGroup ?? {},
      assignmentProgressByGroup:
        initialSentence?.assignmentProgressByGroup ?? {},
      createdAt: initialSentence?.createdAt ?? now,
      updatedAt: now
    });
  }

  function renderPreview() {
    const pieces: React.ReactNode[] = [];
    let cursor = 0;

    sortedTargets.forEach((target) => {
      if (target.start > cursor) {
        pieces.push(
          <span key={`text-${cursor}`}>
            {originalText.slice(cursor, target.start)}
          </span>
        );
      }

      pieces.push(
        <span className="word-class-preview-target" key={target.id}>
          <small>
            {target.isAnalysisTarget === false
              ? "Lien d’accord"
              : wordClassLabels[target.wordClass]}
          </small>
          {target.text}
        </span>
      );
      cursor = target.end;
    });

    if (cursor < originalText.length) {
      pieces.push(
        <span key={`tail-${cursor}`}>
          {originalText.slice(cursor)}
        </span>
      );
    }

    return pieces;
  }

  const compatibleGroups = groups.filter(
    (group) => group.levelId === levelId
  );

  return (
    <form className="word-class-editor" onSubmit={submit}>
      <Card className="editor-section-card">
        <span className="eyebrow">Étape 1</span>
        <h2>Informations générales</h2>

        <div className="form-grid">
          <label>
            Titre
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex. Trouver les noms"
            />
          </label>

          <label>
            Niveau
            <select
              value={levelId}
              onChange={(event) => {
                setLevelId(event.target.value);
                setAssignedGroupIds([]);
              }}
            >
              {levels.map((level) => (
                <option value={level.id} key={level.id}>
                  {level.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Difficulté
            <select
              value={difficulty}
              onChange={(event) =>
                setDifficulty(event.target.value as SentenceDifficulty)
              }
            >
              {Object.entries(difficultyLabels).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      <Card className="editor-section-card">
        <span className="eyebrow">Étape 2</span>
        <h2>Classes à travailler</h2>
        <p className="editor-help">
          Une seule classe donnera une consigne comme « Trouve tous les
          noms ». Avec plusieurs classes, le lecteur demandera de choisir la
          classe du mot.
        </p>

        <div className="word-class-choice-grid">
          {allWordClasses.map((wordClass) => {
            const selected = selectedWordClasses.includes(wordClass);

            return (
              <label
                className={`word-class-choice ${selected ? "selected" : ""}`}
                key={wordClass}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleWorkingClass(wordClass)}
                />
                <span>{wordClassLabels[wordClass]}</span>
              </label>
            );
          })}
        </div>

        <div className="word-class-selection-summary">
          <span>
            {selectedWordClasses.length} classe
            {selectedWordClasses.length > 1 ? "s" : ""} travaillée
            {selectedWordClasses.length > 1 ? "s" : ""}
          </span>
          <strong>
            {selectedWordClasses.length === 1
              ? "Clic direct dans le lecteur"
              : "Menu déroulant dans le lecteur"}
          </strong>
        </div>
      </Card>

      <Card className="editor-section-card">
        <span className="eyebrow">Étape 3</span>
        <h2>Phrase ou texte</h2>

        <label>
          Écris le contenu, puis sélectionne un mot à identifier.
          <textarea
            ref={textareaRef}
            rows={10}
            value={originalText}
            onChange={(event) => setOriginalText(event.target.value)}
            placeholder="Les petits chats noirs observent calmement les oiseaux."
          />
        </label>

        <div className="selection-toolbar">
          <Button type="button" onClick={captureSelection}>
            <Plus size={18} />
            Identifier le mot sélectionné
          </Button>
          <span>
            Sélectionne les mots à trouver et, au besoin, les autres mots
            nécessaires aux relations d’accord.
          </span>
        </div>
      </Card>

      {draft && (
        <Card className="correction-draft">
          <span className="eyebrow">Mot sélectionné</span>
          <h2>« {draft.text} »</h2>

          <label>
            Classe du mot
            <select
              value={draft.wordClass}
              onChange={(event) =>
                {
                  const wordClass = event.target.value as WordClass;
                  setDraft({
                    ...draft,
                    wordClass,
                    isAnalysisTarget:
                      selectedWordClasses.includes(wordClass)
                  });
                }
              }
            >
              {allWordClasses.map((wordClass) => (
                <option value={wordClass} key={wordClass}>
                  {wordClassLabels[wordClass]}
                </option>
              ))}
            </select>
          </label>

          <label className="editor-toggle word-analysis-toggle">
            <input
              type="checkbox"
              checked={draft.isAnalysisTarget}
              disabled={!selectedWordClasses.includes(draft.wordClass)}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  isAnalysisTarget: event.target.checked
                })
              }
            />
            <span>
              Mot à trouver durant l’analyse des classes
            </span>
          </label>

          {!selectedWordClasses.includes(draft.wordClass) && (
            <p className="editor-help">
              Cette classe n’est pas travaillée. Le mot sera conservé
              uniquement pour créer une relation d’accord.
            </p>
          )}

          <div className="form-actions">
            <Button type="button" onClick={addTarget}>
              Ajouter le mot
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDraft(null)}
            >
              Annuler
            </Button>
          </div>
        </Card>
      )}

      <Card className="editor-section-card">
        <span className="eyebrow">Étape 4</span>
        <h2>Mots identifiés</h2>

        <div className="word-class-target-list">
          {sortedTargets.map((target) => (
            <div className="word-class-target-row" key={target.id}>
              <div>
                <strong>{target.text}</strong>
                <span>
                  {target.isAnalysisTarget !== false &&
                  selectedWordClasses.includes(target.wordClass)
                    ? `${wordClassLabels[target.wordClass]} · À trouver`
                    : "Lien d’accord seulement"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTargets((current) =>
                    current.filter((item) => item.id !== target.id)
                  );
                  setAgreementRelations((current) =>
                    current
                      .filter(
                        (relation) => relation.donorId !== target.id
                      )
                      .map((relation) => ({
                        ...relation,
                        receiverIds: relation.receiverIds.filter(
                          (id) => id !== target.id
                        )
                      }))
                      .filter(
                        (relation) => relation.receiverIds.length > 0
                      )
                  );
                }}
                aria-label={`Retirer ${target.text}`}
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}

          {sortedTargets.length === 0 && (
            <p>Aucun mot n’a encore été identifié.</p>
          )}
        </div>
      </Card>

      <Card className="editor-section-card">
        <span className="eyebrow">Aperçu</span>
        <h2>{title || "Sans titre"}</h2>
        <p className="word-class-editor-preview">
          {renderPreview()}
        </p>
      </Card>

      <Card className="editor-section-card agreement-editor-card">
        <div className="agreement-editor-heading">
          <div>
            <span className="eyebrow">Étape 5 — facultative</span>
            <h2>Relations d’accord</h2>
            <p className="editor-help">
              Choisis un donneur, puis tous les mots qui reçoivent son
              accord. Le lecteur demandera ensuite de retrouver ces liens.
            </p>
          </div>

          <label className="editor-toggle">
            <input
              type="checkbox"
              checked={agreementRelationsEnabled}
              onChange={(event) =>
                setAgreementRelationsEnabled(event.target.checked)
              }
            />
            <span>Activer les relations d’accord</span>
          </label>
        </div>

        {agreementRelationsEnabled && (
          <>
            <div className="agreement-builder">
              <label>
                Donneur
                <select
                  value={relationDonorId}
                  onChange={(event) => {
                    const donorId = event.target.value;
                    setRelationDonorId(donorId);
                    setRelationReceiverIds((current) =>
                      current.filter((id) => id !== donorId)
                    );
                  }}
                >
                  <option value="">Choisir un mot</option>
                  {relationWordCandidates.map((candidate) => (
                    <option value={candidate.id} key={candidate.id}>
                      {candidate.text}
                      {candidate.existingTarget
                        ? ` — ${wordClassLabels[candidate.existingTarget.wordClass]}`
                        : ""}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <span className="agreement-builder-label">
                  Receveurs
                </span>

                <div className="agreement-receiver-grid">
                  {relationWordCandidates
                    .filter(
                      (candidate) => candidate.id !== relationDonorId
                    )
                    .map((candidate) => (
                      <label
                        className={`agreement-receiver-choice ${
                          relationReceiverIds.includes(candidate.id)
                            ? "selected"
                            : ""
                        }`}
                        key={candidate.id}
                      >
                        <input
                          type="checkbox"
                          checked={relationReceiverIds.includes(candidate.id)}
                          onChange={() => toggleReceiver(candidate.id)}
                        />
                        <span>
                          <strong>{candidate.text}</strong>
                          <small>
                            {candidate.existingTarget
                              ? wordClassLabels[
                                  candidate.existingTarget.wordClass
                                ]
                              : "Mot du texte"}
                          </small>
                        </span>
                      </label>
                    ))}
                </div>
              </div>

              <Button type="button" onClick={addAgreementRelation}>
                <Plus size={18} />
                Ajouter la relation
              </Button>
            </div>

            <div className="agreement-relation-list">
              <div className="agreement-relation-list-heading">
                <strong>Relations créées</strong>
                <span>{agreementRelations.length}</span>
              </div>

              {agreementRelations.map((relation) => {
                const donor = targets.find(
                  (target) => target.id === relation.donorId
                );
                const receivers = relation.receiverIds
                  .map((id) =>
                    targets.find((target) => target.id === id)
                  )
                  .filter(
                    (target): target is WordClassTarget => Boolean(target)
                  );

                return (
                  <div className="agreement-relation-row" key={relation.id}>
                    <div>
                      <span>Donneur</span>
                      <strong>{donor?.text ?? "Mot supprimé"}</strong>
                    </div>

                    <span className="agreement-arrow">→</span>

                    <div>
                      <span>Receveurs</span>
                      <strong>
                        {receivers.map((receiver) => receiver.text).join(", ")}
                      </strong>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setAgreementRelations((current) =>
                          current.filter((item) => item.id !== relation.id)
                        )
                      }
                      aria-label="Supprimer la relation"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                );
              })}

              {agreementRelations.length === 0 && (
                <p>Aucune relation d’accord n’a encore été créée.</p>
              )}
            </div>
          </>
        )}
      </Card>

      <Card className="editor-section-card">
        <span className="eyebrow">Attribution</span>
        <h2>Groupes</h2>

        <div className="assignment-chips">
          {compatibleGroups.map((group) => {
            const assigned = assignedGroupIds.includes(group.id);

            return (
              <button
                type="button"
                className={`assignment-chip ${assigned ? "assigned" : ""}`}
                onClick={() => toggleGroup(group.id)}
                key={group.id}
              >
                {group.name}
              </button>
            );
          })}

          {compatibleGroups.length === 0 && (
            <span>Aucun groupe pour ce niveau.</span>
          )}
        </div>
      </Card>

      {message && <p className="editor-error-message">{message}</p>}

      <div className="editor-save-row">
        <Button type="submit">
          <Save size={18} />
          Enregistrer l’activité
        </Button>
      </div>
    </form>
  );
}
