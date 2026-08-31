// Verifies the hero-query dataset holds the shape the demo depends on:
// exactly one clean answer, exactly one legible near-miss. Run with:
//   npx tsx scripts/check-funnel.ts
import { GAMES, GAME_BY_ID } from "../src/data/games";
import { LIBRARY } from "../src/data/libraries";

const PLAYER = "purple";
const FRIENDS = ["alex", "sam", "maya"];
const PARTY = [PLAYER, ...FRIENDS];
const AVAILABLE_MINUTES = 75;

function ownersOf(gameId: string): Set<string> {
  return new Set(LIBRARY.filter((e) => e.gameId === gameId).map((e) => e.userId));
}

function completersOf(gameId: string): Set<string> {
  return new Set(LIBRARY.filter((e) => e.gameId === gameId && e.completed).map((e) => e.userId));
}

function fitsSession(min: number, max: number): boolean {
  return min <= AVAILABLE_MINUTES && max <= AVAILABLE_MINUTES * 1.3;
}

let step = GAMES;
const log = (label: string, games: typeof GAMES) => console.log(`${label.padEnd(28)} ${games.length.toString().padStart(2)}  ${games.map((g) => g.title).join(", ")}`);

log("all games", step);

step = step.filter((g) => PARTY.every((u) => ownersOf(g.id).has(u)));
log("all four own", step);

step = step.filter((g) => g.minPlayers <= 4 && g.maxPlayers >= 4);
log("supports 4 players", step);

step = step.filter((g) => g.coopModes.length > 0);
log("has co-op mode", step);

step = step.filter((g) => fitsSession(g.sessionMinutes.min, g.sessionMinutes.max));
log("fits ~75 min", step);

const nobodyFinished = step.filter((g) => {
  const completers = completersOf(g.id);
  return PARTY.every((u) => !completers.has(u));
});
const someoneFinished = step.filter((g) => !nobodyFinished.includes(g));
log("  -> nobody finished", nobodyFinished);
log("  -> someone finished (near-miss pool)", someoneFinished);

const nonHorror = nobodyFinished.filter((g) => !g.genres.includes("Horror"));
log("  -> non-horror", nonHorror);

console.log("\n--- assertions ---");

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`OK:   ${msg}`);
  }
}

assert(nonHorror.length === 1, "exactly one clean answer after all hard constraints + preferences");
assert(nonHorror[0]?.id === "nightfall-signal", "the clean answer is Nightfall Signal");

const rideRunners = GAME_BY_ID["ridge-runners"];
assert(someoneFinished.some((g) => g.id === "ridge-runners"), "Ridge Runners is a near-miss (fails only on completion)");
assert(completersOf("ridge-runners").has("sam"), "Ridge Runners near-miss reason is: Sam completed it");
assert(rideRunners.minPlayers <= 4 && rideRunners.maxPlayers >= 4, "Ridge Runners otherwise supports 4 players");
assert(fitsSession(rideRunners.sessionMinutes.min, rideRunners.sessionMinutes.max), "Ridge Runners otherwise fits ~75 minutes");
assert(rideRunners.coopModes.length > 0, "Ridge Runners otherwise has a co-op mode");
assert(PARTY.every((u) => ownersOf("ridge-runners").has(u)), "Ridge Runners is otherwise owned by all four");

if (process.exitCode === 1) {
  console.error("\nFunnel check FAILED — tune src/data/libraries.ts / games.ts.");
  process.exit(1);
} else {
  console.log("\nFunnel check PASSED.");
}
