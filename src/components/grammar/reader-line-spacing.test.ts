import { describe, expect, it } from "vitest";
import { principalLineClearances } from "./reader-line-spacing";

describe("conditional spacing below the first reader line", () => {
  const first = { id: "first", start: 0, end: 10 };
  const firstChild = { id: "first-child", start: 2, end: 8 };
  const lower = { id: "lower", start: 12, end: 19 };
  const lowerChild = { id: "lower-child", start: 14, end: 17 };
  const groups = [first, firstChild, lower, lowerChild];

  it("never adds a line spacer to the first line", () => {
    expect(principalLineClearances([first, firstChild], [0, 10, 20], [first.id])).toEqual({});
  });

  it("keeps lower lines compact until their principal group is enclosed", () => {
    expect(principalLineClearances(groups, [10, 20], [])).toEqual({});
    expect(principalLineClearances(groups, [10, 20], [first.id, lowerChild.id])).toEqual({});
  });

  it("only adds space to the line containing an enclosed principal group", () => {
    expect(principalLineClearances(groups, [10, 20], [lower.id])).toEqual({ 10: 60 });
  });

  it("keeps continuation and expansion lines compact", () => {
    const parent = { id: "parent", start: 5, end: 25 };
    expect(principalLineClearances([parent, lowerChild], [10, 20, 30], [parent.id])).toEqual({});
  });

  it("uses one gap when several enclosed principals share a line", () => {
    const next = { id: "next", start: 21, end: 29 };
    const nextChild = { id: "next-child", start: 23, end: 26 };
    expect(principalLineClearances([...groups, next, nextChild], [10, 30], [lower.id, next.id])).toEqual({ 10: 60 });
  });
});
