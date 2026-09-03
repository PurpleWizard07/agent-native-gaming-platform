// The test that matters most: two independent browser sessions (Alex and
// Justin) exchanging a REAL invite through the deployed party service, not a
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
const alex = await purpleCtx.newPage();
const justin = await alexCtx.newPage();

// Neither page here installs a WebMCP shim, so this run doubles as the check
// that a plain human browser session — where document.modelContext never
// arrives at all — stays completely silent. It caught the WebMCP readiness
// watcher rejecting on give-up, which produced one unhandled rejection per
// registered tool on every ordinary page load.
const errors = [];
for (const [label, p] of [["alex", alex], ["justin", justin]]) {
  p.on("pageerror", (e) => errors.push(`[${label}] ${e.message}`));
  p.on("console", (m) => { if (m.type() === "error") errors.push(`[${label}][console] ${m.text()}`); });
}

console.log("--- Alex opens the game page and clicks Play ---");
await alex.goto(`${BASE}/game/nightfall-signal?room=${ROOM}`, { waitUntil: "networkidle" });
await alex.getByRole("button", { name: "Play" }).click();
await alex.waitForURL(/\/party$/);
await alex.waitForSelector("text=Nightfall Signal");
await alex.screenshot({ path: `${outDir}/party-01-alex-created.png` });

console.log("--- Alex invites Justin ---");
await alex.getByRole("button", { name: "Invite Justin" }).click();
await alex.waitForSelector("text=Invited", { timeout: 5000 });
await alex.screenshot({ path: `${outDir}/party-02-alex-invited-justin.png` });

console.log("--- Justin switches identity and opens the Party page ---");
await justin.goto(`${BASE}/?room=${ROOM}`, { waitUntil: "networkidle" });
await justin.getByLabel("View as").selectOption({ label: "Justin" });
await justin.goto(`${BASE}/party?room=${ROOM}`, { waitUntil: "networkidle" });
await justin.waitForSelector("text=You've been invited");
await justin.screenshot({ path: `${outDir}/party-03-justin-sees-invite.png` });

console.log("--- Justin accepts ---");
await justin.getByRole("button", { name: "Accept" }).click();
await justin.waitForSelector("text=Accepted");
await justin.screenshot({ path: `${outDir}/party-04-justin-accepted.png` });

console.log("--- Alex's screen updates without a manual refresh (polling) ---");
await alex.waitForSelector("text=Accepted", { timeout: 5000 });
await alex.screenshot({ path: `${outDir}/party-05-alex-sees-accept.png` });

console.log("--- Alex launches (still needs Robert/Sarah, so should stay disabled) ---");
const launchBtn = alex.getByRole("button", { name: "Launch" });
const disabledBeforeAll = await launchBtn.isDisabled();
console.log("Launch disabled with only Justin accepted:", disabledBeforeAll);

console.log("--- Alex invites Robert and Sarah directly via API to complete the party ---");
await fetch(API, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "invite", friendIds: ["robert", "sarah"] }),
});
await fetch(API, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "respond", userId: "robert", accept: true }),
});
await fetch(API, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "respond", userId: "sarah", accept: true }),
});

await alex.reload({ waitUntil: "networkidle" });
await alex.waitForTimeout(1800); // let the poll pick up the change
const disabledAfterAll = await alex.getByRole("button", { name: "Launch" }).isDisabled();
console.log("Launch disabled once everyone accepted:", disabledAfterAll);
await alex.screenshot({ path: `${outDir}/party-06-ready-to-launch.png` });

console.log("--- Alex launches ---");
await alex.getByRole("button", { name: "Launch" }).click();
await alex.waitForSelector("text=SESSION READY", { timeout: 5000 });
await alex.screenshot({ path: `${outDir}/party-07-launched.png` });

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
assert(disabledBeforeAll === true, "Launch is disabled while Robert/Sarah haven't responded");
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
