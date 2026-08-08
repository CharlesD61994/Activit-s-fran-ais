import type { ThemeId } from "@/types";

export type ThemeDefinition = {
  id: ThemeId;
  name: string;
  description: string;
  category: "scolaire" | "neutre" | "sombre" | "saisonnier";
};

export const themes: ThemeDefinition[] = [
  { id: "colorful", name: "Coloré", description: "Dynamique et ludique pour le premier cycle.", category: "scolaire" },
  { id: "notebook", name: "Cahier scolaire", description: "Crème, bleu et accents inspirés du matériel scolaire.", category: "scolaire" },
  { id: "neutral", name: "Neutre", description: "Sobre et professionnel pour tous les niveaux.", category: "neutre" },
  { id: "minimal", name: "Minimal", description: "Très épuré, avec priorité absolue au contenu.", category: "neutre" },
  { id: "dark", name: "Sombre", description: "Contraste élevé pour une salle peu éclairée.", category: "sombre" },
  { id: "halloween", name: "Halloween", description: "Orange, violet et ambiance automnale discrète.", category: "saisonnier" },
  { id: "christmas", name: "Noël", description: "Rouge, vert et crème dans une ambiance festive.", category: "saisonnier" },
  { id: "winter", name: "Hiver", description: "Bleus froids et blanc lumineux.", category: "saisonnier" }
];

export const getTheme = (id: ThemeId) => themes.find((theme) => theme.id === id) ?? themes[2];
