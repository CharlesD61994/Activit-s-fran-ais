import type { CompetitionStanding, Team } from "@/types";

export function buildCompetitionStandings(
  teams: Team[],
  scores: Record<string, number>
): CompetitionStanding[] {
  const sorted = teams
    .map((team) => ({
      teamId: team.id,
      teamName: team.name,
      teamIcon: team.icon,
      score: scores[team.id] ?? 0,
      rank: 0
    }))
    .sort((a, b) => b.score - a.score || a.teamName.localeCompare(b.teamName, "fr"));

  let previousScore: number | null = null;
  let previousRank = 0;

  return sorted.map((standing, index) => {
    const rank = previousScore === standing.score ? previousRank : index + 1;
    previousScore = standing.score;
    previousRank = rank;
    return { ...standing, rank };
  });
}
