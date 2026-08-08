"use client";

import { Cloud, CloudOff, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/features/auth/auth-provider";

export function SyncStatus() {
  const { user, loading, configured, signOut } = useAuth();

  if (loading) {
    return <span className="sync-status"><Cloud size={16} /> Connexion…</span>;
  }

  if (!configured) {
    return (
      <span className="sync-status local">
        <CloudOff size={16} /> Mode local
      </span>
    );
  }

  if (!user) {
    return (
      <Link href="/connexion" className="sync-status">
        <UserRound size={16} /> Se connecter
      </Link>
    );
  }

  return (
    <button className="sync-status" onClick={signOut}>
      <Cloud size={16} />
      Synchronisé
      <LogOut size={14} />
    </button>
  );
}
