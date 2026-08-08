"use client";

import { demoData } from "@/data/demo-data";
import type { AppData } from "@/types";

const STORAGE_KEY = "phrase-du-jour-v21";
const DATA_VERSION = 34;

function cloneDemoData(): AppData {
  return JSON.parse(JSON.stringify(demoData)) as AppData;
}

function isCurrentData(value: unknown): value is AppData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<AppData>;

  return (
    data.dataVersion === DATA_VERSION &&
    Array.isArray(data.schoolYears) &&
    Array.isArray(data.levels) &&
    Array.isArray(data.groups) &&
    Array.isArray(data.sentences)
  );
}

export function loadData(): AppData {
  if (typeof window === "undefined") return cloneDemoData();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (isCurrentData(parsed)) {
        return {
          ...parsed,
          dataVersion: DATA_VERSION,
          competitionResults: Array.isArray(parsed.competitionResults)
            ? parsed.competitionResults
            : []
        };
      }
    }

    const initial = cloneDemoData();
    saveData(initial);
    return initial;
  } catch {
    return cloneDemoData();
  }
}

export function saveData(data: AppData): void {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...data,
      dataVersion: DATA_VERSION
    })
  );
}

export function resetData(): AppData {
  const initial = cloneDemoData();
  saveData(initial);
  return initial;
}
