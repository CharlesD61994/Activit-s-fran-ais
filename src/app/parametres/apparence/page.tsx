"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAppStore } from "@/store/app-store";
import { themes } from "@/themes/themes";
import type { ThemeId } from "@/types";

export default function AppearancePage() {
  const { data, setGlobalTheme, resetData } = useAppStore();
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="page">
      <div className="page-header">
        <span className="eyebrow">Personnalisation</span>
        <h1>Apparence</h1>
        <p>Choisis le thème général de l’application. Chaque groupe peut aussi conserver son propre thème.</p>
      </div>

      <div className="grid theme-grid">
        {themes.map((theme) => (
          <button
            key={theme.id}
            className={`theme-card ${data.globalThemeId === theme.id ? "selected" : ""}`}
            data-preview-theme={theme.id}
            onClick={() => setGlobalTheme(theme.id as ThemeId)}
          >
            <div className="theme-preview">
              <div className="preview-nav" />
              <div className="preview-content">
                <div className="preview-line short" />
                <div className="preview-line" />
                <div className="preview-button" />
              </div>
            </div>
            <span className="eyebrow">{theme.category}</span>
            <strong>{theme.name}</strong>
            <small>{theme.description}</small>
          </button>
        ))}
      </div>

      <Card className="danger-zone">
        <div>
          <span className="eyebrow">Données locales</span>
          <h2>Réinitialiser la démonstration</h2>
          <p>Cette action restaure les niveaux, les groupes, les points et les thèmes d’origine.</p>
        </div>
        {!confirmed ? (
          <Button variant="secondary" onClick={() => setConfirmed(true)}><RotateCcw size={18} /> Réinitialiser</Button>
        ) : (
          <div className="form-actions">
            <Button variant="danger" onClick={() => { resetData(); setConfirmed(false); }}>Confirmer</Button>
            <Button variant="secondary" onClick={() => setConfirmed(false)}>Annuler</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
