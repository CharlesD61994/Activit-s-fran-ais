import type { TreeAnalysisScoreBox } from "@/types";

export function worksheetScoreFontSize(score: TreeAnalysisScoreBox): number {
  return score.fontSize ?? Math.max(12, Math.min((score.height ?? 42) * .46, (score.width ?? 120) / (String(score.total).length + 5)));
}

export function worksheetScoreLineWidth(score: TreeAnalysisScoreBox): number {
  return score.answerLineWidth ?? worksheetScoreFontSize(score) * 1.5;
}
