import {
  getSecondaryObjectives,
  getSentenceObjective,
  grammarObjectiveLabels,
  grammarPhaseLabels
} from "@/lib/grammar-workflow";
import type { Sentence } from "@/types";

type Props = {
  sentence: Sentence;
  secondaryOnly?: boolean;
};

export function ActivityObjectiveBadges({
  sentence,
  secondaryOnly = false
}: Props) {
  const secondaryObjectives =
    sentence.activityType === "tree_analysis"
      ? []
      : getSecondaryObjectives(sentence);
  const primaryLabel =
    sentence.activityType === "tree_analysis"
      ? "Analyse en arbre"
      : grammarObjectiveLabels[getSentenceObjective(sentence)];

  return (
    <span className="activity-objective-badges">
      {!secondaryOnly && (
        <span className="activity-type-badge">{primaryLabel}</span>
      )}
      {secondaryObjectives.length > 0 && (
        <span className="activity-secondary-badges">
          {secondaryObjectives.map((objective) => (
            <span key={objective}>{grammarPhaseLabels[objective]}</span>
          ))}
        </span>
      )}
    </span>
  );
}