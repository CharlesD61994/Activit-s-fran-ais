import { describe, expect, it } from "vitest";
import { chooseBracketTarget, matchDrawnRange, recognizeBracketStroke, tokenizeGrammarText } from "./range-interaction-engine";

describe("moteur partagé des plages grammaticales", () => {
  it("reconnaît les deux orientations de crochets", () => {
    expect(recognizeBracketStroke([{ x: 12, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 10 }, { x: 0, y: 20 }, { x: 12, y: 20 }])).toBe("[");
    expect(recognizeBracketStroke([{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 10 }, { x: 12, y: 20 }, { x: 0, y: 20 }])).toBe("]");
  });

  it("conserve les positions exactes des mots", () => {
    expect(tokenizeGrammarText("Le chat.").map(({ text, start, end, isWord }) => ({ text, start, end, isWord }))).toEqual([
      { text: "Le", start: 0, end: 2, isWord: true },
      { text: " ", start: 2, end: 3, isWord: false },
      { text: "chat", start: 3, end: 7, isWord: true },
      { text: ".", start: 7, end: 8, isWord: false }
    ]);
  });

  it("sépare la ponctuation de l'espace qui la suit", () => {
    expect(
      tokenizeGrammarText("Hier soir, les").map((token) => token.text)
    ).toEqual(["Hier", " ", "soir", ",", " ", "les"]);
  });

  it("garde une élision française attachée au mot suivant", () => {
    expect(
      tokenizeGrammarText("l’ami d'école").map(({ text, start, end }) => ({ text, start, end }))
    ).toEqual([
      { text: "l’", start: 0, end: 2 },
      { text: "ami", start: 2, end: 5 },
      { text: " ", start: 5, end: 6 },
      { text: "d'", start: 6, end: 8 },
      { text: "école", start: 8, end: 13 }
    ]);
  });

  it("choisit une seule cible lorsque des limites sont voisines", () => {
    const targets = [{ id: "first", start: 0, end: 2 }, { id: "second", start: 3, end: 7 }];
    const result = chooseBracketTarget([{ x: 12, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 20 }, { x: 12, y: 20 }], targets, [], [], undefined, (target) => ({ x: target.id === "first" ? 2 : 42, y: 10, height: 30 }));
    expect(result?.target.id).toBe("first");
  });

  it("valide un encadrement avec la même tolérance de plage", () => {
    const targets = [{ id: "group", start: 3, end: 12 }];
    expect(matchDrawnRange(2, 13, targets, [])?.id).toBe("group");
    expect(matchDrawnRange(0, 16, targets, [])).toBeNull();
  });
});
