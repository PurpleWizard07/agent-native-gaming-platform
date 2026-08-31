// The test that matters most: two independent browser sessions (Purple and
// Alex) exchanging a REAL invite through the deployed party service, not a
// mocked/timed fake. See implementation-plan.md Phase 3.
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:8888";
const outDir = "scripts/.verify-screens";
fs.mkdirSync(outDir, { recursive: true });

async function reset() {
  await fetch(`${BASE}/api/party`, {
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

const errors = [];
for (const [label, p] of [["purple", purple], ["alex", alex]]) {
  p.on("pageerror", (e) => errors.push(`[${label}] ${e.message}`));
  p.on("console", (m) => { if (m.type() === "error") errors.push(`[${label}][console] ${m.text()}`); });
}

console.log("--- Purple opens the game page and clicks Play ---");
await purple.goto(`${BASE}/game/nightfall-signal`, { waitUntil: "networkidle" });
await purple.getByRole("button", { name: "Play" }).click();
await purple.waitForURL(/\/party$/);
await purple.waitForSelector("text=Nightfall Signal");
await purple.screenshot({ path: `${outDir}/party-01-purple-created.png` });

console.log("--- Purple invites Alex ---");
await purple.getByRole("button", { name: "Invite Alex" }).click();
await purple.waitForSelector("text=Invited", { timeout: 5000 });
await purple.screenshot({ path: `${outDir}/party-02-purple-invited-alex.png` });

console.log("--- Alex switches identity and opens the Party page ---");
await alex.goto(`${BASE}/`, { waitUntil: "networkidle" });
await alex.getByLabel("View as").selectOption({ label: "Alex" });
await alex.goto(`${BASE}/party`, { waitUntil: "networkidle" });
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
await fetch(`${BASE}/api/party`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "invite", friendIds: ["sam", "maya"] }),
});
await fetch(`${BASE}/api/party`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "respond", userId: "sam", accept: true }),
});
await fetch(`${BASE}/api/party`, {
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

await browser.close();

console.log("\n--- assertions ---");
function assert(cond, msg) {
  console.log((cond ? "OK:   " : "FAIL: ") + msg);
  if (!cond) process.exitCode = 1;
}
assert(disabledBeforeAll === true, "Launch is disabled while Sam/Maya haven't responded");
assert(disabledAfterAll === false, "Launch becomes enabled once everyone has accepted");

console.log("\n--- page errors ---");
if (errors.length === 0) {
  console.log("none");
} else {
  errors.forEach((e) => console.log(e));
  process.exitCode = 1;
}

await reset();
