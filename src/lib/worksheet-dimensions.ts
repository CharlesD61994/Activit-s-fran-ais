import type { WorksheetDimensionBand } from "@/types";

const assets: Record<WorksheetDimensionBand["dimension"], { src: string; width: number; height: number }> = {
  "Compréhension": { src: "/worksheet-dimensions/comprehension.jpg", width: 124, height: 28 },
  "Interprétation": { src: "/worksheet-dimensions/interpretation.jpg", width: 126, height: 28 },
  "Réaction": { src: "/worksheet-dimensions/reaction.jpg", width: 77, height: 28 },
  "Appréciation": { src: "/worksheet-dimensions/appreciation.jpg", width: 105, height: 28 }
};

export function worksheetDimensionAsset(dimension: WorksheetDimensionBand["dimension"]) {
  return assets[dimension];
}
