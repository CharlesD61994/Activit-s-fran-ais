"use client";

import { demoData } from "@/data/demo-data";
import { DATA_VERSION, dataRecoveryWeight, normalizeAppData } from "@/lib/data-migration";
import type { AppData } from "@/types";

const STORAGE_KEY = "alinea-activites-francais-v21";
const LEGACY_STORAGE_KEYS = ["phrase-du-jour-v21"];

function cloneDemoData(): AppData {
  return JSON.parse(JSON.stringify(demoData)) as AppData;
}

export function loadData(): AppData {
  if (typeof window === "undefined") return cloneDemoData();

  try {
    const knownKeys = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS];
    const discoveredKeys = Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index))
      .filter((key): key is string => Boolean(key))
      .filter((key) =>
        key === STORAGE_KEY ||
        LEGACY_STORAGE_KEYS.includes(key) ||
        key.includes("phrase-du-jour") ||
        key.includes("alinea") ||
        key.includes("activites-francais")
      );
    const candidateKeys = Array.from(new Set([...knownKeys, ...discoveredKeys]));
    const candidates = candidateKeys
      .map((key) => {
        const raw = window.localStorage.getItem(key);
        if (!raw) return null;

        try {
          const normalized = normalizeAppData(JSON.parse(raw) as unknown);
          return normalized ? { key, data: normalized } : null;
        } catch {
          return null;
        }
      })
      .filter((candidate): candidate is { key: string; data: AppData } => Boolean(candidate))
      .sort((a, b) => dataRecoveryWeight(b.data) - dataRecoveryWeight(a.data));

    if (candidates[0]) {
      saveData(candidates[0].data);
      return candidates[0].data;
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
