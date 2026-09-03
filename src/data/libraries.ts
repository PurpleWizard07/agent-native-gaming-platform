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
 * ("Justin, Robert, Sarah online, ~75 min, co-op, nothing anyone's finished")
 * resolves to exactly one clean answer (Nightfall Signal) plus one legible
 * near-miss (Ridge Runners, which fails only because Robert has finished it) —
 * see scripts/check-funnel.ts, which asserts this holds.
 */
const OWNERSHIP: Record<string, string[]> = {
  "nightfall-signal": ["alex", "justin", "robert", "sarah"],
  "ridge-runners": ["alex", "justin", "robert", "sarah"],
  "hollow-choir": ["alex", "justin", "robert", "sarah"],
  "copper-and-steam": ["alex", "justin", "robert", "sarah"],
  "longmarch-chronicles": ["alex", "justin", "robert", "sarah"],
  "static-harbor": ["alex", "justin", "robert", "sarah"],
  "tin-can-regatta": ["alex", "justin", "robert", "sarah"],
  "emberfall-keep": ["alex", "justin", "sarah"],
  "skybound-cartographers": ["alex", "justin", "robert", "sarah"],
  "iron-vale": ["alex", "justin", "robert", "sarah"],
  "paper-lantern-festival": ["justin", "sarah"],
  "thistlewood-depths": ["robert", "justin"],
  "cascade-protocol": ["alex"],
  "windward-traders": ["justin"],
  "glasshouse": ["alex", "justin", "robert", "sarah"],
  "backlot-heroes": ["robert", "sarah"],
  "ashen-frontier": ["alex"],
  "meridian-racing-league": ["justin", "robert", "sarah", "andrew"],
  "quiet-orchard": ["alex"],
  "vantage-point": ["justin", "robert"],
  "driftwood-and-static": ["alex"],
  "nine-lanterns": ["justin", "robert", "sarah"],
  "fathom-line": ["alex", "justin", "robert", "sarah"],
  "bramblewick-fair": ["justin", "robert"],
};

/** Narrative-critical facts, hand-set so the hero flow and secondary demo
 * beats (resume, backlog, presence) land exactly as scripted. */
const OVERRIDES: Record<string, Partial<LibraryEntry>> = {
  // Nightfall Signal — the hero query's clean answer. Nobody has finished it.
  "alex:nightfall-signal": { completed: false, playtimeMinutes: 210, installed: true, lastPlayedAt: "2026-08-24" },
  "justin:nightfall-signal": { completed: false, playtimeMinutes: 95, installed: true, lastPlayedAt: "2026-08-23" },
  "robert:nightfall-signal": { completed: false, playtimeMinutes: 60, installed: true, lastPlayedAt: "2026-08-19" },
  "sarah:nightfall-signal": { completed: false, playtimeMinutes: 40, installed: true, lastPlayedAt: "2026-08-19" },

  // Ridge Runners — the near-miss. Fails only because Robert has finished it.
  "alex:ridge-runners": { completed: false, playtimeMinutes: 150, installed: true, lastPlayedAt: "2026-08-25" },
  "justin:ridge-runners": { completed: false, playtimeMinutes: 340, installed: true, lastPlayedAt: "2026-08-29" },
  "robert:ridge-runners": { completed: true, playtimeMinutes: 620, installed: true, lastPlayedAt: "2026-08-27" },
  "sarah:ridge-runners": { completed: false, playtimeMinutes: 80, installed: true, lastPlayedAt: "2026-08-18" },

  // Hollow Choir — fits everything but is horror. Nobody has finished it.
  "alex:hollow-choir": { completed: false, playtimeMinutes: 70, installed: true, lastPlayedAt: "2026-08-14" },
  "justin:hollow-choir": { completed: false, playtimeMinutes: 70, installed: true, lastPlayedAt: "2026-08-14" },
  "robert:hollow-choir": { completed: false, playtimeMinutes: 55, installed: true, lastPlayedAt: "2026-08-14" },
  "sarah:hollow-choir": { completed: false, playtimeMinutes: 55, installed: false, lastPlayedAt: "2026-08-14" },

  // Fathom Line — fits everything but is horror. Nobody has finished it.
  "alex:fathom-line": { completed: false, playtimeMinutes: 90, installed: true, lastPlayedAt: "2026-08-08" },
  "justin:fathom-line": { completed: false, playtimeMinutes: 90, installed: true, lastPlayedAt: "2026-08-08" },
  "robert:fathom-line": { completed: false, playtimeMinutes: 65, installed: false, lastPlayedAt: "2026-08-01" },
  "sarah:fathom-line": { completed: false, playtimeMinutes: 65, installed: true, lastPlayedAt: "2026-08-01" },

  // Tin Can Regatta — a second, quieter near-miss. Sarah has finished it.
  "alex:tin-can-regatta": { completed: false, playtimeMinutes: 120, installed: true, lastPlayedAt: "2026-08-21" },
  "justin:tin-can-regatta": { completed: false, playtimeMinutes: 110, installed: true, lastPlayedAt: "2026-08-21" },
  "robert:tin-can-regatta": { completed: false, playtimeMinutes: 95, installed: true, lastPlayedAt: "2026-08-16" },
  "sarah:tin-can-regatta": { completed: true, playtimeMinutes: 180, installed: true, lastPlayedAt: "2026-08-20" },

  // Backlog — bought and never launched, so "what have I never started?"
  // has a real answer. Neither game reaches the hero funnel's completion
  // step (Cascade Protocol is Alex-only; Skybound Cartographers is cut
  // earlier for not supporting four players), so this can't disturb it.
  "alex:cascade-protocol": { completed: false, playtimeMinutes: 0, installed: true, lastPlayedAt: null },
  "alex:skybound-cartographers": { completed: false, playtimeMinutes: 0, installed: false, lastPlayedAt: null },

  // Secondary demo beats — resume, backlog, presence.
  "alex:ashen-frontier": { completed: false, playtimeMinutes: 890, installed: true, lastPlayedAt: "2026-08-17" },
  "alex:quiet-orchard": { completed: false, playtimeMinutes: 35, installed: true, lastPlayedAt: "2026-07-30" },
  "alex:driftwood-and-static": { completed: true, playtimeMinutes: 205, installed: false, lastPlayedAt: "2026-06-11" },
  "justin:glasshouse": { completed: true, playtimeMinutes: 90, installed: true, lastPlayedAt: "2026-08-10" },
  "sarah:glasshouse": { completed: true, playtimeMinutes: 75, installed: true, lastPlayedAt: "2026-08-12" },
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

      // A null last-played date means never launched, so playtime and
      // completion have to agree with it. Generating them independently
      // produced entries claiming 300 minutes played on a game that had
      // never been started.
      const lastPlayedAt = FALLBACK_DATES[Math.floor(r4 * FALLBACK_DATES.length)];
      const neverStarted = lastPlayedAt === null;

      entries.push({
        userId,
        gameId: game.id,
        playtimeMinutes: neverStarted ? 0 : Math.round(30 + r1 * 500),
        completed: neverStarted ? false : r2 < 0.3,
        installed: r3 < 0.75,
        lastPlayedAt,
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
