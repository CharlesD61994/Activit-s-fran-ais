"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { SentenceEditor } from "@/components/sentence-editor";
import { WordClassEditor } from "@/components/word-class-editor";
import { WordGroupEditor } from "@/components/word-group-editor";
import { TreeAnalysisEditor } from "@/components/tree-analysis-editor";
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

  const isTextActivity = sentence.activityType === "text_correction";
  const isWordClassActivity = sentence.activityType === "word_classes";
  const isWordGroupActivity = sentence.activityType === "word_groups";
  const isTreeAnalysisActivity = sentence.activityType === "tree_analysis";

  return (
    <div className="page">
      <Link className="back-link" href="/phrases"><ArrowLeft size={17} /> Retour aux activités</Link>
      <div className="page-header">
        <span className="eyebrow">Modification</span>
        <h1>{sentence.title}</h1>
        <p>
          {isTreeAnalysisActivity
            ? "Modifie la phrase et sa mise en page d’analyse en arbre."
            : isWordGroupActivity
            ? "Modifie les groupes délimités, leur type et leur noyau."
            : isWordClassActivity
            ? "Modifie les classes travaillées et les mots identifiés."
            : isTextActivity
              ? "Modifie le texte, ses corrections ou ses paramètres."
              : "Modifie la phrase, ses corrections ou ses paramètres."}
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
      ) : isWordGroupActivity ? (
        <WordGroupEditor
          initialSentence={sentence}
          levels={data.levels}
          groups={data.groups}
          onSave={(updated) => {
            saveSentence(updated);
            router.push("/phrases");
          }}
        />
      ) : isWordClassActivity ? (
        <WordClassEditor
          initialSentence={sentence}
          levels={data.levels}
          groups={data.groups}
          onSave={(updated) => {
            saveSentence(updated);
            router.push("/phrases");
          }}
        />
      ) : (
        <SentenceEditor
          initialSentence={sentence}
          levels={data.levels}
          groups={data.groups}
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
