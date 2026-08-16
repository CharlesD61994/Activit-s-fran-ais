"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReaderChromePortal } from "@/components/presentation/reader-chrome";
import type { GrammarWorkflowPhase } from "@/types";

type Props = {
  phase: GrammarWorkflowPhase;
  onContinue: () => void;
};

export function CorrectionPause({ phase, onContinue }: Props) {
  const duration = phase.reviewDurationSeconds ?? 0;
  const [remaining, setRemaining] = useState<number>(duration);

  useEffect(() => {
    setRemaining(duration);
  }, [duration, phase.id]);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setTimeout(
      () => setRemaining((value) => Math.max(0, value - 1)),
      1000
    );
    return () => window.clearTimeout(timer);
  }, [remaining]);

  return (
    <>
      <ReaderChromePortal slot="instruction">
        <div className="reader-chrome-instruction-copy correction-pause-instruction">
          <strong>{phase.title.trim() || "Temps de correction"}</strong>
          <span>Prends le temps de corriger ta feuille. Toutes les réponses restent affichées au tableau.</span>
        </div>
      </ReaderChromePortal>
      <ReaderChromePortal slot="progress">
        <div className="reader-chrome-progress correction-pause-progress">
          <Clock3 size={20} />
          <strong>
            {duration === 0
              ? "Pause contrôlée par l’enseignant"
              : remaining > 0
                ? `${remaining} s`
                : "Temps écoulé"}
          </strong>
        </div>
      </ReaderChromePortal>
      <ReaderChromePortal slot="actions">
        <Button type="button" onClick={onContinue}>
          Passer à la prochaine phase
          <ArrowRight size={18} />
        </Button>
      </ReaderChromePortal>
    </>
  );
}
