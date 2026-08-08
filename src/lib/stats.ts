import type { CorrectionCode, ScoreEvent, Sentence } from "@/types";

export type CodeStat = {
  codeId: string;
  code: string;
  name: string;
  attempts: number;
  points: number;
};

export function buildCodeStats(
  events: ScoreEvent[],
  sentences: Sentence[],
  codes: CorrectionCode[]
): CodeStat[] {
  return codes.map((code) => {
    const related = events.filter((event) => {
      if (event.correctionCodeId) return event.correctionCodeId === code.id;
      const sentence = sentences.find((item) => item.id === event.sentenceId);
      const correction = sentence?.corrections.find((item) => item.id === event.correctionId);
      return correction?.correctionCodeId === code.id;
    });

    return {
      codeId: code.id,
      code: code.code,
      name: code.name,
      attempts: related.length,
      points: related.reduce((sum, event) => sum + event.points, 0)
    };
  }).filter((item) => item.attempts > 0 || item.points > 0);
}

export function groupEventsBySession(events: ScoreEvent[]) {
  const map = new Map<string, ScoreEvent[]>();
  events.forEach((event) => {
    const current = map.get(event.sessionId) ?? [];
    current.push(event);
    map.set(event.sessionId, current);
  });

  return Array.from(map.entries()).map(([sessionId, items]) => ({
    sessionId,
    events: items,
    createdAt: items.map((item) => item.createdAt).sort()[0],
    points: items.reduce((sum, event) => sum + event.points, 0),
    sentenceId: items[0]?.sentenceId
  })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}


export function startOfCurrentWeek(reference = new Date()) {
  const date = new Date(reference);
  const day = date.getDay();
  const diff = day === 0 ? 0 : day;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - diff);
  return date;
}

export function getWeeklyPoints(events: ScoreEvent[], groupId: string) {
  const start = startOfCurrentWeek();
  return events
    .filter((event) => event.groupId === groupId && new Date(event.createdAt) >= start)
    .reduce((sum, event) => sum + event.points, 0);
}

export function getCompletedSentenceIds(events: ScoreEvent[], groupId: string) {
  return Array.from(new Set(
    events
      .filter((event) => event.groupId === groupId)
      .map((event) => event.sentenceId)
  ));
}

export function getPerfectSentenceCount(
  events: ScoreEvent[],
  sentences: Sentence[],
  groupId: string
) {
  const sessionMap = new Map<string, ScoreEvent[]>();

  events
    .filter((event) => event.groupId === groupId)
    .forEach((event) => {
      const current = sessionMap.get(event.sessionId) ?? [];
      current.push(event);
      sessionMap.set(event.sessionId, current);
    });

  let perfect = 0;

  sessionMap.forEach((sessionEvents) => {
    const sentence = sentences.find((item) => item.id === sessionEvents[0]?.sentenceId);
    if (!sentence) return;

    const maxPoints = sentence.corrections.reduce((sum, correction) => sum + correction.points, 0);
    const earned = sessionEvents.reduce((sum, event) => sum + event.points, 0);

    if (maxPoints > 0 && earned >= maxPoints) perfect += 1;
  });

  return perfect;
}
