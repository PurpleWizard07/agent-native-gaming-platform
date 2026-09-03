// Simulates document.modelContext with a shim so we can exercise the real
// registration + execute wiring end-to-end (registered/unregistered per page,
// actual data returned) without needing real Chrome + the WebMCP flag, which
// this environment can't drive. This does NOT prove the browser-native API
// shape matches Chrome's exactly — see implementation-plan.md Phase 0/5 for
// the live check that still needs a real browser.
import { chromium } from "playwright";
import fs from "node:fs";

const outDir = "scripts/.verify-screens";
fs.mkdirSync(outDir, { recursive: true });

const BASE = process.env.BASE_URL ?? "http://localhost:8888";
// Parties are namespaced per room (src/lib/room.ts); pin a test-only one so
// this run can't collide with a live demo party.
const ROOM = "verify-webmcp";
const API = `${BASE}/api/party?room=${ROOM}`;
const url = (path) => `${BASE}${path}${path.includes("?") ? "&" : "?"}room=${ROOM}`;

async function api(body) {
  return fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
const reset = () => api({ action: "reset" });
await reset();

// Installs the shim BEFORE any page script runs, i.e. the easy case where the
// WebMCP API is already there at mount. The late-injection case is covered at
// the bottom of this file.
const SHIM = () => {
  window.__tools = [];
  window.document.modelContext = {
    registerTool: (descriptor, opts) => {
      window.__tools.push(descriptor);
      opts?.signal?.addEventListener("abort", () => {
        window.__tools = window.__tools.filter((t) => t !== descriptor);
      });
      return Promise.resolve();
    },
  };
};

const browser = await chromium.launch();
const page = await browser.newPage();

const errors = [];
// The error-path tests below deliberately provoke a 404 from /api/party, which
// the browser logs as a console error. Only those are exempt, and only while a
// test is actually asking for one.
let expectingApiError = false;
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() !== "error") return;
  if (expectingApiError && m.text().includes("404")) return;
  errors.push(m.text());
});

await page.addInitScript(SHIM);

async function toolNames(target = page) {
  return target.evaluate(() => window.__tools.map((t) => t.name).sort());
}

// Returns the parsed payload; throws if the tool reported an error, so the
// happy-path assertions below stay terse.
async function callTool(name, input = {}) {
  const raw = await callToolRaw(name, input);
  if (raw.isError) throw new Error(`tool ${name} errored: ${raw.text}`);
  return JSON.parse(raw.text);
}

// The unwrapped result, for asserting on the error shape itself.
async function callToolRaw(name, input = {}, target = page) {
  return target.evaluate(
    async ([name, input]) => {
      const tool = window.__tools.find((t) => t.name === name);
      if (!tool) throw new Error(`tool not registered: ${name}`);
      const controller = new AbortController();
      const result = await tool.execute(input, { signal: controller.signal });
      return { text: result.content[0].text, isError: result.isError === true };
    },
    [name, input],
  );
}

function assert(cond, msg) {
  console.log((cond ? "OK:   " : "FAIL: ") + msg);
  if (!cond) process.exitCode = 1;
}

// The view tools used to be gated to Store/Library/game pages, which left a
// player who landed on Home with no tool that could change the screen — the
// agent could only read. They now register everywhere and navigate on demand;
// scripts/verify-agent-drives-ui.mjs covers what that gating used to prevent.
console.log("--- Home: every tool but the invite responder should be registered ---");
await page.goto(url("/"), { waitUntil: "networkidle" });
await page.waitForSelector("text=Continue Playing");
const homeTools = await toolNames();
console.log(homeTools.join(", "));
assert(homeTools.length === 13, `13 tools on Home (got ${homeTools.length})`);
assert(homeTools.includes("get_current_view"), "get_current_view IS registered on Home");
assert(homeTools.includes("apply_filters"), "apply_filters IS registered on Home");
assert(homeTools.includes("show_games"), "show_games IS registered on Home");
assert(homeTools.includes("open_game"), "open_game IS registered on Home");
assert(!homeTools.includes("respond_to_invite"), "respond_to_invite NOT registered with no invite pending");

console.log("\n--- annotations: reads are marked read-only, writes are not ---");
const annotated = await page.evaluate(() =>
  window.__tools.map((t) => [t.name, t.annotations?.readOnlyHint]),
);
const byName = Object.fromEntries(annotated);
assert(
  ["get_online_friends", "get_my_library", "get_friend_libraries", "search_games", "get_game_details", "get_party_status"].every(
    (n) => byName[n] === true,
  ),
  "every read tool declares readOnlyHint: true",
);
assert(
  ["create_party", "invite_friends", "launch_session"].every((n) => byName[n] === false),
  "every mutating tool declares readOnlyHint: false",
);

console.log("\n--- get_online_friends ---");
const onlineFriends = await callTool("get_online_friends");
console.log(onlineFriends);
assert(
  onlineFriends.some((f) => f.id === "justin" && f.playingGameId === "ridge-runners"),
  "Justin shows as playing Ridge Runners",
);
assert(
  onlineFriends.some((f) => f.id === "justin" && f.playingGameTitle === "Ridge Runners"),
  "playingGameTitle saves a get_game_details round trip",
);

console.log("\n--- structured errors: a party action with no party is legible, not opaque ---");
expectingApiError = true;
const noParty = await callToolRaw("invite_friends", { friendIds: ["justin"] });
console.log(noParty);
assert(noParty.isError === true, "invite_friends with no active party reports isError");
assert(JSON.parse(noParty.text).error === "no active party", "the error text names the cause the agent can recover from");

console.log("\n--- launch_session with no party explains itself rather than just failing ---");
const notReady = await callTool("launch_session");
console.log(notReady);
assert(notReady.status === "not_ready" && notReady.reason === "no active party", "launch_session reports why it can't launch");
expectingApiError = false;

console.log("\n--- Store: all 13 tools should be registered ---");
await page.goto(url("/store"), { waitUntil: "networkidle" });
await page.waitForSelector("text=Store");
const storeTools = await toolNames();
console.log(storeTools.join(", "));
assert(storeTools.length === 13, `13 tools on Store (got ${storeTools.length})`);

console.log("\n--- search_games: co-op, 4 players, fits 75 min ---");
const searchResult = await callTool("search_games", { coop: true, minPlayers: 4, maxSessionMinutes: 75 });
console.log(searchResult.map((g) => g.title));
assert(searchResult.some((g) => g.gameId === "nightfall-signal"), "search_games surfaces Nightfall Signal");
assert(searchResult.some((g) => g.gameId === "ridge-runners"), "search_games surfaces Ridge Runners");

// A 60-120 min game can technically be played in 75 minutes, but recommending
// it to someone with 75 minutes is wrong. The old rule only compared the
// SHORTEST session to the budget and let this through.
const budgeted = await callTool("search_games", { maxSessionMinutes: 75 });
assert(
  !budgeted.some((g) => g.gameId === "windward-traders"),
  "a 60-120 min game does NOT satisfy a 75 minute budget",
);
assert(budgeted.some((g) => g.gameId === "nightfall-signal"), "a 45-70 min game does satisfy a 75 minute budget");

console.log("\n--- search_games: free-text query covers title and genre ---");
const byTitle = await callTool("search_games", { query: "nightfall" });
assert(byTitle.length === 1 && byTitle[0].gameId === "nightfall-signal", "query matches a title");
const byGenre = await callTool("search_games", { query: "horror" });
assert(byGenre.length > 0 && byGenre.every((g) => g.genres.some((x) => x.toLowerCase() === "horror")), "query matches a genre");

console.log("\n--- get_my_library: onlyUnplayed is stricter than onlyUnfinished ---");
const unfinished = await callTool("get_my_library", { onlyUnfinished: true });
const unplayed = await callTool("get_my_library", { onlyUnplayed: true });
console.log("unfinished:", unfinished.length, "| never started:", unplayed.length);
assert(unplayed.length > 0, "some owned games have never been started");
assert(unplayed.every((e) => e.playtimeMinutes === 0), "onlyUnplayed returns only zero-playtime games");
assert(unplayed.length < unfinished.length, "onlyUnplayed is a strict subset of onlyUnfinished");

console.log("\n--- get_friend_libraries: justin, robert, sarah ---");
const friendLibs = await callTool("get_friend_libraries", { friendIds: ["justin", "robert", "sarah"] });
const nightfallOwners = ["justin", "robert", "sarah"].filter((id) => friendLibs[id].some((e) => e.gameId === "nightfall-signal"));
assert(nightfallOwners.length === 3, "all three friends own Nightfall Signal per get_friend_libraries");
const ridgeRunnersCompleters = ["justin", "robert", "sarah"].filter((id) => friendLibs[id].some((e) => e.gameId === "ridge-runners" && e.completed));
assert(ridgeRunnersCompleters.length === 1 && ridgeRunnersCompleters[0] === "robert", "only Robert has completed Ridge Runners, per get_friend_libraries");

console.log("\n--- get_game_details: friendsWhoOwn ---");
const details = await callTool("get_game_details", { gameIds: ["nightfall-signal"] });
console.log(details[0].friendsWhoOwn);
assert(details[0].friendsWhoOwn.length === 3, "Nightfall Signal detail lists all 3 friends as owners");

console.log("\n--- apply_filters, then get_current_view reflects it ---");
await callTool("apply_filters", { coop: true, minPlayers: 4 });
await page.waitForTimeout(150);

// An agent changing the screen has to be visible to the human supervising it.
const toast = page.getByRole("status");
assert(await toast.getByText("Filters updated").isVisible(), "an agent-applied filter raises a visible toast");
await page.screenshot({ path: `${outDir}/webmcp-01-agent-toast.png` });
const view = await callTool("get_current_view");
console.log("visible games after filter:", view.visibleGames);
assert(view.page === "/store", "get_current_view reports page=/store");
assert(view.visibleGames.includes("Nightfall Signal"), "get_current_view's visible games reflect the just-applied filter");
assert(!view.visibleGames.includes("Copper & Steam"), "2-player-only game excluded from visible games after minPlayers:4 filter");

// Also confirm the ACTUAL DOM grid matches what the tool reported — the tool
// must describe the real screen, not a shadow copy of it.
const domTitles = await page.locator('a[data-game-id] span.relative.z-10').allTextContents();
assert(
  domTitles.includes("Nightfall Signal") && view.visibleGames.includes("Nightfall Signal"),
  "get_current_view matches what's actually rendered in the DOM",
);

console.log("\n--- open_game navigates the real page ---");
const openResult = await callTool("open_game", { gameId: "nightfall-signal" });
console.log(openResult);
await page.waitForURL(/\/game\/nightfall-signal/);
await page.waitForSelector("h1:has-text('Nightfall Signal')");
assert(true, "open_game navigated the browser to the game page");

console.log("\n--- game page: view context follows the player, minus the tools that make no sense there ---");
const gamePageTools = await toolNames();
console.log(gamePageTools.join(", "));
assert(gamePageTools.includes("get_current_view"), "get_current_view IS registered on a game page");
assert(gamePageTools.includes("open_game"), "open_game IS registered on a game page");
// A game page has no filter bar, but apply_filters still registers here: it
// takes the player back to the Store rather than vanishing from the tool list,
// which is what an agent needs to act on "show me the co-op ones instead".
assert(gamePageTools.includes("apply_filters"), "apply_filters IS registered on a game page (it navigates to the Store)");
const gameView = await callTool("get_current_view");
console.log(gameView);
assert(gameView.selectedGameId === "nightfall-signal", "get_current_view names the game in focus");
assert(gameView.selectedGame === "Nightfall Signal", "get_current_view names the focused game's title");
assert(gameView.visibleGameIds === undefined, "a game page does NOT report the stale list from the page before it");

console.log("\n--- full party flow via tools: create -> invite -> status ---");
await callTool("create_party", { gameId: "nightfall-signal" });
const afterInvite = await callTool("invite_friends", { friendIds: ["justin", "robert", "sarah"] });
console.log(afterInvite);
const status1 = await callTool("get_party_status");
assert(status1.active === true && status1.status === "forming", "party is 'forming' right after inviting");
assert(status1.readyToLaunch === false, "readyToLaunch is false before anyone accepts");
assert(status1.gameTitle === "Nightfall Signal", "get_party_status names the game");
assert(status1.members.every((m) => typeof m.name === "string"), "get_party_status names each member");

console.log("\n--- launch_session names who it is waiting on ---");
const waiting = await callTool("launch_session");
console.log(waiting);
assert(waiting.status === "not_ready", "launch_session refuses while members are still invited");
assert(waiting.waitingOn.sort().join(",") === "Justin,Robert,Sarah", "launch_session names exactly who has not responded");

// Simulate Justin/Robert/Sarah accepting via the same API the UI uses.
for (const id of ["justin", "robert", "sarah"]) {
  await api({ action: "respond", userId: id, accept: true });
}
await page.waitForTimeout(1800); // let PartyContext's poll pick it up

const status2 = await callTool("get_party_status");
assert(status2.status === "ready" && status2.readyToLaunch === true, "party becomes 'ready' once everyone accepts");

const launchResult = await callTool("launch_session");
console.log(launchResult);
assert(launchResult.status === "launching", "launch_session returns status: launching");

console.log("\n--- respond_to_invite appears only in a session that has an invite pending ---");
await reset();
await api({ action: "create", gameId: "nightfall-signal", hostId: "alex" });
await api({ action: "invite", friendIds: ["justin"] });

await page.goto(url("/party"), { waitUntil: "networkidle" });
await page.getByLabel("View as").selectOption({ label: "Justin" });
await page.waitForSelector("text=You've been invited");
const alexTools = await toolNames();
console.log(alexTools.join(", "));
assert(alexTools.includes("respond_to_invite"), "respond_to_invite IS registered while Justin has a pending invite");

const responded = await callTool("respond_to_invite", { accept: true });
console.log(responded);
assert(responded.accepted === true, "respond_to_invite accepts on the invited player's behalf");
assert(
  responded.members.find((m) => m.userId === "justin")?.state === "accepted",
  "the shared party state records Justin as accepted",
);
await page.waitForSelector("text=Accepted");
await page.waitForTimeout(300);
assert(
  !(await toolNames()).includes("respond_to_invite"),
  "respond_to_invite unregisters once there is nothing left to respond to",
);

console.log("\n--- late-injected document.modelContext still gets the tools ---");
// An agent host that installs the WebMCP API after first paint used to end up
// with zero registered tools, silently. No addInitScript here on purpose.
const lateCtx = await browser.newContext();
const latePage = await lateCtx.newPage();
await latePage.goto(url("/store"), { waitUntil: "networkidle" });
const beforeInjection = await latePage.evaluate(() => window.__tools?.length ?? "no shim yet");
await latePage.evaluate(SHIM);
await latePage.waitForFunction(() => (window.__tools?.length ?? 0) >= 12, null, { timeout: 5000 });
const lateTools = await toolNames(latePage);
console.log("before injection:", beforeInjection, "| after:", lateTools.length);
assert(lateTools.length === 13, `all 13 Store tools register after a late injection (got ${lateTools.length})`);
const lateView = await callToolRaw("get_current_view", {}, latePage);
assert(JSON.parse(lateView.text).page === "/store", "a late-registered tool actually executes");
await lateCtx.close();

await browser.close();
await reset();

console.log("\n--- page errors ---");
if (errors.length === 0) {
  console.log("none");
} else {
  errors.forEach((e) => console.log(e));
  process.exitCode = 1;
}
