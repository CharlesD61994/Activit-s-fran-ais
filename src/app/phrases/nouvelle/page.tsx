"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { TreeAnalysisEditor } from "@/components/tree-analysis-editor";
import { MixedActivityEditor } from "@/components/mixed-activity-editor";
import { useAppStore } from "@/store/app-store";

export default function NewSentencePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, saveSentence } = useAppStore();

  const isTreeAnalysis = searchParams.get("type") === "tree_analysis";

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
        <h1>{isTreeAnalysis ? "Nouvelle analyse en arbre" : "Nouvelle activité grammaticale"}</h1>
        <p>
          {isTreeAnalysis
            ? "Écris une phrase compatible avec une feuille Lettre en paysage, puis construis son arbre."
            : "Sélectionne les réponses dans la phrase ou le texte, configure leurs gestes, puis organise les phases du lecteur."}
        </p>
      </div>

      {isTreeAnalysis ? (
        <TreeAnalysisEditor
          levels={data.levels}
          groups={data.groups}
          onSave={saveAndReturn}
        />
      ) : (
        <MixedActivityEditor levels={data.levels} correctionCodes={data.correctionCodes} onSave={saveAndReturn}/>
      )}
    </div>
  );
}
