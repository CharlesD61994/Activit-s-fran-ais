import type { TreeAnalysisScoreBox } from "@/types";
import { worksheetScoreLineWidth } from "@/lib/worksheet-scores";

export function WorksheetScoreContent({ score }: { score: TreeAnalysisScoreBox }) {
  return <span className="worksheet-score-content">
    {score.earned ?? <span className="worksheet-score-answer-line" style={{ width: `${worksheetScoreLineWidth(score) / 1056 * 100}cqw` }} />}
    <span>/ {score.total}</span>
  </span>;
}
