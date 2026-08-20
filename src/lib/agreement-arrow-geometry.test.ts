import { describe, expect, it } from "vitest";
import { projectAgreementArrowPoints } from "./agreement-arrow-geometry";

describe("projectAgreementArrowPoints", () => {
  it("moves both ends to their words while preserving the hand-drawn curve", () => {
    const points = projectAgreementArrowPoints(
      {
        id: "arrow",
        taskTargetId: "donor",
        answerId: "receiver",
        color: "red",
        points: [
          { x: .1, y: .2 },
          { x: .2, y: .1 },
          { x: .3, y: .2 }
        ],
        sourceGeometry: {
          width: 1000,
          height: 500,
          startAnchor: { x: 100, y: 100 },
          endAnchor: { x: 300, y: 100 }
        }
      },
      { width: 1600, height: 700 },
      { x: 200, y: 160 },
      { x: 600, y: 260 }
    );

    expect(points[0]).toEqual({ x: 200, y: 160 });
    expect(points[1]).toEqual({ x: 400, y: 160 });
    expect(points[2]).toEqual({ x: 600, y: 260 });
  });

  it("keeps compatibility with arrows saved before source geometry existed", () => {
    expect(projectAgreementArrowPoints(
      {
        id: "legacy",
        taskTargetId: "donor",
        answerId: "receiver",
        color: "blue",
        points: [{ x: .25, y: .5 }]
      },
      { width: 800, height: 400 }
    )).toEqual([{ x: 200, y: 200 }]);
  });

  it("anchors a legacy arrow to its words on the current layout", () => {
    expect(projectAgreementArrowPoints(
      {
        id: "legacy",
        taskTargetId: "donor",
        answerId: "receiver",
        color: "blue",
        points: [{ x: .1, y: .2 }, { x: .2, y: .1 }, { x: .3, y: .2 }]
      },
      { width: 1000, height: 500 },
      { x: 150, y: 120 },
      { x: 500, y: 180 }
    )).toEqual([
      { x: 150, y: 120 },
      { x: 325, y: 100 },
      { x: 500, y: 180 }
    ]);
  });
});
