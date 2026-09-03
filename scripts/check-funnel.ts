// Verifies the hero-query dataset holds the shape the demo depends on:
// exactly one clean answer, exactly one legible near-miss. Run with:
//   npx tsx scripts/check-funnel.ts
//
// Every filter below corresponds to something the hero prompt actually says.
// That matters: an earlier version of this script narrowed the field with a
// no-horror preference the prompt never stated, so it reported "exactly one
// answer" while a real agent could just as correctly have answered Hollow
// Choir or Fathom Line. The prompt now states the preference, and the labels
// here name which clause each step comes from.
import { GAMES, GAME_BY_ID } from "../src/data/games";
import { LIBRARY } from "../src/data/libraries";
import { fitsSessionBudget } from "../src/lib/filterGames";

const PLAYER = "purple";
const FRIENDS = ["alex", "sam", "maya"];
const PARTY = [PLAYER, ...FRIENDS];
const AVAILABLE_MINUTES = 75;

export const HERO_PROMPT =
  "Alex, Sam and Maya are online. We've got about 75 minutes. Find a co-op game all four of us can play — " +
  "preferably something none of us has finished, and nothing scary.";

function ownersOf(gameId: string): Set<string> {
  return new Set(LIBRARY.filter((e) => e.gameId === gameId).map((e) => e.userId));
}

function completersOf(gameId: string): Set<string> {
  return new Set(LIBRARY.filter((e) => e.gameId === gameId && e.completed).map((e) => e.userId));
}

let step = GAMES;
const log = (label: string, games: typeof GAMES) =>
  console.log(`${label.padEnd(34)} ${games.length.toString().padStart(2)}  ${games.map((g) => g.title).join(", ")}`);

console.log(`prompt: ${HERO_PROMPT}\n`);
log("all games", step);

// "all four of us" -> everyone must own it
step = step.filter((g) => PARTY.every((u) => ownersOf(g.id).has(u)));
log('"all four of us" own it', step);

// "all four of us can play" -> must support a 4-player group
step = step.filter((g) => g.minPlayers <= 4 && g.maxPlayers >= 4);
log('"all four" supported', step);

// "a co-op game"
step = step.filter((g) => g.coopModes.length > 0);
log('"co-op"', step);

// "about 75 minutes" — the same rule the product's filters and search_games
// apply, imported rather than restated so the two can never drift apart.
step = step.filter((g) => fitsSessionBudget(g.sessionMinutes, AVAILABLE_MINUTES));
log('"about 75 minutes"', step);

// "preferably something none of us has finished"
const nobodyFinished = step.filter((g) => {
  const completers = completersOf(g.id);
  return PARTY.every((u) => !completers.has(u));
});
const someoneFinished = step.filter((g) => !nobodyFinished.includes(g));
log('  -> "none of us has finished"', nobodyFinished);
log("  -> someone finished (near-miss pool)", someoneFinished);

// "nothing scary"
const answers = nobodyFinished.filter((g) => !g.genres.includes("Horror"));
log('  -> "nothing scary"', answers);

console.log("\n--- assertions ---");

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`OK:   ${msg}`);
  }
}

assert(answers.length === 1, "exactly one game satisfies every clause of the hero prompt");
assert(answers[0]?.id === "nightfall-signal", "the clean answer is Nightfall Signal");

const ridgeRunners = GAME_BY_ID["ridge-runners"];
assert(someoneFinished.some((g) => g.id === "ridge-runners"), "Ridge Runners is a near-miss (fails only on completion)");
assert(completersOf("ridge-runners").has("sam"), "Ridge Runners near-miss reason is: Sam completed it");
assert(ridgeRunners.minPlayers <= 4 && ridgeRunners.maxPlayers >= 4, "Ridge Runners otherwise supports 4 players");
assert(fitsSessionBudget(ridgeRunners.sessionMinutes, AVAILABLE_MINUTES), "Ridge Runners otherwise fits ~75 minutes");
assert(ridgeRunners.coopModes.length > 0, "Ridge Runners otherwise has a co-op mode");
assert(PARTY.every((u) => ownersOf("ridge-runners").has(u)), "Ridge Runners is otherwise owned by all four");
assert(!ridgeRunners.genres.includes("Horror"), "Ridge Runners is not excluded by the no-horror preference");

if (process.exitCode === 1) {
  console.error("\nFunnel check FAILED — tune src/data/libraries.ts / games.ts.");
  process.exit(1);
} else {
  console.log("\nFunnel check PASSED.");
}
