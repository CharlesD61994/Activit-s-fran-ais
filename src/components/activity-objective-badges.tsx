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
  primaryOnly?: boolean;
};

export function getActivityObjectiveKey(sentence: Sentence) {
  return sentence.activityType === "tree_analysis"
    ? "tree_analysis" as const
    : getSentenceObjective(sentence);
}

export function ActivityObjectiveBadges({
  sentence,
  secondaryOnly = false,
  primaryOnly = false
}: Props) {
  const secondaryObjectives =
    sentence.activityType === "tree_analysis"
      ? []
      : getSecondaryObjectives(sentence);
  const primaryKey = getActivityObjectiveKey(sentence);
  const primaryLabel =
    primaryKey === "tree_analysis"
      ? "Analyse en arbre"
      : grammarObjectiveLabels[primaryKey];

  return (
    <span className="activity-objective-badges">
      {!secondaryOnly && (
        <span className={`activity-type-badge objective-${primaryKey}`}>
          {primaryLabel}
        </span>
      )}
      {!primaryOnly && secondaryObjectives.length > 0 && (
        <span className="activity-secondary-badges">
          {secondaryObjectives.map((objective) => (
            <span key={objective}>{grammarPhaseLabels[objective]}</span>
          ))}
        </span>
      )}
    </span>
  );
}