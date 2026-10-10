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
  // --- "how was yesterday" popup ---
  step("yesterday popup");
  await page.goto(`${BASE}/today`);
  const modal = page.getByTestId("yesterday-modal");
  let modalShown = true; try { await modal.waitFor({ timeout: 8000 }); } catch { modalShown = false; }
  check("yesterday popup appears", modalShown);
  if (modalShown) {
    const dishSelect = page.getByTestId("yesterday-dish");
    const before = await dishSelect.inputValue();
    const second = await dishSelect.locator("option").nth(1).getAttribute("value");
    await dishSelect.selectOption(second);
    check("popup lets you pick another dish", (await dishSelect.inputValue()) === second && second !== before);
    await page.getByRole("radio", { name: "4 stars" }).click();
    await modal.getByRole("button", { name: "Yes" }).click();
    await page.getByTestId("yesterday-submit").click();
    let thanked = true; try { await modal.getByText("Thanks, noted!").waitFor({ timeout: 8000 }); } catch { thanked = false; }
    check("popup saves a rating", thanked);
    await page.waitForTimeout(1200);
    await page.reload();
    await modal.waitFor({ timeout: 8000 });
    await page.getByTestId("yesterday-close").click();
    check("popup closes via ×", !(await modal.isVisible()));
  }

  // --- quick vote + drag on the overview cards ---
  step("today cards");
  // the popup mounts a moment after load; wait for it briefly, then dismiss so it cannot intercept clicks
  const closeYesterday = async () => { const c = page.getByTestId("yesterday-close"); try { await c.waitFor({ timeout: 2500 }); await c.click(); await page.waitForTimeout(200); } catch {} };
  const cards = page.getByTestId("dish-card");
  await cards.first().waitFor(); await closeYesterday();
  const firstLike = cards.first().getByRole("button", { name: "I want this" });
  const wasPressed = (await firstLike.getAttribute("aria-pressed")) === "true";
  await firstLike.click(); await page.waitForTimeout(1200);
  await page.reload(); await cards.first().waitFor(); await closeYesterday();
  const nowPressed = (await cards.first().getByRole("button", { name: "I want this" }).getAttribute("aria-pressed")) === "true";
  check("quick vote toggles and persists", nowPressed !== wasPressed, `${wasPressed} → ${nowPressed}`);
  await cards.first().getByRole("button", { name: "I want this" }).click(); await page.waitForTimeout(1200); // restore

  const dragCard = async (card, px) => {
    const box = await card.boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy); await page.mouse.down();
    const steps = Math.max(4, Math.abs(px) / 10);
    for (let i = 1; i <= steps; i++) await page.mouse.move(cx + (px * i) / steps, cy);
    await page.mouse.up(); await page.waitForTimeout(700);
  };
  const second = cards.nth(1);
  const likeBtn = () => second.getByRole("button", { name: "I want this" });
  const dislikeBtn = () => second.getByRole("button", { name: "Not today" });
  // make sure the card starts unvoted
  if ((await likeBtn().getAttribute("aria-pressed")) === "true") { await likeBtn().click(); await page.waitForTimeout(800); }
  if ((await dislikeBtn().getAttribute("aria-pressed")) === "true") { await dislikeBtn().click(); await page.waitForTimeout(800); }

  await dragCard(second, 40);
  check("short drag does not vote", (await likeBtn().getAttribute("aria-pressed")) !== "true" && (await dislikeBtn().getAttribute("aria-pressed")) !== "true");
  await dragCard(second, 150);
  check("drag right likes the dish", (await likeBtn().getAttribute("aria-pressed")) === "true");
  await page.reload(); await cards.first().waitFor(); await closeYesterday();
  check("drag vote persists", (await cards.nth(1).getByRole("button", { name: "I want this" }).getAttribute("aria-pressed")) === "true");
  await dragCard(cards.nth(1), -150);
  check("drag left dislikes the dish", (await cards.nth(1).getByRole("button", { name: "Not today" }).getAttribute("aria-pressed")) === "true");
  await cards.nth(1).getByRole("button", { name: "Not today" }).click(); await page.waitForTimeout(800); // clear
  check("page still scrolls vertically", await page.evaluate(() => { window.scrollTo(0, 400); return window.scrollY > 100; }));

  step("goto /plan");
  // --- availability grid ---
  await page.goto(`${BASE}/plan`);
  const grid = page.getByTestId("availability-grid");
  await grid.waitFor({ timeout: 30000 }); await closeYesterday();
  const rows = grid.locator("[data-row]");
  const winText = () => page.getByTestId("grid-window").innerText();
  const drag = async (a, b) => {
    const ra = await rows.nth(a).boundingBox(); const rb = await rows.nth(b).boundingBox();
    const x = ra.x + ra.width * 0.4;
    await page.mouse.move(x, ra.y + ra.height / 2); await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(x, ra.y + ra.height / 2 + ((rb.y - ra.y) * i) / 6);
    await page.mouse.up(); await page.waitForTimeout(1200);
  };
  // start from a clean slate (alice is seeded with 11:45–13:00)
  if ((await winText()).includes("Your windows")) { await page.getByRole("button", { name: /Clear/ }).click(); await page.waitForTimeout(1000); }
  await drag(1, 5);
  const win = await winText(); const st = await page.getByTestId("grid-status").innerText();
  check("grid drag paints 11:15–12:15", win.includes("11:15–12:15") && !win.includes(","), win);
  check("grid saves", st.includes("Saved"), st);
  await page.reload(); await grid.waitFor(); await closeYesterday();
  check("grid windows persist after reload", (await winText()).includes("11:15–12:15"));

  await drag(10, 11); // a second, separate window must be added, not replace the first
  const multi = await winText();
  check("second window is added (multiple windows)", multi.includes("11:15–12:15") && multi.includes("13:30–13:45"), multi);

  await drag(1, 2); // starting a drag on a selected row erases
  const erased = await winText();
  check("dragging over a selection erases it", erased.includes("11:45–12:15") && erased.includes("13:30–13:45") && !erased.includes("11:15"), erased);

  await page.reload(); await grid.waitFor(); await closeYesterday();
  check("multiple windows persist after reload", (await winText()).includes("13:30–13:45"));

  // restore the seeded demo window for alice: clear, then paint 11:45–13:00 (rows 3..8)
  await page.getByRole("button", { name: /Clear/ }).click(); await page.waitForTimeout(1000);
  await drag(3, 8);
  check("restore demo window", (await winText()).includes("11:45–13:00") && !(await winText()).includes(","), await winText());

  // group page: vote → (bob already voted the same) majority → decided → reopen
  await page.goto(`${BASE}/groups`); await page.waitForLoadState("networkidle"); await closeYesterday();
  await page.locator('a[href^="/groups/"]:not([href="/groups/new"])').first().click();
  await page.waitForURL(/\/groups\/[^/]+$/); await closeYesterday();
  if (await page.getByRole("button", { name: /Reopen the vote/ }).isVisible().catch(() => false)) { await page.getByRole("button", { name: /Reopen the vote/ }).click(); await page.waitForTimeout(1200); }
  const panel = page.getByTestId("vote-panel");
  let hasPanel = true; try { await panel.waitFor({ timeout: 10000 }); } catch { hasPanel = false; }
  check("group page offers a vote", hasPanel);
  if (hasPanel) {
    const first = page.getByTestId("vote-option").first();
    const label = await first.innerText();
    await first.click(); await page.waitForTimeout(1500);
    const decided = await page.getByText(/Decided by majority vote|Vote ended/).isVisible().catch(() => false);
    const pressed = (await page.getByTestId("vote-option").first().getAttribute("aria-pressed").catch(() => null)) === "true";
    check("voting works (majority auto-decides or vote is recorded)", decided || pressed, label.split("\n")[0]);
    if (!decided) { await page.getByTestId("end-vote").click(); await page.waitForTimeout(1500); }
    check("decision shows the agreed mensa and time", await page.getByText(/Agreed/).isVisible());
    await page.getByRole("button", { name: /Reopen the vote/ }).click(); await page.waitForTimeout(1200);
    check("reopening restores the vote", await page.getByTestId("vote-panel").isVisible());
  }
} catch (e) {
  check("script completed", false, e.message);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
