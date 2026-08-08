import { describe, expect, it } from "vitest";
import { buildCompetitionStandings } from "./competition";
import type { Team } from "@/types";

const teams = [
  { id: "a", name: "Alpha", icon: "A" },
  { id: "b", name: "Bravo", icon: "B" },
  { id: "c", name: "Charlie", icon: "C" }
] as Team[];

describe("buildCompetitionStandings", () => {
  it("classe les équipes par score et conserve les égalités", () => {
    const standings = buildCompetitionStandings(teams, { a: 4, b: 7, c: 7 });
    expect(standings.map(({ teamId, rank }) => [teamId, rank])).toEqual([
      ["b", 1], ["c", 1], ["a", 3]
    ]);
  });

  it("attribue zéro aux équipes sans score", () => {
    expect(buildCompetitionStandings(teams.slice(0, 1), {})[0].score).toBe(0);
  });
});
