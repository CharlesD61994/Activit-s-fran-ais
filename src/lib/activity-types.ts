import type { ActivityType, WordClass } from "@/types";

export const activityTypeLabels: Record<ActivityType, string> = {
  sentence_correction: "Phrase à corriger",
  text_correction: "Texte à corriger",
  word_classes: "Classes de mots",
  word_groups: "Groupes de mots",
  tree_analysis: "Analyse en arbre"
};

export const wordClassLabels: Record<WordClass, string> = {
  noun: "Nom",
  determiner: "Déterminant",
  verb: "Verbe",
  preposition: "Préposition",
  adverb: "Adverbe",
  adjective: "Adjectif",
  pronoun: "Pronom",
  conjunction: "Conjonction",
  interjection: "Interjection"
};

export const allWordClasses = Object.keys(wordClassLabels) as WordClass[];

export function getActivityTypeLabel(
  type: ActivityType | undefined
): string {
  return activityTypeLabels[type ?? "sentence_correction"];
}


export function getWordClassActivityPointTotal(
  sentence: import("@/types").Sentence
): number {
  const allTargets = sentence.wordClassTargets ?? [];
  const selectedClasses = sentence.selectedWordClasses ?? [];
  const targets = allTargets.filter(
    (target) =>
      target.isAnalysisTarget !== false &&
      selectedClasses.includes(target.wordClass)
  );
  const classPoints =
    targets.length * (selectedClasses.length > 1 ? 2 : 1);

  if (!sentence.agreementRelationsEnabled) return classPoints;

  const targetMap = new Map(
    allTargets.map((target) => [target.id, target])
  );

  const relatedAnalysisTargetIds = new Set<string>();
  let agreementPoints = 0;

  (sentence.agreementRelations ?? []).forEach((relation) => {
    const donor = targetMap.get(relation.donorId);

    if (
      donor &&
      donor.isAnalysisTarget !== false &&
      selectedClasses.includes(donor.wordClass)
    ) {
      relatedAnalysisTargetIds.add(donor.id);
      agreementPoints += relation.receiverIds.length;
      return;
    }

    relation.receiverIds.forEach((receiverId) => {
      const receiver = targetMap.get(receiverId);

      if (
        receiver &&
        receiver.isAnalysisTarget !== false &&
        selectedClasses.includes(receiver.wordClass)
      ) {
        relatedAnalysisTargetIds.add(receiver.id);
        agreementPoints += 1;
      }
    });
  });

  const rolePoints = relatedAnalysisTargetIds.size;

  return classPoints + rolePoints + agreementPoints;
}


export function getWordClassAnalysisTargetCount(
  sentence: import("@/types").Sentence
): number {
  const selectedClasses = sentence.selectedWordClasses ?? [];

  return (sentence.wordClassTargets ?? []).filter(
    (target) =>
      target.isAnalysisTarget !== false &&
      selectedClasses.includes(target.wordClass)
  ).length;
}
