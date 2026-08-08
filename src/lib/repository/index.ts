"use client";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { LocalRepository } from "@/lib/repository/local-repository";
import { SupabaseRepository } from "@/lib/repository/supabase-repository";
import type { AppRepository } from "@/lib/repository/types";

export function createRepository(isAuthenticated: boolean): AppRepository {
  if (isSupabaseConfigured && isAuthenticated) {
    return new SupabaseRepository();
  }

  return new LocalRepository();
}
