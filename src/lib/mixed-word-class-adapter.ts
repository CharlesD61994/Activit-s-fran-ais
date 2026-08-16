import { wordClassLabels } from "./activity-types";
import type {
  AgreementRelation,
  GrammarAnnotation,
  Sentence,
  WordClass,
  WordClassTarget
} from "../types";

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
  const annotationById = new Map(annotations.map((annotation) => [annotation.id, annotation]));
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
        isAnalysisTarget: true,
        wordClassInteractionMode: annotation.wordClassInteractionMode,
        triggerAfterRole:
          annotation.parentAnnotationId &&
          (annotationById.get(annotation.parentAnnotationId)?.kind === "donor" ||
            annotationById.get(annotation.parentAnnotationId)?.kind === "receiver")
            ? annotationById.get(annotation.parentAnnotationId)?.kind as "donor" | "receiver"
            : undefined
      };
    })
    .filter((target): target is WordClassTarget => Boolean(target));

  const targetMap = new Map<string, WordClassTarget>();
  [...(sentence.wordClassTargets ?? []), ...annotationTargets].forEach((target) => targetMap.set(target.id, target));
  const targets = Array.from(targetMap.values());
  const donorAnnotations = annotations.filter((annotation) => annotation.kind === "donor");
  const receiverAnnotations = annotations.filter((annotation) => annotation.kind === "receiver");

  function inheritedClassTarget(annotation: GrammarAnnotation) {
    const visited = new Set<string>();
    let parentId = annotation.parentAnnotationId;
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = annotationById.get(parentId);
      if (!parent) return undefined;
      if (parent.kind === "word_class") {
        return targetForAnnotation(parent, targets);
      }
      parentId = parent.parentAnnotationId;
    }
    return undefined;
  }

  annotations
    .filter((annotation) => annotation.kind === "gender_number")
    .forEach((annotation) => {
      const target = targetForAnnotation(annotation, targets) ?? inheritedClassTarget(annotation);
      if (!target) return;
      target.grammaticalGender = annotation.grammaticalGender;
      target.grammaticalNumber = annotation.grammaticalNumber;
    });

  function ensureRelationEndpoint(annotation: GrammarAnnotation) {
    const existing = targetForAnnotation(annotation, targets);
    if (existing) return existing;
    const endpoint: WordClassTarget = {
      id: `mixed-relation-endpoint-${annotation.id}`,
      start: annotation.start,
      end: annotation.end,
      text: sentence.originalText.slice(annotation.start, annotation.end),
      wordClass: annotationClass(annotation) ?? "noun",
      isAnalysisTarget: false
    };
    targets.push(endpoint);
    return endpoint;
  }

  const donorTargets = new Map(
    donorAnnotations.flatMap((annotation) => {
      const target = targetForAnnotation(annotation, targets) ?? inheritedClassTarget(annotation);
      return target ? [[annotation.id, target] as const] : [];
    })
  );
  const receiverTargets = new Map(
    receiverAnnotations.map((annotation) => [annotation.id, ensureRelationEndpoint(annotation)] as const)
  );

  function descendsFrom(annotation: GrammarAnnotation, ancestorId: string) {
    const visited = new Set<string>();
    let parentId = annotation.linkedAnnotationId ?? annotation.parentAnnotationId;
    while (parentId && !visited.has(parentId)) {
      if (parentId === ancestorId) return true;
      visited.add(parentId);
      parentId = annotationById.get(parentId)?.parentAnnotationId;
    }
    return false;
  }

  const generatedRelations = new Map<string, AgreementRelation>();
  donorAnnotations.forEach((donor) => {
    const donorTarget = donorTargets.get(donor.id);
    if (!donorTarget || donorTarget.isAnalysisTarget === false) return;
    const linkedReceivers = receiverAnnotations.filter((receiver) =>
      descendsFrom(receiver, donor.id) ||
      (!(receiver.linkedAnnotationId ?? receiver.parentAnnotationId) && donorAnnotations.length === 1)
    );
    const receiverIds = linkedReceivers
      .map((receiver) => receiverTargets.get(receiver.id)?.id)
      .filter((id): id is string => Boolean(id) && id !== donorTarget.id);
    if (receiverIds.length === 0) return;
    const arrowReceiverIds = linkedReceivers
      .filter(
        (receiver) =>
          donor.responseMode === "arrow" || receiver.responseMode === "arrow"
      )
      .map((receiver) => receiverTargets.get(receiver.id)?.id)
      .filter((id): id is string => Boolean(id) && id !== donorTarget.id);
    generatedRelations.set(donor.id, {
      id: `mixed-agreement-${donor.id}`,
      donorId: donorTarget.id,
      receiverIds: Array.from(new Set(receiverIds)),
      arrowReceiverIds: Array.from(new Set(arrowReceiverIds))
    });
  });

  const relationsById = new Map<string, AgreementRelation>();
  [...(sentence.agreementRelations ?? []), ...generatedRelations.values()].forEach((relation) =>
    relationsById.set(relation.id, relation)
  );
  const relations = Array.from(relationsById.values());
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
