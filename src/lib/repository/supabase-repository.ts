"use client";

import { demoData } from "@/data/demo-data";
import { normalizeAppData } from "@/lib/data-migration";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AppRepository } from "@/lib/repository/types";
import type { AppData } from "@/types";

function cloneDemoData(): AppData {
  return JSON.parse(JSON.stringify(demoData)) as AppData;
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

    const migrated = normalizeAppData(data?.payload);
    if (migrated) {
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
          payload: normalizeAppData(data) ?? data,
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
