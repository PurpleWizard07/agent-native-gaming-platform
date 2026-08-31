import { GAMES } from "./games";

export interface LibraryEntry {
  userId: string;
  gameId: string;
  playtimeMinutes: number;
  completed: boolean;
  installed: boolean;
  /** ISO date, or null if never played. */
  lastPlayedAt: string | null;
}

/**
 * Which of the five users own each game. Handcrafted so the hero query
 * ("Alex, Sam, Maya online, ~75 min, co-op, nothing anyone's finished")
 * resolves to exactly one clean answer (Nightfall Signal) plus one legible
 * near-miss (Ridge Runners, which fails only because Sam has finished it) —
 * see scripts/check-funnel.mjs, which asserts this holds.
 */
const OWNERSHIP: Record<string, string[]> = {
  "nightfall-signal": ["purple", "alex", "sam", "maya"],
  "ridge-runners": ["purple", "alex", "sam", "maya"],
  "hollow-choir": ["purple", "alex", "sam", "maya"],
  "copper-and-steam": ["purple", "alex", "sam", "maya"],
  "longmarch-chronicles": ["purple", "alex", "sam", "maya"],
  "static-harbor": ["purple", "alex", "sam", "maya"],
  "tin-can-regatta": ["purple", "alex", "sam", "maya"],
  "emberfall-keep": ["purple", "alex", "maya"],
  "skybound-cartographers": ["purple", "alex", "sam", "maya"],
  "iron-vale": ["purple", "alex", "sam", "maya"],
  "paper-lantern-festival": ["alex", "maya"],
  "thistlewood-depths": ["sam", "alex"],
  "cascade-protocol": ["purple"],
  "windward-traders": ["alex"],
  "glasshouse": ["purple", "alex", "sam", "maya"],
  "backlot-heroes": ["sam", "maya"],
  "ashen-frontier": ["purple"],
  "meridian-racing-league": ["alex", "sam", "maya", "chris"],
  "quiet-orchard": ["purple"],
  "vantage-point": ["alex", "sam"],
  "driftwood-and-static": ["purple"],
  "nine-lanterns": ["alex", "sam", "maya"],
  "fathom-line": ["purple", "alex", "sam", "maya"],
  "bramblewick-fair": ["alex", "sam"],
};

/** Narrative-critical facts, hand-set so the hero flow and secondary demo
 * beats (resume, backlog, presence) land exactly as scripted. */
const OVERRIDES: Record<string, Partial<LibraryEntry>> = {
  // Nightfall Signal — the hero query's clean answer. Nobody has finished it.
  "purple:nightfall-signal": { completed: false, playtimeMinutes: 210, installed: true, lastPlayedAt: "2026-08-24" },
  "alex:nightfall-signal": { completed: false, playtimeMinutes: 95, installed: true, lastPlayedAt: "2026-08-23" },
  "sam:nightfall-signal": { completed: false, playtimeMinutes: 60, installed: true, lastPlayedAt: "2026-08-19" },
  "maya:nightfall-signal": { completed: false, playtimeMinutes: 40, installed: true, lastPlayedAt: "2026-08-19" },

  // Ridge Runners — the near-miss. Fails only because Sam has finished it.
  "purple:ridge-runners": { completed: false, playtimeMinutes: 150, installed: true, lastPlayedAt: "2026-08-25" },
  "alex:ridge-runners": { completed: false, playtimeMinutes: 340, installed: true, lastPlayedAt: "2026-08-29" },
  "sam:ridge-runners": { completed: true, playtimeMinutes: 620, installed: true, lastPlayedAt: "2026-08-27" },
  "maya:ridge-runners": { completed: false, playtimeMinutes: 80, installed: true, lastPlayedAt: "2026-08-18" },

  // Hollow Choir — fits everything but is horror. Nobody has finished it.
  "purple:hollow-choir": { completed: false, playtimeMinutes: 70, installed: true, lastPlayedAt: "2026-08-14" },
  "alex:hollow-choir": { completed: false, playtimeMinutes: 70, installed: true, lastPlayedAt: "2026-08-14" },
  "sam:hollow-choir": { completed: false, playtimeMinutes: 55, installed: true, lastPlayedAt: "2026-08-14" },
  "maya:hollow-choir": { completed: false, playtimeMinutes: 55, installed: false, lastPlayedAt: "2026-08-14" },

  // Fathom Line — fits everything but is horror. Nobody has finished it.
  "purple:fathom-line": { completed: false, playtimeMinutes: 90, installed: true, lastPlayedAt: "2026-08-08" },
  "alex:fathom-line": { completed: false, playtimeMinutes: 90, installed: true, lastPlayedAt: "2026-08-08" },
  "sam:fathom-line": { completed: false, playtimeMinutes: 65, installed: false, lastPlayedAt: "2026-08-01" },
  "maya:fathom-line": { completed: false, playtimeMinutes: 65, installed: true, lastPlayedAt: "2026-08-01" },

  // Tin Can Regatta — a second, quieter near-miss. Maya has finished it.
  "purple:tin-can-regatta": { completed: false, playtimeMinutes: 120, installed: true, lastPlayedAt: "2026-08-21" },
  "alex:tin-can-regatta": { completed: false, playtimeMinutes: 110, installed: true, lastPlayedAt: "2026-08-21" },
  "sam:tin-can-regatta": { completed: false, playtimeMinutes: 95, installed: true, lastPlayedAt: "2026-08-16" },
  "maya:tin-can-regatta": { completed: true, playtimeMinutes: 180, installed: true, lastPlayedAt: "2026-08-20" },

  // Secondary demo beats — resume, backlog, presence.
  "purple:ashen-frontier": { completed: false, playtimeMinutes: 890, installed: true, lastPlayedAt: "2026-08-17" },
  "purple:quiet-orchard": { completed: false, playtimeMinutes: 35, installed: true, lastPlayedAt: "2026-07-30" },
  "purple:driftwood-and-static": { completed: true, playtimeMinutes: 205, installed: false, lastPlayedAt: "2026-06-11" },
  "alex:glasshouse": { completed: true, playtimeMinutes: 90, installed: true, lastPlayedAt: "2026-08-10" },
  "maya:glasshouse": { completed: true, playtimeMinutes: 75, installed: true, lastPlayedAt: "2026-08-12" },
};

/** Deterministic pseudo-random in [0, 1) — no Math.random, so demo data is
 * identical on every run. */
function seeded(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

const FALLBACK_DATES = ["2026-08-28", "2026-08-22", "2026-08-15", "2026-08-05", "2026-07-22", "2026-06-30", null];

function buildLibrary(): LibraryEntry[] {
  const entries: LibraryEntry[] = [];
  for (const game of GAMES) {
    const owners = OWNERSHIP[game.id] ?? [];
    for (const userId of owners) {
      const key = `${userId}:${game.id}`;
      const override = OVERRIDES[key];
      if (override) {
        entries.push({
          userId,
          gameId: game.id,
          playtimeMinutes: override.playtimeMinutes ?? 0,
          completed: override.completed ?? false,
          installed: override.installed ?? true,
          lastPlayedAt: override.lastPlayedAt ?? null,
        });
        continue;
      }

      const r1 = seeded(`${key}:playtime`);
      const r2 = seeded(`${key}:completed`);
      const r3 = seeded(`${key}:installed`);
      const r4 = seeded(`${key}:date`);

      entries.push({
        userId,
        gameId: game.id,
        playtimeMinutes: Math.round(30 + r1 * 500),
        completed: r2 < 0.3,
        installed: r3 < 0.75,
        lastPlayedAt: FALLBACK_DATES[Math.floor(r4 * FALLBACK_DATES.length)],
      });
    }
  }
  return entries;
}

export const LIBRARY: LibraryEntry[] = buildLibrary();

export function libraryFor(userId: string): LibraryEntry[] {
  return LIBRARY.filter((e) => e.userId === userId);
}

export function ownsGame(userId: string, gameId: string): boolean {
  return LIBRARY.some((e) => e.userId === userId && e.gameId === gameId);
}
