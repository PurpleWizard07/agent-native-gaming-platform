/** Darkens (or lightens, with a negative percent) a #rrggbb hex color. */
export function shade(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const clamp = (v: number) => Math.min(255, Math.max(0, v));
  const r = clamp(((num >> 16) & 0xff) + Math.round(255 * (percent / 100)));
  const g = clamp(((num >> 8) & 0xff) + Math.round(255 * (percent / 100)));
  const b = clamp((num & 0xff) + Math.round(255 * (percent / 100)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
