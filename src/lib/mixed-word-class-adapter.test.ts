import { describe, expect, it } from "vitest";
import { buildMixedWordClassSentence } from "./mixed-word-class-adapter";
import type { Sentence } from "@/types";

describe("buildMixedWordClassSentence", () => {
  it("conserve le mode de classe et enchaîne le genre, le nombre et la relation du receveur", () => {
    const sentence = {
      id: "mixed-receiver",
      activityType: "sentence_correction",
      title: "Accord",
      levelId: "secondaire-1",
      difficulty: "medium",
      tags: [],
      originalText: "Les créatures",
      corrections: [],
      assignedGroupIds: [],
      createdAt: "2026-08-11T00:00:00.000Z",
      updatedAt: "2026-08-11T00:00:00.000Z",
      grammarAnnotations: [
        {
          id: "class-receiver",
          start: 0,
          end: 3,
          kind: "word_class",
          label: "Déterminant",
          wordClassInteractionMode: "choose_class"
        },
        {
          id: "gender-receiver",
          start: 0,
          end: 3,
          kind: "gender_number",
          label: "Genre et nombre",
          parentAnnotationId: "class-receiver",
          grammaticalGender: "feminine",
          grammaticalNumber: "plural"
        },
        {
          id: "class-donor",
          start: 4,
          end: 13,
          kind: "word_class",
          label: "Nom",
          wordClassInteractionMode: "find_requested"
        },
        {
          id: "donor",
          start: 4,
          end: 13,
          kind: "donor",
          label: "Donneur d’accord",
          parentAnnotationId: "class-donor"
        },
        {
          id: "receiver",
          start: 0,
          end: 3,
          kind: "receiver",
          label: "Receveur d’accord",
          linkedAnnotationId: "donor"
        }
      ]
    } as Sentence;

    const adapted = buildMixedWordClassSentence(sentence);
    const receiver = adapted.wordClassTargets?.find((target) => target.id === "class-receiver");

    expect(receiver).toMatchObject({
      wordClass: "determiner",
      wordClassInteractionMode: "choose_class",
      grammaticalGender: "feminine",
      grammaticalNumber: "plural"
    });
    expect(adapted.agreementRelations).toEqual([
      {
        id: "mixed-agreement-donor",
        donorId: "class-donor",
        receiverIds: ["class-receiver"]
      }
    ]);
  });
});