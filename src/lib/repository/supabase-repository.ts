"use client";

import { demoData } from "@/data/demo-data";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AppRepository } from "@/lib/repository/types";
import type { AppData } from "@/types";

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

export class SupabaseRepository implements AppRepository {
  async load(): Promise<AppData> {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return cloneDemoData();

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return cloneDemoData();

    const { data, error } = await supabase
      .from("app_snapshots")
      .select("payload")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (error) throw error;

    if (isCurrentData(data?.payload)) {
      const migrated: AppData = {
        ...data.payload,
        dataVersion: DATA_VERSION,
        competitionResults: Array.isArray(data.payload.competitionResults)
          ? data.payload.competitionResults
          : []
      };
      await this.save(migrated);
      return migrated;
    }

    const fresh = cloneDemoData();
    await this.save(fresh);
    return fresh;
  }

  async save(data: AppData): Promise<void> {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return;

    const { error } = await supabase
      .from("app_snapshots")
      .upsert(
        {
          user_id: userData.user.id,
          payload: {
            ...data,
            dataVersion: DATA_VERSION
          },
          updated_at: new Date().toISOString()
        },
        {
          onConflict: "user_id"
        }
      );

    if (error) throw error;
  }

  async reset(): Promise<AppData> {
    const fresh = cloneDemoData();
    await this.save(fresh);
    return fresh;
  }
}
