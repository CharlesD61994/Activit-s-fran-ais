"use client";

import { SessionManager } from "@/components/session-manager";
import { useAppStore } from "@/store/app-store";

export default function SessionsPage() {
  const { data, saveCollection, deleteCollection, toggleSessionCompetition } = useAppStore();

  return (
    <div className="page">
      <div className="page-header">
        <span className="eyebrow">Organisation des cours</span>
        <h1>Séances</h1>
        <p>
          Regroupe plusieurs activités dans un ordre de travail, puis attribue
          la séance aux groupes qui doivent la réaliser.
        </p>
      </div>

      <SessionManager
        sessions={data.collections}
        activities={data.sentences}
        levels={data.levels}
        groups={data.groups}
        onSave={saveCollection}
        onDelete={deleteCollection}
        onToggleCompetition={toggleSessionCompetition}
      />
    </div>
  );
}
