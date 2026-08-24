export const GROUP_ACCENT_COLORS = [
  "#2878df",
  "#0f9f91",
  "#7757cf",
  "#e6921b",
  "#c23f78",
  "#60ad57"
] as const;

export function groupAccentColor(index: number, savedColor?: string) {
  const safeIndex = Math.max(0, index);
  return savedColor ?? GROUP_ACCENT_COLORS[safeIndex % GROUP_ACCENT_COLORS.length];
}
