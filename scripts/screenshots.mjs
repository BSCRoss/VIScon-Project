import { chromium } from "playwright";
/** Phone-size screenshots of every screen: node scripts/screenshots.mjs <outDir>  (needs `pnpm dev`) */
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001"; const OUT = process.argv[2] ?? "screenshots";
import { mkdirSync } from "node:fs"; mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage(); page.setDefaultTimeout(20000);
const failed = []; page.on("response", (r) => { if (r.request().resourceType() === "image" && r.status() >= 400) failed.push(`${r.status()} ${r.url().slice(0, 90)}`); });
page.on("console", (m) => { if (m.type() === "error") console.log("console error:", m.text().slice(0, 160)); });
await page.goto(`${BASE}/login`); await page.screenshot({ path: `${OUT}/login.png` });
await page.fill('input[name="username"]', "alice"); await page.fill('input[name="password"]', "password123"); await page.click('button[type="submit"]');
await page.waitForURL(/\/today/);
for (const [name, path] of [["today", "/today"], ["swipe", "/swipe"], ["plan", "/plan"], ["groups", "/groups"], ["settings", "/settings"], ["onboarding", "/onboarding"]]) {
  await page.goto(`${BASE}${path}`); await page.waitForLoadState("networkidle"); await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: name === "today" || name === "onboarding" });
}
await page.goto(`${BASE}/groups`); await page.locator('a[href^="/groups/"]:not([href="/groups/new"])').first().click(); await page.waitForURL(/\/groups\/[^/]+$/); await page.waitForLoadState("networkidle");
await page.screenshot({ path: `${OUT}/group.png`, fullPage: true });
await page.goto(`${BASE}/today`); await page.waitForLoadState("networkidle");
const imgs2 = await page.evaluate(() => [...document.images].map((i) => ({ src: i.currentSrc.slice(0, 80), ok: i.complete && i.naturalWidth > 0 })));
console.log("today images:", imgs2.length, "loaded:", imgs2.filter((i) => i.ok).length); console.log(imgs2.slice(0, 3));
console.log("failed image responses:", failed.slice(0, 5));
await browser.close();
