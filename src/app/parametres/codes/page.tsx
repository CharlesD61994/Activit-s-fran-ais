"use client";

import { CorrectionCodeManager } from "@/components/correction-code-manager";
import { useAppStore } from "@/store/app-store";

export default function CorrectionCodesPage() {
  const { data, saveCorrectionCode, deleteCorrectionCode } = useAppStore();
  const usedCodeIds = Array.from(new Set(
    data.sentences.flatMap((sentence) => sentence.corrections.map((correction) => correction.correctionCodeId))
  ));

  return (
    <div className="page">
      <div className="page-header">
        <span className="eyebrow">Paramètres pédagogiques</span>
        <h1>Codes de correction</h1>
        <p>Personnalise les codes proposés lors de la création des phrases.</p>
      </div>
      <CorrectionCodeManager
        codes={data.correctionCodes}
        onSave={saveCorrectionCode}
        onDelete={deleteCorrectionCode}
        usedCodeIds={usedCodeIds}
      />
    </div>
  );
}
