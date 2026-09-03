// Guards the bug that shipped: view tools used to be registered only on Store,
// Library and game pages. A player who opened the site normally landed on Home,
// where the tool list contained nothing that could change the screen — so an
// agent asked to find a game called search_games, answered correctly in chat,
// and left the page untouched.
//
// Every other script in this suite navigates straight to /store, which is
// exactly why none of them caught it. This one starts on Home, on purpose.
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:8888";

const browser = await chromium.launch();
const page = await browser.newPage();

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
  return (await page.evaluate(() => window.__tools.map((t) => t.name))).sort();
}

async function callToolRaw(name, input = {}) {
  return page.evaluate(
    async ([name, input]) => {
      const tool = window.__tools.find((t) => t.name === name);
      if (!tool) throw new Error(`tool not registered: ${name}`);
      const result = await tool.execute(input, { signal: new AbortController().signal });
      return { isError: !!result.isError, data: JSON.parse(result.content[0].text) };
    },
    [name, input],
  );
}

async function callTool(name, input = {}) {
  const { isError, data } = await callToolRaw(name, input);
  if (isError) throw new Error(`tool ${name} failed: ${data.error}`);
  return data;
}

function assert(cond, msg) {
  console.log((cond ? "OK:   " : "FAIL: ") + msg);
  if (!cond) process.exitCode = 1;
}

const domGameIds = () =>
  page.$$eval("a[data-game-id]", (els) => els.map((e) => e.getAttribute("data-game-id")));

// ---------------------------------------------------------------------------
console.log("--- the landing page must expose the tools that drive the screen ---");
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);

const homeTools = await toolNames();
console.log("tools on /:", homeTools.join(", "));
for (const name of ["get_current_view", "apply_filters", "show_games", "open_game"]) {
  assert(homeTools.includes(name), `${name} is registered on the landing page`);
}

const homeView = await callTool("get_current_view");
const homeDom = await domGameIds();
// Compared as a set, not a count: Home's two grids overlap — a game that is
// both in progress and "popular for you" renders twice. The tool reports each
// game once, which is what an agent should see.
const homeDomUnique = [...new Set(homeDom)];
console.log(
  "Home — tool reports:", homeView.visibleGameIds.length,
  "| DOM cards:", homeDom.length,
  "| distinct games on screen:", homeDomUnique.length,
);
assert(homeView.page === "/", "get_current_view reports the Home page");
assert(homeView.filterable === false, "Home is reported as having no filter bar");
assert(homeDomUnique.length > 0, "Home renders game cards at all");
assert(
  homeView.visibleGameIds.length === homeDomUnique.length &&
    homeDomUnique.every((id) => homeView.visibleGameIds.includes(id)),
  "Home reports exactly the distinct games it renders",
);

// ---------------------------------------------------------------------------
console.log("\n--- show_games from Home: a reasoned shortlist must land on screen ---");
const catalog = await callTool("search_games", { coop: true });
const picks = catalog.slice(0, 3).map((g) => g.gameId);
console.log("agent picks:", picks.join(", "));

const shown = await callTool("show_games", { gameIds: picks });
await page.waitForURL(/\/store$/);
await page.waitForTimeout(400);

const shownDom = await domGameIds();
console.log("tool landed on:", shown.page, "| DOM now shows:", shownDom.join(", "));
assert(shown.page === "/store" && shown.navigated === true, "show_games moved the player to the Store");
assert(
  shownDom.length === picks.length && picks.every((id) => shownDom.includes(id)),
  "the Store shows exactly the three games the agent picked",
);
assert(
  await page.locator('[data-testid="pinned-banner"]').isVisible(),
  "the player is told their view has been narrowed to a shortlist",
);

const pinnedView = await callTool("get_current_view");
assert(
  pinnedView.visibleGameIds.length === picks.length,
  "get_current_view agrees with the screen after show_games",
);

// ---------------------------------------------------------------------------
console.log("\n--- the human can escape a shortlist the agent pinned ---");
await page.getByRole("button", { name: "Show everything" }).click();
await page.waitForTimeout(300);
const escapedDom = await domGameIds();
console.log("after 'Show everything':", escapedDom.length, "cards");
assert(escapedDom.length === 24, "clearing the pin restores the full catalog");

// ---------------------------------------------------------------------------
console.log("\n--- bad ids must fail loudly, not pin an empty screen ---");
const bad = await callToolRaw("show_games", { gameIds: ["not-a-real-game"] });
console.log("error returned:", bad.data.error);
assert(bad.isError === true, "show_games reports an error for ids that don't exist");
assert((await domGameIds()).length === 24, "a failed show_games leaves the screen untouched");

// ---------------------------------------------------------------------------
console.log("\n--- apply_filters from a page with no filter bar ---");
await page.goto(`${BASE}/friends`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);

const friendsView = await callTool("get_current_view");
assert(
  friendsView.visibleGameIds.length === 0,
  "a page with no game list reports an empty screen, not the list left behind",
);

const filtered = await callTool("apply_filters", { genres: ["Horror"] });
await page.waitForURL(/\/store$/);
await page.waitForTimeout(400);

const filteredView = await callTool("get_current_view");
const filteredDom = await domGameIds();
console.log("landed on:", filtered.page, "| filters:", JSON.stringify(filteredView.filters.genres), "| DOM:", filteredDom.length);
assert(filtered.navigated === true, "apply_filters moved the player to the Store");
assert(
  filteredView.filters.genres.includes("Horror"),
  "the staged filter survived the navigation instead of being reset",
);
assert(
  filteredDom.length === filteredView.visibleGameIds.length && filteredDom.length > 0,
  "the filtered Store matches what the tool reports",
);

// ---------------------------------------------------------------------------
console.log("\n--- clearing from a page with no filters must not yank the player ---");
await page.goto(`${BASE}/friends`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const cleared = await callTool("apply_filters", { clear: true });
await page.waitForTimeout(300);
console.log("result:", JSON.stringify(cleared));
assert(cleared.cleared === false, "apply_filters says there was nothing to clear");
assert(new URL(page.url()).pathname === "/friends", "the player stayed on Friends");

await browser.close();
