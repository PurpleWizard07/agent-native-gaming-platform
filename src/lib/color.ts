type RGB = [number, number, number];

function parse(hex: string): RGB {
  const num = parseInt(hex.replace("#", ""), 16);
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
}

function toHex([r, g, b]: RGB): string {
  const c = (v: number) => Math.min(255, Math.max(0, Math.round(v)));
  return `#${((1 << 24) + (c(r) << 16) + (c(g) << 8) + c(b)).toString(16).slice(1)}`;
}

/** Blends a color toward `target` by `amount` (0-1), preserving hue. */
export function mix(hex: string, target: RGB, amount: number): string {
  const [r, g, b] = parse(hex);
  return toHex([r + (target[0] - r) * amount, g + (target[1] - g) * amount, b + (target[2] - b) * amount]);
}

/** Perceived relative luminance, 0-1. */
export function luminance(hex: string): number {
  const [r, g, b] = parse(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Darkens (or lightens, with a negative percent) a #rrggbb hex color. */
export function shade(hex: string, percent: number): string {
  const [r, g, b] = parse(hex);
  const delta = 255 * (percent / 100);
  return toHex([r + delta, g + delta, b + delta]);
}
