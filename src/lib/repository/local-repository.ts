"use client";

import { loadData, resetData, saveData } from "@/lib/storage";
import type { AppRepository } from "@/lib/repository/types";
import type { AppData } from "@/types";

export class LocalRepository implements AppRepository {
  async load(): Promise<AppData> {
    return loadData();
  }

  async save(data: AppData): Promise<void> {
    saveData(data);
  }

  async reset(): Promise<AppData> {
    return resetData();
  }
}
