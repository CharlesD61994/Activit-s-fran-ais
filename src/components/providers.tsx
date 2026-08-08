"use client";

import { AppShell } from "@/components/app-shell";
import { AuthProvider } from "@/features/auth/auth-provider";
import { AppStoreProvider } from "@/store/app-store";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppStoreProvider>
        <AppShell>{children}</AppShell>
      </AppStoreProvider>
    </AuthProvider>
  );
}
