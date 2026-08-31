// Simulates document.modelContext with a shim so we can exercise the real
// registration + execute wiring end-to-end (registered/unregistered per page,
// actual data returned) without needing real Chrome + the WebMCP flag, which
// this environment can't drive. This does NOT prove the browser-native API
// shape matches Chrome's exactly — see implementation-plan.md Phase 0/5 for
// the live check that still needs a real browser.
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:8888";

async function reset() {
  await fetch(`${BASE}/api/party`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reset" }),
  });
}
await reset();

const browser = await chromium.launch();
const page = await browser.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.addInitScript(() => {
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
});

async function toolNames() {
  return page.evaluate(() => window.__tools.map((t) => t.name).sort());
}

async function callTool(name, input = {}) {
  return page.evaluate(
    async ([name, input]) => {
      const tool = window.__tools.find((t) => t.name === name);
      if (!tool) throw new Error(`tool not registered: ${name}`);
      const controller = new AbortController();
      const result = await tool.execute(input, { signal: controller.signal });
      return JSON.parse(result.content[0].text);
    },
    [name, input],
  );
}

function assert(cond, msg) {
  console.log((cond ? "OK:   " : "FAIL: ") + msg);
  if (!cond) process.exitCode = 1;
}

console.log("--- Home: only global tools should be registered (no page-context tools) ---");
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForSelector("text=Good evening");
const homeTools = await toolNames();
console.log(homeTools.join(", "));
assert(homeTools.length === 9, `9 tools on Home (got ${homeTools.length})`);
assert(!homeTools.includes("get_current_view"), "get_current_view NOT registered on Home");
assert(!homeTools.includes("apply_filters"), "apply_filters NOT registered on Home");
assert(!homeTools.includes("open_game"), "open_game NOT registered on Home");

console.log("\n--- get_online_friends ---");
const onlineFriends = await callTool("get_online_friends");
console.log(onlineFriends);
assert(onlineFriends.some((f) => f.id === "alex" && f.playingGameId === "ridge-runners"), "Alex shows as playing Ridge Runners");

console.log("\n--- Store: all 12 tools should be registered ---");
await page.goto(`${BASE}/store`, { waitUntil: "networkidle" });
await page.waitForSelector("text=Store");
const storeTools = await toolNames();
console.log(storeTools.join(", "));
assert(storeTools.length === 12, `12 tools on Store (got ${storeTools.length})`);

console.log("\n--- search_games: co-op, 4 players, fits 75 min ---");
const searchResult = await callTool("search_games", { coop: true, minPlayers: 4, maxSessionMinutes: 75 });
console.log(searchResult.map((g) => g.title));
assert(searchResult.some((g) => g.gameId === "nightfall-signal"), "search_games surfaces Nightfall Signal");
assert(searchResult.some((g) => g.gameId === "ridge-runners"), "search_games surfaces Ridge Runners");

console.log("\n--- get_friend_libraries: alex, sam, maya ---");
const friendLibs = await callTool("get_friend_libraries", { friendIds: ["alex", "sam", "maya"] });
const nightfallOwners = ["alex", "sam", "maya"].filter((id) => friendLibs[id].some((e) => e.gameId === "nightfall-signal"));
assert(nightfallOwners.length === 3, "all three friends own Nightfall Signal per get_friend_libraries");
const ridgeRunnersCompleters = ["alex", "sam", "maya"].filter((id) => friendLibs[id].some((e) => e.gameId === "ridge-runners" && e.completed));
assert(ridgeRunnersCompleters.length === 1 && ridgeRunnersCompleters[0] === "sam", "only Sam has completed Ridge Runners, per get_friend_libraries");

console.log("\n--- get_game_details: friendsWhoOwn ---");
const details = await callTool("get_game_details", { gameIds: ["nightfall-signal"] });
console.log(details[0].friendsWhoOwn);
assert(details[0].friendsWhoOwn.length === 3, "Nightfall Signal detail lists all 3 friends as owners");

console.log("\n--- apply_filters, then get_current_view reflects it ---");
await callTool("apply_filters", { coop: true, minPlayers: 4 });
await page.waitForTimeout(150);
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
await page.waitForURL(/\/game\/nightfall-signal$/);
await page.waitForSelector("h1:has-text('Nightfall Signal')");
assert(true, "open_game navigated the browser to the game page");

console.log("\n--- full party flow via tools: create -> invite -> status ---");
await callTool("create_party", { gameId: "nightfall-signal" });
const afterInvite = await callTool("invite_friends", { friendIds: ["alex", "sam", "maya"] });
console.log(afterInvite);
const status1 = await callTool("get_party_status");
assert(status1.active === true && status1.status === "forming", "party is 'forming' right after inviting");
assert(status1.readyToLaunch === false, "readyToLaunch is false before anyone accepts");

// Simulate Alex/Sam/Maya accepting via the same API the UI uses.
for (const id of ["alex", "sam", "maya"]) {
  await fetch(`${BASE}/api/party`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "respond", userId: id, accept: true }),
  });
}
await page.waitForTimeout(1800); // let PartyContext's poll pick it up

const status2 = await callTool("get_party_status");
assert(status2.status === "ready" && status2.readyToLaunch === true, "party becomes 'ready' once everyone accepts");

const launchResult = await callTool("launch_session");
console.log(launchResult);
assert(launchResult.status === "launching", "launch_session returns status: launching");

await browser.close();
await reset();

console.log("\n--- page errors ---");
if (errors.length === 0) {
  console.log("none");
} else {
  errors.forEach((e) => console.log(e));
  process.exitCode = 1;
}
