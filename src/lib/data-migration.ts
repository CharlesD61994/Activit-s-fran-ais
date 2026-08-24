"use client";

import { demoData } from "@/data/demo-data";
import type { AppData } from "@/types";

export const DATA_VERSION = 34;

function cloneDemoData(): AppData {
  return JSON.parse(JSON.stringify(demoData)) as AppData;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function arrayOr<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) ? value as T[] : fallback;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function normalizeAppData(value: unknown): AppData | null {
  const source = asRecord(value);
  if (!source) return null;

  if (
    !Array.isArray(source.schoolYears) ||
    !Array.isArray(source.levels) ||
    !Array.isArray(source.groups) ||
    !Array.isArray(source.sentences)
  ) {
    return null;
  }

  const fallback = cloneDemoData();

  return {
    dataVersion: DATA_VERSION,
    schoolYears: source.schoolYears as AppData["schoolYears"],
    levels: source.levels as AppData["levels"],
    groups: source.groups as AppData["groups"],
    teams: arrayOr(source.teams, []),
    correctionCodes: arrayOr(source.correctionCodes, fallback.correctionCodes),
    sentences: source.sentences as AppData["sentences"],
    collections: arrayOr(source.collections, []),
    plannedSessions: arrayOr(source.plannedSessions, []),
    reviewStates: arrayOr(source.reviewStates, []),
    scoreEvents: arrayOr(source.scoreEvents, []),
    competitionResults: arrayOr(source.competitionResults, []),
    dashboardTitle: stringOr(source.dashboardTitle, fallback.dashboardTitle),
    dashboardSectionLabel: stringOr(source.dashboardSectionLabel, fallback.dashboardSectionLabel)
  };
}

export function dataRecoveryWeight(data: AppData): number {
  return (
    data.sentences.length * 1000 +
    data.groups.length * 100 +
    data.teams.length * 20 +
    data.scoreEvents.length +
    numberOr(data.dataVersion, 0)
  );
}

