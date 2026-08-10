"use client";

import { GrammarExtensionReader } from "@/components/presentation/grammar-extension-reader";
import type { GrammarWorkflowPhase, Sentence } from "@/types";

type Props = { sentence: Sentence; phases: GrammarWorkflowPhase[]; persistenceKey?: string; finishControl?: React.ReactNode };

// Une seule surface de phrase demeure montée pendant toutes les phases.
// Les marques réussies restent donc visibles pendant les actions suivantes.
export function MixedGrammarReader({ sentence, phases, persistenceKey, finishControl }: Props) {
  return <GrammarExtensionReader sentence={{ ...sentence, workflowPhases: phases }} persistenceKey={persistenceKey ? `${persistenceKey}-unified-mixed` : undefined} finishControl={finishControl}/>;
}
