import type { Sentence } from "../types";

export function getActivitySentences(activity: Sentence): Sentence[] {
  if (!activity.activitySentences?.length) return [activity];
  return activity.activitySentences.map((part) => ({
    ...part,
    title: activity.title,
    levelId: activity.levelId,
    difficulty: activity.difficulty,
    tags: activity.tags,
    assignedGroupIds: activity.assignedGroupIds,
    activitySentences: undefined
  }));
}

export function assembleActivity(sentences: Sentence[], activityId: string, metadata: Sentence): Sentence {
  const parts = sentences.map((part) => ({ ...part, activitySentences: undefined }));
  return {
    ...parts[0],
    id: activityId,
    title: metadata.title,
    levelId: metadata.levelId,
    difficulty: metadata.difficulty,
    tags: metadata.tags,
    assignedGroupIds: metadata.assignedGroupIds,
    activitySentences: parts.length > 1 ? parts : undefined,
    updatedAt: new Date().toISOString()
  };
}

export function replacePhrasePoints<T extends { phraseId?: string; stage: string }>(
  current: T[], restored: T[], phraseId: string | undefined, stages: readonly string[]
): T[] {
  return [
    ...current.filter((point) => point.phraseId !== phraseId || !stages.includes(point.stage)),
    ...restored
  ];
}

/** Answer IDs may be reused in another phrase; only deduplicate within one. */
export function appendPhrasePoint<T extends { phraseId?: string; pointId?: string; stage: string; correction: { id: string } }>(current: T[], point: T): T[] {
  const duplicate = current.some((item) => item.phraseId === point.phraseId &&
    item.stage === point.stage &&
    (item.pointId ?? item.correction.id) === (point.pointId ?? point.correction.id));
  return duplicate ? current : [...current, point];
}
