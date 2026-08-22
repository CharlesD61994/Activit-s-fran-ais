import { describe, expect, it } from "vitest";
import { tableHasInteraction } from "./worksheet-tables";

describe("tableHasInteraction", () => {
  it("keeps worksheet tables structural; answers are separate placed objects", () => {
    expect(tableHasInteraction()).toBe(false);
  });
});
