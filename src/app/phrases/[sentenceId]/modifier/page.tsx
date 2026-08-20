"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { TreeAnalysisEditor } from "@/components/tree-analysis-editor";
import { MixedActivityEditor } from "@/components/mixed-activity-editor";
import { WorksheetEditor } from "@/components/worksheet-editor";
import { Card } from "@/components/ui/card";
import { useAppStore } from "@/store/app-store";

export default function EditSentencePage({ params }: { params: Promise<{ sentenceId: string }> }) {
  const { sentenceId } = use(params);
  const router = useRouter();
  const { data, saveSentence } = useAppStore();
  const sentence = data.sentences.find((item) => item.id === sentenceId);

  if (!sentence) {
    return <div className="page"><Card><h1>Activité introuvable</h1><Link href="/phrases">Retour aux activités</Link></Card></div>;
  }

  const isTreeAnalysisActivity = sentence.activityType === "tree_analysis";
  const isWorksheetActivity = sentence.activityType === "worksheet";

  return (
    <div className="page">
      <Link className="back-link" href="/phrases"><ArrowLeft size={17} /> Retour aux activités</Link>
      <div className="page-header">
        <span className="eyebrow">Modification</span>
        <h1>{sentence.title}</h1>
        <p>
          {isTreeAnalysisActivity
            ? "Modifie la phrase et sa mise en page d’analyse en arbre."
            : isWorksheetActivity ? "Modifie la mise en page, les réponses et le déroulement de la feuille." : "Modifie le contenu, les réponses et le déroulement dans l’éditeur grammatical unifié."}
        </p>
      </div>
      {isTreeAnalysisActivity ? (
        <TreeAnalysisEditor
          initialSentence={sentence}
          levels={data.levels}
          groups={data.groups}
          onSave={(updated) => {
            saveSentence(updated);
            router.push("/phrases");
          }}
        />
      ) : isWorksheetActivity ? (
        <WorksheetEditor initialSentence={sentence} levels={data.levels} onSave={(updated) => { saveSentence(updated); router.push("/phrases"); }}/>
      ) : (
        <MixedActivityEditor
          initialSentence={sentence}
          levels={data.levels}
          correctionCodes={data.correctionCodes}
          onSave={(updated) => {
            saveSentence(updated);
            router.push("/phrases");
          }}
        />
      )}
    </div>
  );
}
