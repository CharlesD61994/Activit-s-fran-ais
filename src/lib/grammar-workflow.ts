import type {
  ActivityType,
  GrammarActionKind,
  GrammarObjective,
  GrammarPhaseKind,
  GrammarWorkflowPhase,
  Sentence
} from "@/types";

export const grammarObjectiveLabels: Record<GrammarObjective, string> = {
  sentence_correction: "Phrase à corriger",
  text_correction: "Texte à corriger",
  word_classes: "Classes de mots",
  word_groups: "Groupes de mots",
  functions: "Fonctions",
  agreements: "Accords — donneurs et receveurs",
  mixed_grammar: "Activité grammaticale mixte"
};

export const grammarPhaseLabels: Record<GrammarPhaseKind, string> = {
  correction: "Correction",
  groups: "Groupes de mots",
  word_classes: "Classes de mots",
  nuclei: "Noyaux",
  functions: "Fonctions",
  agreements: "Donneurs et receveurs",
  table: "Tableau"
};

export const grammarActionLabels: Record<GrammarActionKind, string> = {
  find_errors: "Repérer les erreurs",
  write_corrections: "Écrire les corrections",
  identify_codes: "Identifier les codes",
  frame_groups: "Encadrer les groupes",
  identify_group_types: "Identifier le type des groupes",
  identify_word_classes: "Identifier les classes de mots",
  find_nuclei: "Trouver les noyaux",
  frame_functions: "Encadrer les fonctions",
  identify_functions: "Identifier les fonctions",
  identify_donors: "Identifier les donneurs",
  identify_receivers: "Identifier les receveurs",
  link_agreement: "Relier les donneurs et les receveurs",
  complete_table: "Compléter le tableau"
};

const actionsByPhase: Record<GrammarPhaseKind, GrammarActionKind[]> = {
  correction: ["find_errors", "write_corrections", "identify_codes"],
  groups: ["frame_groups", "identify_group_types"],
  word_classes: ["identify_word_classes"],
  nuclei: ["find_nuclei"],
  functions: ["frame_functions", "identify_functions"],
  agreements: ["identify_donors", "identify_receivers", "link_agreement"],
  table: ["complete_table"]
};

export function createWorkflowPhase(kind: GrammarPhaseKind): GrammarWorkflowPhase {
  return {
    id: crypto.randomUUID(),
    kind,
    title: grammarPhaseLabels[kind],
    actions: actionsByPhase[kind].map((actionKind) => ({
      id: crypto.randomUUID(),
      kind: actionKind,
      enabled: true,
      responseMode: actionKind === "frame_groups" ? "brackets" : actionKind === "frame_functions" ? "frame" : undefined
    }))
  };
}

export function objectiveFromActivityType(type?: ActivityType): GrammarObjective {
  if (type === "text_correction") return "text_correction";
  if (type === "word_classes") return "word_classes";
  if (type === "word_groups") return "word_groups";
  return "sentence_correction";
}

export function defaultWorkflowForObjective(objective: GrammarObjective): GrammarWorkflowPhase[] {
  if (objective === "word_classes") return [createWorkflowPhase("word_classes")];
  if (objective === "word_groups") return [createWorkflowPhase("groups"), createWorkflowPhase("nuclei")];
  if (objective === "functions") return [createWorkflowPhase("functions")];
  if (objective === "agreements") return [createWorkflowPhase("agreements")];
  if (objective === "mixed_grammar") return [];
  return [createWorkflowPhase("correction")];
}

export function getSentenceObjective(sentence: Sentence): GrammarObjective {
  return sentence.primaryObjective ?? objectiveFromActivityType(sentence.activityType);
}

export function getSentenceWorkflow(sentence: Sentence): GrammarWorkflowPhase[] {
  return sentence.workflowPhases?.length
    ? sentence.workflowPhases
    : defaultWorkflowForObjective(getSentenceObjective(sentence));
}

export function getSecondaryObjectives(sentence: Sentence): GrammarPhaseKind[] {
  const primary = getSentenceObjective(sentence);
  const primaryPhase: Partial<Record<GrammarObjective, GrammarPhaseKind>> = {
    sentence_correction: "correction",
    text_correction: "correction",
    word_classes: "word_classes",
    word_groups: "groups",
    functions: "functions",
    agreements: "agreements"
  };
  return getSentenceWorkflow(sentence)
    .map((phase) => phase.kind)
    .filter((kind, index, all) => kind !== primaryPhase[primary] && all.indexOf(kind) === index);
}
