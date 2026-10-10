/**
 * Tiny scheduler for the VM (replaces Vercel Cron): calls /api/import at the given UTC times every day.
 *   APP_URL=http://app:3000  CRON_SECRET=...  IMPORT_TIMES="05:00,09:30"  node scripts/scheduler.mjs
 */
const APP_URL = process.env.APP_URL ?? "http://app:3000";
const SECRET = process.env.CRON_SECRET ?? "";
const TIMES = (process.env.IMPORT_TIMES ?? "05:00,09:30").split(",").map((t) => t.trim());
let lastRun = "";

async function runImport(reason) {
  try {
    const res = await fetch(`${APP_URL}/api/import?source=all`, { headers: { Authorization: `Bearer ${SECRET}` } });
    const body = await res.text();
    console.log(`[scheduler] ${reason}: ${res.status} ${body.slice(0, 300)}`);
  } catch (e) {
    console.log(`[scheduler] ${reason}: failed ${e.message}`);
  }
}

console.log(`[scheduler] import at ${TIMES.join(", ")} UTC → ${APP_URL}`);
setInterval(() => {
  const now = new Date();
  const hhmm = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
  const key = `${now.toISOString().slice(0, 10)} ${hhmm}`;
  if (TIMES.includes(hhmm) && lastRun !== key && now.getUTCDay() >= 1 && now.getUTCDay() <= 5) {
    lastRun = key;
    runImport(`scheduled ${key}`);
  }
}, 20_000);
