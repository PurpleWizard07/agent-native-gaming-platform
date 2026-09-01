// Guards the hero demo's first beat: a player lands on Store, sets filters by
// hand, and asks "do any of these work?" — get_current_view must describe what
// is actually on screen, including on a freshly loaded page before any tool
// has touched the filters.
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

async function callTool(name, input = {}) {
  return page.evaluate(
    async ([name, input]) => {
      const tool = window.__tools.find((t) => t.name === name);
      if (!tool) throw new Error(`tool not registered: ${name}`);
      const result = await tool.execute(input, { signal: new AbortController().signal });
      return JSON.parse(result.content[0].text);
    },
    [name, input],
  );
}

function assert(cond, msg) {
  console.log((cond ? "OK:   " : "FAIL: ") + msg);
  if (!cond) process.exitCode = 1;
}

console.log("--- fresh /store load, no filters touched ---");
await page.goto(`${BASE}/store`, { waitUntil: "networkidle" });
await page.waitForSelector("text=24 games");
const fresh = await callTool("get_current_view");
console.log("visibleGameIds:", fresh.visibleGameIds.length, "| visibleGames:", fresh.visibleGames.slice(0, 3), "...");
assert(fresh.visibleGameIds.length === 24, `fresh Store view reports all 24 games (got ${fresh.visibleGameIds.length})`);

console.log("\n--- player sets a filter BY HAND (clicking the UI, not a tool) ---");
await page.getByRole("button", { name: "Co-op", exact: true }).click();
await page.waitForTimeout(200);
const domCount = await page.locator("a[data-game-id]").count();
const handFiltered = await callTool("get_current_view");
console.log("DOM cards:", domCount, "| tool reports:", handFiltered.visibleGameIds.length);
assert(handFiltered.visibleGameIds.length === domCount, "after a hand-set filter, the tool matches the DOM exactly");
assert(handFiltered.filters.genres.includes("Co-op"), "the tool reports the hand-set Co-op genre filter");

console.log("\n--- fresh /library load ---");
await page.goto(`${BASE}/library`, { waitUntil: "networkidle" });
await page.waitForSelector("text=Library");
await page.waitForTimeout(200);
const lib = await callTool("get_current_view");
const libDomCount = await page.locator("a[data-game-id]").count();
console.log("library DOM cards:", libDomCount, "| tool reports:", lib.visibleGameIds.length);
assert(lib.visibleGameIds.length === libDomCount && libDomCount > 0, "fresh Library view matches the DOM");

// The reset that remains in ViewProvider exists to stop Store's filters
// leaking into Library. Client-side navigation (not a fresh load) is the
// case that actually exercises it.
console.log("\n--- in-app navigation: filtered Store -> Library must not leak filters ---");
await page.goto(`${BASE}/store`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Horror", exact: true }).click();
await page.waitForTimeout(200);
const storeFiltered = await callTool("get_current_view");
assert(storeFiltered.filters.genres.includes("Horror"), "Store has the Horror filter set before navigating");

await page.getByRole("link", { name: "Library", exact: true }).click();
await page.waitForURL(/\/library$/);
await page.waitForTimeout(300);
const afterNav = await callTool("get_current_view");
const afterNavDom = await page.locator("a[data-game-id]").count();
console.log("after nav — filters:", JSON.stringify(afterNav.filters), "| DOM:", afterNavDom, "| tool:", afterNav.visibleGameIds.length);
assert(afterNav.filters.genres.length === 0, "Store's Horror filter did NOT leak into Library");
assert(afterNav.visibleGameIds.length === afterNavDom && afterNavDom > 0, "after navigation the tool still matches the DOM");

await browser.close();
