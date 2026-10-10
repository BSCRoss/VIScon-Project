/**
 * Browser smoke test with Playwright + the locally installed Chrome (no browser download).
 *   pnpm e2e                         (needs `pnpm dev` running on http://127.0.0.1:3001)
 *   BASE_URL=http://host:port pnpm e2e
 * Logs in as alice, exercises the swipe deck (partial drag must NOT swipe, full drag must advance by exactly one)
 * and the availability grid (press-and-slide must select and persist a window).
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3001";
const results = [];
const check = (name, ok, info = "") => { results.push({ name, ok, info }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? `  (${info})` : ""}`); };

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.setDefaultTimeout(15000);
const step = (m) => console.log("step:", m);
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));

try {
  // --- login ---
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="username"]', "alice");
  await page.fill('input[name="password"]', "password123");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(today|onboarding)/, { timeout: 30000 });
  check("login", page.url().includes("/today"), page.url());

  // --- swipe deck ---
  step("goto /swipe");
  await page.goto(`${BASE}/swipe`);
  const card = page.getByTestId("swipe-card");
  await card.waitFor({ timeout: 30000 });
  const title = () => card.locator("h3").first().innerText();
  const nextTitle = () => page.locator('[aria-hidden="true"] h3').first().innerText();
  const leftCount = async () => Number((await page.getByText(/\d+ left/).first().innerText()).match(/(\d+) left/)[1]);

  step("read deck state");
  const t0 = await title(); const n0 = await nextTitle(); const c0 = await leftCount();
  const box = await card.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;

  step("partial drag");
  // partial drag: 40px → must snap back, same card
  await page.mouse.move(cx, cy); await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(cx + i * 5, cy);
  await page.mouse.up(); await page.waitForTimeout(400);
  check("partial swipe keeps the card", (await title()) === t0 && (await leftCount()) === c0, `${t0}`);

  step("full drag");
  // full drag right: 160px → advances by exactly one (next card becomes current)
  await page.mouse.move(cx, cy); await page.mouse.down();
  for (let i = 1; i <= 16; i++) await page.mouse.move(cx + i * 10, cy);
  await page.mouse.up(); await page.waitForTimeout(1200);
  const t1 = await title(); const c1 = await leftCount();
  check("full swipe advances by exactly one", t1 === n0 && c1 === c0 - 1, `expected "${n0}", got "${t1}"; left ${c0}→${c1}`);

  // button swipe also advances by one (after server refresh)
  const n1 = await nextTitle(); const tb = await title();
  await page.getByRole("button", { name: "Not today" }).click(); await page.waitForTimeout(1200);
  check("button swipe advances by exactly one", (await title()) === n1 && (await leftCount()) === c0 - 2);

  // undo brings the last card back
  await page.getByRole("button", { name: /^Undo$/ }).click(); await page.waitForTimeout(1200);
  check("undo restores the previous card", (await title()) === tb && (await leftCount()) === c0 - 1, `title "${await title()}" vs "${tb}"`);

  step("goto /plan");
  // --- availability grid ---
  await page.goto(`${BASE}/plan`);
  const grid = page.getByTestId("availability-grid");
  await grid.waitFor({ timeout: 30000 });
  const rows = grid.locator("[data-row]");
  const r1 = await rows.nth(1).boundingBox(); const r5 = await rows.nth(5).boundingBox();
  const x = r1.x + r1.width * 0.4;
  await page.mouse.move(x, r1.y + r1.height / 2); await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x, r1.y + r1.height / 2 + ((r5.y - r1.y) * i) / 8);
  await page.mouse.up();
  await page.waitForTimeout(1500);
  const win = await page.getByTestId("grid-window").innerText();
  const st = await page.getByTestId("grid-status").innerText();
  check("grid drag selects 11:15 – 12:15", win.includes("11:15 – 12:15"), win);
  check("grid saves", st.includes("Saved"), st);
  await page.reload(); await grid.waitFor();
  check("grid window persists after reload", (await page.getByTestId("grid-window").innerText()).includes("11:15 – 12:15"));

  // restore the seeded demo window for alice (11:45 – 13:00 = rows 3..8)
  const r3 = await rows.nth(3).boundingBox(); const r8 = await rows.nth(8).boundingBox();
  await page.mouse.move(x, r3.y + r3.height / 2); await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x, r3.y + r3.height / 2 + ((r8.y - r3.y) * i) / 8);
  await page.mouse.up(); await page.waitForTimeout(1200);
  check("restore demo window", (await page.getByTestId("grid-window").innerText()).includes("11:45 – 13:00"));

  // group page shows the consensus + commit form
  await page.goto(`${BASE}/groups`);
  await page.locator('a[href^="/groups/"]:not([href="/groups/new"])').first().click();
  await page.waitForURL(/\/groups\/[^/]+$/);
  const commitBtn = page.getByRole("button", { name: /Commit for the group/ });
  let commitVisible = true; try { await commitBtn.waitFor({ state: "visible", timeout: 10000 }); } catch { commitVisible = false; }
  check("group page offers commit", commitVisible, commitVisible ? "" : (await page.locator("main").innerText()).slice(0, 300).replace(/\n+/g, " | "));
} catch (e) {
  check("script completed", false, e.message);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
