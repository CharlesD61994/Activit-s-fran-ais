import { describe, expect, it } from "vitest";
import { validatedBracketTokenMargins } from "./range-mark-spacing";

describe("validated bracket spacing", () => {
  const token = { start: 0, end: 5 };
  const target = { id: "group-1", start: 0, end: 5 };

  it("does not reserve the opposite bracket before it is validated", () => {
    expect(validatedBracketTokenMargins(token, [target], [target.id], [])).toEqual({
      marginLeft: 10,
      marginRight: 0
    });
  });

  it("reserves both sides once both brackets are validated", () => {
    expect(validatedBracketTokenMargins(token, [target], [target.id], [target.id])).toEqual({
      marginLeft: 10,
      marginRight: 10
    });
  });
});
