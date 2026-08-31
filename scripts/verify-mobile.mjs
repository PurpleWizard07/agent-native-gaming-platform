import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(e.message));

await page.goto("http://localhost:5173/store", { waitUntil: "networkidle" });
await page.waitForSelector("text=Store");
await page.screenshot({ path: "scripts/.verify-screens/mobile-store.png" });

await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForSelector("text=Good evening");
await page.screenshot({ path: "scripts/.verify-screens/mobile-home.png" });

await browser.close();
console.log(errors.length === 0 ? "no errors" : errors.join("\n"));
