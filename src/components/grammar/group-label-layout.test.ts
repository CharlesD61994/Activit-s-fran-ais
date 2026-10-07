import { describe, expect, it } from "vitest";
import { groupLabelPlacement, isPrincipalGroup } from "./group-label-layout";

describe("principal group labels", () => {
  const main = { id: "main", start: 0, end: 30 };
  const expansion = { id: "expansion", start: 10, end: 30 };
  const inner = { id: "inner", start: 15, end: 25 };
  const groups = [inner, main, expansion];

  it("raises only the outer group, regardless of creation order", () => {
    expect(isPrincipalGroup(main, groups)).toBe(true);
    expect(isPrincipalGroup(expansion, groups)).toBe(false);
    expect(isPrincipalGroup(inner, groups)).toBe(false);
    const position = { x: 200, y: 100, segments: [{ x: 100, y: 100, width: 200, height: 50 }] };
    expect(groupLabelPlacement(main, groups, position)).toEqual({ left: 200, top: 66, principal: true });
    expect(groupLabelPlacement(expansion, groups, position)).toEqual({ left: 200, top: 100, principal: false });
  });

  it("centers the main group over its full footprint across wrapped lines", () => {
    expect(groupLabelPlacement(main, groups, { x: 125, y: 100, segments: [
      { x: 100, y: 100, width: 300, height: 50 },
      { x: 200, y: 200, width: 150, height: 50 }
    ] })).toMatchObject({ left: 250, top: 66 });
  });

  it("keeps standalone and adjacent groups on the normal row", () => {
    expect(isPrincipalGroup(main, [main, { id: "next", start: 31, end: 40 }])).toBe(false);
  });
});
