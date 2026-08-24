"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, FileText, Pencil, Plus, Search, Tags, Trash2, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SentenceRenderer } from "@/components/sentence-renderer";
import { ActivityObjectiveBadges } from "@/components/activity-objective-badges";
import { useAppStore } from "@/store/app-store";
import {
  getWordClassActivityPointTotal,
  getWordClassAnalysisTargetCount
} from "@/lib/activity-types";
import type { ActivityType, SentenceDifficulty } from "@/types";

const difficultyLabels: Record<SentenceDifficulty, string> = {
  easy: "Facile",
  medium: "Moyenne",
  hard: "Difficile"
};

export default function SentencesPage() {
  const { data, deleteSentence, duplicateSentence, saveSentence, toggleActivityCompetition } = useAppStore();
  const [query, setQuery] = useState("");
  const [levelId, setLevelId] = useState("all");
  const [difficulty, setDifficulty] = useState<SentenceDifficulty | "all">("all");
  const [activityType, setActivityType] = useState<ActivityType | "all">("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [showTypeModal, setShowTypeModal] = useState(false);

  const activeSchoolYear = data.schoolYears
    .slice()
    .sort((a, b) => b.order - a.order)[0];

  const availableTags = useMemo(() => Array.from(new Set(data.sentences.flatMap((sentence) => sentence.tags))).sort((a, b) => a.localeCompare(b, "fr-CA")), [data.sentences]);

  const filtered = useMemo(() => data.sentences.filter((sentence) => {
    const matchesQuery = `${sentence.title} ${sentence.originalText} ${sentence.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase());
    const matchesLevel = levelId === "all" || sentence.levelId === levelId;
    const sentenceType = sentence.activityType ?? "sentence_correction";
    const matchesDifficulty = difficulty === "all" || sentence.difficulty === difficulty;
    const matchesType = activityType === "all" || sentenceType === activityType;
    const matchesTag = tagFilter === "all" || sentence.tags.includes(tagFilter);
    return matchesQuery && matchesLevel && matchesDifficulty && matchesType && matchesTag;
  }), [activityType, data.sentences, difficulty, levelId, query, tagFilter]);


  function toggleGroupAssignment(sentenceId: string, groupId: string) {
    const sentence = data.sentences.find((item) => item.id === sentenceId);
    if (!sentence) return;

    const assignedGroupIds = sentence.assignedGroupIds.includes(groupId)
      ? sentence.assignedGroupIds.filter((id) => id !== groupId)
      : [...sentence.assignedGroupIds, groupId];

    saveSentence({
      ...sentence,
      assignedGroupIds,
      updatedAt: new Date().toISOString()
    });
  }

  return (
    <div className="page activities-bank-page">
      <div className="hero compact">
        <div>
          <span className="eyebrow">Contenu pédagogique</span>
          <h1>Banque d’activités</h1>
          <p>Crée, classe, assigne et modifie les phrases destinées à tes groupes.</p>
        </div>
        <Button onClick={() => setShowTypeModal(true)}>
          <Plus size={18} />
          Nouvelle activité
        </Button>
      </div>

      <Card className="filters">
        <label className="search-field"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une activité..." /></label>
        <select value={levelId} onChange={(event) => setLevelId(event.target.value)} aria-label="Filtrer par niveau">
          <option value="all">Tous les niveaux</option>
          {data.levels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}
        </select>
        <select
          value={activityType}
          onChange={(event) => setActivityType(event.target.value as ActivityType | "all")}
          aria-label="Filtrer par type"
        >
          <option value="all">Tous les types</option>
          <option value="sentence_correction">Phrase à corriger</option>
          <option value="text_correction">Texte à corriger</option>
          <option value="word_classes">Classes de mots</option>
          <option value="word_groups">Groupes de mots</option>
          <option value="tree_analysis">Analyse en arbre</option>
          <option value="worksheet">Feuille d’activité</option>
        </select>

        <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as SentenceDifficulty | "all")} aria-label="Filtrer par difficulté">
          <option value="all">Toutes les difficultés</option>
          <option value="easy">Facile</option>
          <option value="medium">Moyenne</option>
          <option value="hard">Difficile</option>
        </select>
        <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} aria-label="Filtrer par tag">
          <option value="all">Tous les tags</option>
          {availableTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
        </select>
      </Card>

      <div className="sentence-list">
        {filtered.map((sentence) => {
          const level = data.levels.find((item) => item.id === sentence.levelId);
          const isWordClassActivity = sentence.activityType === "word_classes";
          const isWordGroupActivity = sentence.activityType === "word_groups";
          const isTreeAnalysisActivity = sentence.activityType === "tree_analysis";
          const isWorksheetActivity = sentence.activityType === "worksheet";
          const targetCount =
            getWordClassAnalysisTargetCount(sentence);
          const wordGroupCount = sentence.wordGroupTargets?.length ?? 0;
          const treeAnalysisStepCount =
            (sentence.treeAnalysisInteractions?.length ?? 0) +
            (sentence.treeAnalysisNodes?.length ?? 0) +
            (sentence.treeAnalysisTables?.length ?? 0);
          const worksheetStepCount = (sentence.worksheetAnswerLines?.length ?? 0) + (sentence.treeAnalysisTables?.filter((table) => table.cells.some((cell) => cell.isCorrect || Boolean(cell.answer?.trim()))).length ?? 0);
          const maxPoints = isWordClassActivity
            ? getWordClassActivityPointTotal(sentence)
            : isWordGroupActivity
              ? wordGroupCount * 2
              : isTreeAnalysisActivity
                ? treeAnalysisStepCount
                : isWorksheetActivity
                  ? worksheetStepCount
                  : sentence.corrections.reduce(
                (sum, correction) => sum + correction.points,
                0
              );
          return (
            <Card key={sentence.id} className="sentence-card">
              <div className="sentence-card-top">
                <div>
                  <span className="eyebrow">
                    {level?.name ?? "Niveau inconnu"} · {difficultyLabels[sentence.difficulty]}
                  </span>
                  <ActivityObjectiveBadges sentence={sentence} />
                  <h2>{sentence.title}</h2>
                </div>
                <div className="row-actions">
                  <Link href={`/phrases/${sentence.id}/modifier`} aria-label="Modifier"><Pencil size={18} /></Link>
                  <button onClick={() => duplicateSentence(sentence.id)} aria-label="Dupliquer"><Copy size={18} /></button>
                  <button onClick={() => {
                    if (window.confirm("Supprimer cette activité?")) deleteSentence(sentence.id);
                  }} aria-label="Supprimer"><Trash2 size={18} /></button>
                </div>
              </div>
              <SentenceRenderer sentence={sentence} />

              <div className="activity-competition-row">
                <label className="competition-toggle">
                  <input
                    type="checkbox"
                    checked={Boolean(sentence.competitionEnabled)}
                    onChange={() => toggleActivityCompetition(sentence.id)}
                  />
                  <span>Compétition amicale</span>
                </label>
              </div>

              <div className="sentence-assignment">
                <div className="sentence-assignment-heading">
                  <span><Users size={17} /> Attribuer l’activité aux groupes</span>
                </div>
                <div className="assignment-chips">
                  {data.groups
                    .filter(
                      (group) =>
                        group.levelId === sentence.levelId &&
                        group.schoolYearId === activeSchoolYear?.id
                    )
                    .map((group) => {
                      const assigned = sentence.assignedGroupIds.includes(group.id);
                      return (
                        <button
                          key={group.id}
                          className={`assignment-chip ${assigned ? "assigned" : ""}`}
                          onClick={() => toggleGroupAssignment(sentence.id, group.id)}
                          type="button"
                        >
                          {assigned && <Check size={15} />}
                          {group.name}
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="sentence-meta">
                <span>
                  {isWordClassActivity
                    ? `${targetCount} mot${targetCount > 1 ? "s" : ""}`
                    : isWordGroupActivity
                      ? `${wordGroupCount} groupe${wordGroupCount > 1 ? "s" : ""}`
                      : isWorksheetActivity
                        ? `${sentence.treeAnalysisDocumentPages?.length ?? 1} page${(sentence.treeAnalysisDocumentPages?.length ?? 1) > 1 ? "s" : ""}`
                      : `${sentence.corrections.length} erreur${sentence.corrections.length > 1 ? "s" : ""}`}
                </span>
                <span>{maxPoints} points</span>
                <span>{sentence.assignedGroupIds.length} groupe{sentence.assignedGroupIds.length > 1 ? "s" : ""}</span>
                {sentence.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && <Card><h2>Aucune activité trouvée</h2><p>Modifie les filtres ou crée une nouvelle activité.</p></Card>}
      </div>

      {showTypeModal && (
        <div className="modal-backdrop">
          <Card className="modal-card activity-type-modal" role="dialog" aria-modal="true" aria-label="Choisir le type d’activité">
            <div className="modal-heading">
              <div>
                <span className="eyebrow">Nouvelle activité</span>
                <h2>Quel type veux-tu créer?</h2>
              </div>
              <button
                type="button"
                className="icon-control"
                onClick={() => setShowTypeModal(false)}
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="activity-type-choice-grid">
              <Link
                href="/phrases/nouvelle?type=sentence_correction&objective=mixed_grammar"
                className="activity-type-choice"
                onClick={() => setShowTypeModal(false)}
              >
                <span className="activity-choice-icon">
                  <Plus size={29} />
                </span>
                <div>
                  <strong>Activité grammaticale</strong>
                  <p>Crée une activité simple ou compose plusieurs phases à partir d’une phrase ou d’un texte.</p>
                </div>
              </Link>

              <Link
                href="/phrases/nouvelle?type=tree_analysis"
                className="activity-type-choice"
                onClick={() => setShowTypeModal(false)}
              >
                <span className="activity-choice-icon">
                  <Tags size={29} />
                </span>
                <div>
                  <strong>Analyse en arbre</strong>
                  <p>
                    Construis une analyse syntaxique destinée à l’écran
                    et à l’impression en format paysage.
                  </p>
                </div>
              </Link>
              <Link href="/phrases/nouvelle?type=worksheet" className="activity-type-choice">
                <span className="activity-choice-icon"><FileText size={29}/></span>
                <div><strong>Feuille d’activité</strong><p>Crée une feuille portrait avec du texte, des tableaux et des réponses révélables.</p></div>
              </Link>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
