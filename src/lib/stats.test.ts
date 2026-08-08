import { describe, expect, it } from "vitest";
import { getCompletedSentenceIds, groupEventsBySession, startOfCurrentWeek } from "./stats";
import type { ScoreEvent } from "@/types";

const event = (overrides: Partial<ScoreEvent>): ScoreEvent => ({
  id: "event", groupId: "g1", sentenceId: "s1", sessionId: "session-1",
  correctionId: "c1", correctionCodeId: "code", points: 1,
  reason: "correction", createdAt: "2026-08-05T12:00:00.000Z", ...overrides
});

describe("stats", () => {
  it("regroupe et additionne les événements d'une séance", () => {
    const sessions = groupEventsBySession([event({}), event({ id: "event-2", points: 2 })]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].points).toBe(3);
  });

  it("déduplique les activités terminées d'un groupe", () => {
    expect(getCompletedSentenceIds([event({}), event({ id: "event-2" })], "g1")).toEqual(["s1"]);
  });

  it("commence la semaine le dimanche", () => {
    expect(startOfCurrentWeek(new Date("2026-08-05T15:00:00")).getDay()).toBe(0);
  });
});
