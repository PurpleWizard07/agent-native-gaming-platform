import { chromium } from "playwright";
import fs from "node:fs";

const outDir = "scripts/.verify-screens";
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`[console] ${msg.text()}`);
});
page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}`));

async function shot(name) {
  await page.screenshot({ path: `${outDir}/${name}.png` });
  console.log(`screenshot: ${name}.png`);
}

console.log("--- Home ---");
await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForSelector("text=Continue Playing");
await shot("01-home");

console.log("--- Store ---");
await page.goto("http://localhost:5173/store", { waitUntil: "networkidle" });
await page.waitForSelector("text=Store");
const beforeCount = await page.locator("text=/\\d+ games/").first().textContent();
console.log("count before filter:", beforeCount);
await page.getByRole("button", { name: "Co-op" }).click();
await page.waitForTimeout(200);
const afterCount = await page.locator("text=/\\d+ games/").first().textContent();
console.log("count after clicking 'Co-op' chip:", afterCount);
await shot("02-store-filtered");

console.log("--- Library ---");
await page.goto("http://localhost:5173/library", { waitUntil: "networkidle" });
await page.waitForSelector("text=Library");
await shot("03-library");

console.log("--- Friends ---");
await page.goto("http://localhost:5173/friends", { waitUntil: "networkidle" });
await page.waitForSelector("text=Friends");
await shot("04-friends");

console.log("--- Game detail (Nightfall Signal) ---");
await page.goto("http://localhost:5173/game/nightfall-signal", { waitUntil: "networkidle" });
await page.waitForSelector("text=Nightfall Signal");
await shot("05-game-nightfall-signal");

console.log("--- Game detail (404 case) ---");
await page.goto("http://localhost:5173/game/does-not-exist", { waitUntil: "networkidle" });
await shot("06-game-not-found");

await browser.close();

console.log("\n--- console/page errors ---");
if (errors.length === 0) {
  console.log("none");
} else {
  errors.forEach((e) => console.log(e));
  process.exitCode = 1;
}
