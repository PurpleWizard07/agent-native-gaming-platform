import type { Game } from "../data/games";
import { luminance, mix } from "./color";

const WHITE: [number, number, number] = [255, 255, 255];
const BLACK: [number, number, number] = [0, 0, 0];

/**
 * The two gradient stops for a cover. Both are proportional blends rather
 * than fixed offsets: subtracting a fixed amount crushed dark accents
 * (Iron Vale's grey, Thistlewood's slate) to pure black, which read as dead
 * rectangles next to the vibrant covers. A luminance floor lifts genuinely
 * dark accents just enough to keep tonal range without changing their hue.
 */
export function coverStops(accent: string): { from: string; to: string } {
  const base = luminance(accent) < 0.3 ? mix(accent, WHITE, 0.22) : accent;
  return { from: mix(base, WHITE, 0.14), to: mix(base, BLACK, 0.55) };
}

/**
 * Procedural cover artwork. Genre chooses the motif family, so the art reads
 * as art-directed rather than random — a racing game gets ridgelines, a
 * deep-sea horror game gets depth waves. The game id then varies every
 * parameter, so no two covers in the same family look alike. All original,
 * generated at render time; no licensed or copied storefront artwork.
 */

export type Motif = "rings" | "ridges" | "lattice" | "bloom" | "shards" | "depths" | "arcs";

// First matching genre wins, so order matters: the more visually distinctive
// genre should come first for games that carry several.
const GENRE_MOTIFS: [string, Motif][] = [
  ["Horror", "depths"],
  ["Survival", "depths"],
  ["Racing", "ridges"],
  ["Western", "ridges"],
  ["Exploration", "ridges"],
  ["Adventure", "ridges"],
  ["Sci-Fi", "rings"],
  ["Space", "rings"],
  ["Strategy", "lattice"],
  ["Simulation", "lattice"],
  ["Economy", "lattice"],
  ["Board", "lattice"],
  ["Tactical", "shards"],
  ["Shooter", "shards"],
  ["Competitive", "shards"],
  ["Platformer", "shards"],
  ["RPG", "arcs"],
  ["Fantasy", "arcs"],
  ["Narrative", "arcs"],
  ["Cozy", "bloom"],
  ["Chill", "bloom"],
  ["Puzzle", "bloom"],
  ["Party", "bloom"],
  ["Sports", "bloom"],
];

export function motifFor(game: Game): Motif {
  for (const [genre, motif] of GENRE_MOTIFS) {
    if (game.genres.includes(genre)) return motif;
  }
  return "rings";
}

/** Deterministic PRNG — same game always renders the same cover. */
function rng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Shape {
  kind: "circle" | "path" | "line" | "polygon";
  /** Attributes are passed straight through to the SVG element. */
  attrs: Record<string, string | number>;
}

const round = (n: number) => Math.round(n * 100) / 100;

function ringShapes(next: () => number): Shape[] {
  const cx = 20 + next() * 60;
  const cy = 10 + next() * 40;
  const count = 5 + Math.floor(next() * 3);
  const step = 9 + next() * 7;
  return Array.from({ length: count }, (_, i) => ({
    kind: "circle" as const,
    attrs: {
      cx: round(cx),
      cy: round(cy),
      r: round(step * (i + 1)),
      fill: "none",
      stroke: "#fff",
      strokeWidth: round(0.6 + next() * 0.9),
      opacity: round(0.26 - i * 0.028),
    },
  }));
}

function ridgeShapes(next: () => number): Shape[] {
  const layers = 3 + Math.floor(next() * 2);
  return Array.from({ length: layers }, (_, i) => {
    const base = 52 + i * (13 + next() * 6);
    const peaks = 3 + Math.floor(next() * 3);
    const points: string[] = ["0," + round(base + 8)];
    for (let p = 0; p <= peaks; p++) {
      const x = (100 / peaks) * p;
      const y = base - next() * 22;
      points.push(`${round(x)},${round(y)}`);
    }
    points.push("100,120", "0,120");
    return {
      kind: "polygon" as const,
      attrs: { points: points.join(" "), fill: "#fff", opacity: round(0.07 + i * 0.05) },
    };
  });
}

function latticeShapes(next: () => number): Shape[] {
  const gap = 9 + next() * 6;
  const angle = -20 + next() * 40;
  const shapes: Shape[] = [];
  for (let x = -40; x <= 140; x += gap) {
    shapes.push({
      kind: "line",
      attrs: {
        x1: round(x), y1: -40, x2: round(x), y2: 140,
        stroke: "#fff", strokeWidth: 0.5,
        opacity: round(0.1 + next() * 0.14),
        transform: `rotate(${round(angle)} 50 50)`,
      },
    });
  }
  for (let y = -40; y <= 140; y += gap * 1.6) {
    shapes.push({
      kind: "line",
      attrs: {
        x1: -40, y1: round(y), x2: 140, y2: round(y),
        stroke: "#fff", strokeWidth: 0.5,
        opacity: round(0.07 + next() * 0.1),
        transform: `rotate(${round(angle)} 50 50)`,
      },
    });
  }
  return shapes;
}

function bloomShapes(next: () => number): Shape[] {
  const count = 9 + Math.floor(next() * 6);
  return Array.from({ length: count }, () => ({
    kind: "circle" as const,
    attrs: {
      cx: round(next() * 100),
      cy: round(next() * 85),
      r: round(3 + next() * 12),
      fill: "#fff",
      opacity: round(0.06 + next() * 0.13),
    },
  }));
}

function shardShapes(next: () => number): Shape[] {
  const count = 3 + Math.floor(next() * 3);
  return Array.from({ length: count }, () => {
    const x = -10 + next() * 90;
    const w = 8 + next() * 20;
    const skew = 18 + next() * 26;
    return {
      kind: "polygon" as const,
      attrs: {
        points: `${round(x)},-10 ${round(x + w)},-10 ${round(x + w - skew)},115 ${round(x - skew)},115`,
        fill: "#fff",
        opacity: round(0.08 + next() * 0.12),
      },
    };
  });
}

function depthShapes(next: () => number): Shape[] {
  const count = 8 + Math.floor(next() * 5);
  const amp = 4 + next() * 6;
  return Array.from({ length: count }, (_, i) => {
    // Lines tighten toward the bottom, reading as increasing pressure/depth.
    const y = 16 + Math.pow(i / count, 0.7) * 88;
    const phase = next() * 40;
    const d = `M -5 ${round(y)} Q ${round(20 + phase * 0.3)} ${round(y - amp)} 50 ${round(y)} T 105 ${round(y)}`;
    return {
      kind: "path" as const,
      attrs: {
        d,
        fill: "none",
        stroke: "#fff",
        strokeWidth: round(0.5 + next() * 0.7),
        opacity: round(0.09 + (i / count) * 0.16),
      },
    };
  });
}

function arcShapes(next: () => number): Shape[] {
  const count = 2 + Math.floor(next() * 2);
  return Array.from({ length: count }, () => ({
    kind: "circle" as const,
    attrs: {
      cx: round(-20 + next() * 140),
      cy: round(-10 + next() * 120),
      r: round(38 + next() * 44),
      fill: "none",
      stroke: "#fff",
      strokeWidth: round(1.2 + next() * 2.4),
      opacity: round(0.1 + next() * 0.12),
    },
  }));
}

const BUILDERS: Record<Motif, (next: () => number) => Shape[]> = {
  rings: ringShapes,
  ridges: ridgeShapes,
  lattice: latticeShapes,
  bloom: bloomShapes,
  shards: shardShapes,
  depths: depthShapes,
  arcs: arcShapes,
};

export function coverShapes(game: Game): Shape[] {
  return BUILDERS[motifFor(game)](rng(game.id));
}
