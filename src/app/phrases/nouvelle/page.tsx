"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { SentenceEditor } from "@/components/sentence-editor";
import { WordClassEditor } from "@/components/word-class-editor";
import { WordGroupEditor } from "@/components/word-group-editor";
import { TreeAnalysisEditor } from "@/components/tree-analysis-editor";
import { MixedGrammarEditor } from "@/components/mixed-grammar-editor";
import { useAppStore } from "@/store/app-store";
import type { ActivityType, GrammarObjective } from "@/types";

export default function NewSentencePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, saveSentence } = useAppStore();

  const requestedType = searchParams.get("type");
  const activityType: ActivityType =
    requestedType === "text_correction"
      ? "text_correction"
      : requestedType === "word_classes"
        ? "word_classes"
        : requestedType === "word_groups"
          ? "word_groups"
          : requestedType === "tree_analysis"
            ? "tree_analysis"
            : "sentence_correction";
  const requestedObjective = searchParams.get("objective");
  const primaryObjective: GrammarObjective | undefined =
    requestedObjective === "functions" || requestedObjective === "agreements" || requestedObjective === "mixed_grammar"
      ? requestedObjective
      : undefined;

  const saveAndReturn = (sentence: Parameters<typeof saveSentence>[0]) => {
    saveSentence(sentence);
    router.push("/phrases");
  };

  return (
    <div className="page">
      <Link className="back-link" href="/phrases">
        <ArrowLeft size={17} />
        Retour aux activités
      </Link>

      <div className="page-header">
        <span className="eyebrow">Création</span>
        <h1>
          {primaryObjective === "mixed_grammar"
            ? "Nouvelle activité grammaticale mixte"
            : activityType === "tree_analysis"
            ? "Nouvelle analyse en arbre"
            : activityType === "word_groups"
            ? "Nouvelle activité sur les groupes de mots"
            : activityType === "word_classes"
            ? "Nouvelle activité sur les classes de mots"
            : activityType === "text_correction"
              ? "Nouveau texte à corriger"
              : "Nouvelle phrase à corriger"}
        </h1>
        <p>
          {primaryObjective === "mixed_grammar"
            ? "Écris une phrase, annote ses réponses visuellement, puis organise librement les phases et leurs sous-actions."
            : activityType === "tree_analysis"
            ? "Écris une phrase compatible avec une feuille Lettre en paysage, puis construis son arbre."
            : activityType === "word_groups"
            ? "Écris la phrase, délimite chaque groupe, choisis son type et identifie son noyau."
            : activityType === "word_classes"
            ? "Choisis les classes travaillées, écris le contenu, puis identifie les mots et leur classe."
            : activityType === "text_correction"
              ? "Ajoute un texte, puis identifie les fautes et leurs corrections."
              : "Ajoute une phrase, puis sélectionne précisément les segments fautifs."}
        </p>
      </div>

      {primaryObjective === "mixed_grammar" ? (
        <MixedGrammarEditor
          levels={data.levels}
          groups={data.groups}
          correctionCodes={data.correctionCodes}
          onSave={saveAndReturn}
        />
      ) : activityType === "tree_analysis" ? (
        <TreeAnalysisEditor
          levels={data.levels}
          groups={data.groups}
          onSave={saveAndReturn}
        />
      ) : activityType === "word_groups" ? (
        <WordGroupEditor
          levels={data.levels}
          groups={data.groups}
          onSave={saveAndReturn}
        />
      ) : activityType === "word_classes" ? (
        <WordClassEditor
          levels={data.levels}
          groups={data.groups}
          onSave={saveAndReturn}
        />
      ) : (
        <SentenceEditor
          activityType={activityType}
          primaryObjective={primaryObjective}
          levels={data.levels}
          groups={data.groups}
          correctionCodes={data.correctionCodes}
          onSave={saveAndReturn}
        />
      )}
    </div>
  );
}
