// The test that matters most: two independent browser sessions (Purple and
// Alex) exchanging a REAL invite through the deployed party service, not a
// mocked/timed fake. See implementation-plan.md Phase 3.
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:8888";
// Parties are namespaced per room so concurrent visitors do not clobber each
// other (src/lib/room.ts). Both browser sessions and the raw API calls below
// therefore have to name the SAME room, and pinning a test-only one keeps this
// run from disturbing a live demo party.
const ROOM = "verify-party";
const API = `${BASE}/api/party?room=${ROOM}`;
const outDir = "scripts/.verify-screens";
fs.mkdirSync(outDir, { recursive: true });

async function reset() {
  await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reset" }),
  });
}

await reset();

const browser = await chromium.launch();

// Two fully independent contexts == two separate browser sessions, each with
// its own sessionStorage, exactly like two real windows.
const purpleCtx = await browser.newContext({ viewport: { width: 900, height: 900 } });
const alexCtx = await browser.newContext({ viewport: { width: 900, height: 900 } });
const purple = await purpleCtx.newPage();
const alex = await alexCtx.newPage();

// Neither page here installs a WebMCP shim, so this run doubles as the check
// that a plain human browser session — where document.modelContext never
// arrives at all — stays completely silent. It caught the WebMCP readiness
// watcher rejecting on give-up, which produced one unhandled rejection per
// registered tool on every ordinary page load.
const errors = [];
for (const [label, p] of [["purple", purple], ["alex", alex]]) {
  p.on("pageerror", (e) => errors.push(`[${label}] ${e.message}`));
  p.on("console", (m) => { if (m.type() === "error") errors.push(`[${label}][console] ${m.text()}`); });
}

console.log("--- Purple opens the game page and clicks Play ---");
await purple.goto(`${BASE}/game/nightfall-signal?room=${ROOM}`, { waitUntil: "networkidle" });
await purple.getByRole("button", { name: "Play" }).click();
await purple.waitForURL(/\/party$/);
await purple.waitForSelector("text=Nightfall Signal");
await purple.screenshot({ path: `${outDir}/party-01-purple-created.png` });

console.log("--- Purple invites Alex ---");
await purple.getByRole("button", { name: "Invite Alex" }).click();
await purple.waitForSelector("text=Invited", { timeout: 5000 });
await purple.screenshot({ path: `${outDir}/party-02-purple-invited-alex.png` });

console.log("--- Alex switches identity and opens the Party page ---");
await alex.goto(`${BASE}/?room=${ROOM}`, { waitUntil: "networkidle" });
await alex.getByLabel("View as").selectOption({ label: "Alex" });
await alex.goto(`${BASE}/party?room=${ROOM}`, { waitUntil: "networkidle" });
await alex.waitForSelector("text=You've been invited");
await alex.screenshot({ path: `${outDir}/party-03-alex-sees-invite.png` });

console.log("--- Alex accepts ---");
await alex.getByRole("button", { name: "Accept" }).click();
await alex.waitForSelector("text=Accepted");
await alex.screenshot({ path: `${outDir}/party-04-alex-accepted.png` });

console.log("--- Purple's screen updates without a manual refresh (polling) ---");
await purple.waitForSelector("text=Accepted", { timeout: 5000 });
await purple.screenshot({ path: `${outDir}/party-05-purple-sees-accept.png` });

console.log("--- Purple launches (still needs Sam/Maya, so should stay disabled) ---");
const launchBtn = purple.getByRole("button", { name: "Launch" });
const disabledBeforeAll = await launchBtn.isDisabled();
console.log("Launch disabled with only Alex accepted:", disabledBeforeAll);

console.log("--- Purple invites Sam and Maya directly via API to complete the party ---");
await fetch(API, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "invite", friendIds: ["sam", "maya"] }),
});
await fetch(API, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "respond", userId: "sam", accept: true }),
});
await fetch(API, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "respond", userId: "maya", accept: true }),
});

await purple.reload({ waitUntil: "networkidle" });
await purple.waitForTimeout(1800); // let the poll pick up the change
const disabledAfterAll = await purple.getByRole("button", { name: "Launch" }).isDisabled();
console.log("Launch disabled once everyone accepted:", disabledAfterAll);
await purple.screenshot({ path: `${outDir}/party-06-ready-to-launch.png` });

console.log("--- Purple launches ---");
await purple.getByRole("button", { name: "Launch" }).click();
await purple.waitForSelector("text=SESSION READY", { timeout: 5000 });
await purple.screenshot({ path: `${outDir}/party-07-launched.png` });

console.log("\n--- rooms are isolated: a second visitor does not see this party ---");
// The point of rooms: before them every visitor to the live site shared one
// global party, so two people evaluating at once clobbered each other.
const OTHER_ROOM = "verify-party-other";
await fetch(`${BASE}/api/party?room=${OTHER_ROOM}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "reset" }),
});
const strangerCtx = await browser.newContext({ viewport: { width: 900, height: 900 } });
const stranger = await strangerCtx.newPage();
await stranger.goto(`${BASE}/party?room=${OTHER_ROOM}`, { waitUntil: "networkidle" });
await stranger.waitForSelector("text=No active party", { timeout: 5000 });
const strangerSeesNoParty = await stranger.getByText("No active party").isVisible();
// ...while the original room still holds its own launched session.
const ownRoom = await (await fetch(API)).json();
console.log("stranger sees no party:", strangerSeesNoParty, "| original room status:", ownRoom?.status);
await strangerCtx.close();

await browser.close();

console.log("\n--- assertions ---");
function assert(cond, msg) {
  console.log((cond ? "OK:   " : "FAIL: ") + msg);
  if (!cond) process.exitCode = 1;
}
assert(disabledBeforeAll === true, "Launch is disabled while Sam/Maya haven't responded");
assert(disabledAfterAll === false, "Launch becomes enabled once everyone has accepted");
assert(strangerSeesNoParty === true, "a visitor in another room sees no party, not this one");
assert(ownRoom?.status === "launched", "the original room still holds its own launched party");

console.log("\n--- page errors ---");
if (errors.length === 0) {
  console.log("none");
} else {
  errors.forEach((e) => console.log(e));
  process.exitCode = 1;
}

await reset();
