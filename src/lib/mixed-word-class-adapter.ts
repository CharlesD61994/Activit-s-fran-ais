import { wordClassLabels } from "@/lib/activity-types";
import type {
  AgreementRelation,
  GrammarAnnotation,
  Sentence,
  WordClass,
  WordClassTarget
} from "@/types";

function normalizeLabel(value: string | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/gi, "")
    .toLocaleLowerCase("fr-CA");
}

const classByLabel = new Map<string, WordClass>(
  (Object.entries(wordClassLabels) as Array<[WordClass, string]>).flatMap(
    ([wordClass, label]) => [
      [normalizeLabel(wordClass), wordClass] as const,
      [normalizeLabel(label), wordClass] as const
    ]
  )
);

function annotationClass(annotation: GrammarAnnotation) {
  return classByLabel.get(normalizeLabel(annotation.label));
}

function targetForAnnotation(annotation: GrammarAnnotation, targets: WordClassTarget[]) {
  return targets.find((target) => target.start === annotation.start && target.end === annotation.end);
}

/** Convert mixed-editor answers to the native WordClassReader data model. */
export function buildMixedWordClassSentence(sentence: Sentence): Sentence {
  const annotations = sentence.grammarAnnotations ?? [];
  const annotationTargets = annotations
    .filter((annotation) => annotation.kind === "word_class")
    .map((annotation): WordClassTarget | null => {
      const wordClass = annotationClass(annotation);
      if (!wordClass) return null;
      return {
        id: annotation.id,
        start: annotation.start,
        end: annotation.end,
        text: sentence.originalText.slice(annotation.start, annotation.end),
        wordClass,
        isAnalysisTarget: true
      };
    })
    .filter((target): target is WordClassTarget => Boolean(target));

  const targetMap = new Map<string, WordClassTarget>();
  [...(sentence.wordClassTargets ?? []), ...annotationTargets].forEach((target) => targetMap.set(target.id, target));
  const targets = Array.from(targetMap.values());
  const donorAnnotations = annotations.filter((annotation) => annotation.kind === "donor");
  const receiverAnnotations = annotations.filter((annotation) => annotation.kind === "receiver");
  const donorTargets = new Map(donorAnnotations.flatMap((annotation) => {
    const target = targetForAnnotation(annotation, targets);
    return target ? [[annotation.id, target] as const] : [];
  }));
  const receiverTargets = new Map(receiverAnnotations.flatMap((annotation) => {
    const target = targetForAnnotation(annotation, targets);
    return target ? [[annotation.id, target] as const] : [];
  }));

  const generatedRelations = new Map<string, AgreementRelation>();
  donorAnnotations.forEach((donor) => {
    const donorTarget = donorTargets.get(donor.id);
    if (!donorTarget) return;
    const linkedReceivers = receiverAnnotations.filter((receiver) => {
      const explicitLink = receiver.linkedAnnotationId ?? receiver.parentAnnotationId;
      if (explicitLink) return explicitLink === donor.id;
      return donorAnnotations.length === 1;
    });
    const receiverIds = linkedReceivers
      .map((receiver) => receiverTargets.get(receiver.id)?.id)
      .filter((id): id is string => Boolean(id));
    if (receiverIds.length === 0) return;
    generatedRelations.set(donor.id, {
      id: `mixed-agreement-${donor.id}`,
      donorId: donorTarget.id,
      receiverIds: Array.from(new Set(receiverIds))
    });
  });

  const relations = [...(sentence.agreementRelations ?? []), ...generatedRelations.values()];
  const selectedWordClasses = Array.from(new Set([
    ...(sentence.selectedWordClasses ?? []),
    ...targets.filter((target) => target.isAnalysisTarget !== false).map((target) => target.wordClass)
  ]));
  return {
    ...sentence,
    selectedWordClasses,
    wordClassTargets: targets,
    agreementRelationsEnabled: sentence.agreementRelationsEnabled || relations.length > 0,
    agreementRelations: relations
  };
}
