import { wordClassLabels } from "@/lib/activity-types";
import type { GrammarAnnotationKind, WordClass, WordGroupType } from "@/types";

export const grammarAnnotationLabels: Record<Exclude<GrammarAnnotationKind, "error">, string> = {
  group: "Groupe", word_class: "Classe de mot", nucleus: "Noyau", function: "Fonction", donor: "Donneur", receiver: "Receveur", gender_number: "Genre et nombre"
};

export function grammarFunctionInstructionLabel(label?: string) {
  const value = label?.trim().toLocaleLowerCase("fr-CA");
  if (!value) return "la fonction demandée";
  if (value.startsWith("attribut")) return `l’${value}`;
  if (
    value.startsWith("sujet") ||
    value.startsWith("prédicat") ||
    value.startsWith("complément")
  ) {
    return `le ${value}`;
  }
  return `la fonction « ${value} »`;
}

export const sentenceFunctionOptions = ["Sujet", "Prédicat", "Complément de phrase", "Complément direct", "Complément indirect", "Attribut du sujet", "Complément du nom", "Complément de l’adjectif", "Modificateur"];
export const wordGroupCodes: WordGroupType[] = ["GN", "GV", "GAdj", "GAdv", "GPrep"];
export const wordGroupAnswerLabels: Record<WordGroupType, string> = { GN: "Groupe nominal — GN", GV: "Groupe verbal — GV", GAdj: "Groupe adjectival — GAdj", GAdv: "Groupe adverbial — GAdv", GPrep: "Groupe prépositionnel — GPrép" };
export const grammarAnnotationAnswers: Partial<Record<GrammarAnnotationKind, string[]>> = {
  group: wordGroupCodes.map((code) => code === "GPrep" ? "GPrép" : code),
  word_class: (Object.keys(wordClassLabels) as WordClass[]).map((wordClass) => wordClassLabels[wordClass]),
  nucleus: (Object.keys(wordClassLabels) as WordClass[]).map((wordClass) => wordClassLabels[wordClass]),
  function: sentenceFunctionOptions,
  donor: ["Donneur d’accord"],
  receiver: ["Receveur d’accord"]
};
