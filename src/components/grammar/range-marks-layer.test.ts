import { describe, expect, it } from "vitest";
import { areRangeMarksAdjacent, naturalBracketGeometry } from "./range-mark-spacing";

describe("range adjacency", () => {
  const text = "Le vieux manoir abandonné domine la vallée.";
  const range = (word: string) => ({ start: text.indexOf(word), end: text.indexOf(word) + word.length });
  it("does not pair adjective brackets across manoir", () => {
    expect(areRangeMarksAdjacent(text, range("vieux"), range("abandonné"))).toBe(false);
  });
  it("pairs boundaries only across the space between consecutive words", () => {
    expect(areRangeMarksAdjacent(text, range("vieux"), range("manoir"))).toBe(true);
    expect(areRangeMarksAdjacent("a\u00a0b", { end: 1 }, { start: 2 })).toBe(true);
  });
  it("does not pair nested or overlapping groups", () => {
    expect(areRangeMarksAdjacent(text, { end: range("abandonné").end }, range("vieux"))).toBe(false);
  });
});

describe("natural bracket geometry", () => {
  it("fits any number of nested stems in an unchanged word gap", () => {
    for (const gap of [7,12,18]) for (const count of [1,2,3,4,6]) {
      const stems = Array.from({length:count},(_,depth)=>naturalBracketGeometry(100,gap,count,depth,"right"));
      for (const stem of stems) {
        if (!stem.splitStem) {
          expect(stem.stemX-stem.strokeWidth/2).toBeGreaterThan(100);
          expect(stem.stemX+stem.strokeWidth/2).toBeLessThan(100+gap);
        } else expect(stem.strokeWidth).toBe(1.5);
        expect(stem.cap).toBe(6);
      }
      for (let i=1;i<stems.length;i++) expect(stems[i].stemX-stems[i].strokeWidth/2).toBeGreaterThan(stems[i-1].stemX+stems[i-1].strokeWidth/2);
    }
  });
  it("separates closing and opening strokes at adjacent groups", () => {
    const right=naturalBracketGeometry(100,12,3,1,"right");
    const left=naturalBracketGeometry(112,12,3,0,"left");
    expect(left.stemX-left.strokeWidth/2).toBeGreaterThan(right.stemX+right.strokeWidth/2);
  });
  it("keeps readable strokes at a line boundary", () => {
    expect(naturalBracketGeometry(100,undefined,3,2,"left")).toEqual({stemX:78,strokeWidth:2,cap:6,splitStem:false});
  });
  it("handles punctuation with no whitespace without inserting a text gap", () => {
    expect(naturalBracketGeometry(100,0,1,0,"right")).toEqual({stemX:103,strokeWidth:1.5,cap:6,splitStem:true});
  });
});
