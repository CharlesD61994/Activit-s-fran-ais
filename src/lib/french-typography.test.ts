import { describe, expect, it } from "vitest";
import {
  endsWithFrenchElision,
  protectFrenchElisionBreaks
} from "./french-typography";

describe("typographie française", () => {
  it("repère les élisions qui doivent rester avec le mot suivant", () => {
    expect(endsWithFrenchElision("l’")).toBe(true);
    expect(endsWithFrenchElision("qu'")).toBe(true);
    expect(endsWithFrenchElision("chat")).toBe(false);
  });

  it("ajoute un caractère anti-coupure invisible", () => {
    expect(protectFrenchElisionBreaks("l'")).toBe("l'\u2060");
    expect(protectFrenchElisionBreaks("’")).toBe("\u2060’\u2060");
  });
});
