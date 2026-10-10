/**
 * Reset the demo state for the app date (DEMO_DATE or today): removes every committed decision for that date and
 * all feedback for that date and the day before (so the "how was yesterday" popup infers from scratch), then the seed restores the demo users' availability and swipes. Menus are kept.
 *   pnpm demo:reset
 */
import { PrismaClient } from "@prisma/client";
import { appDate, toIso } from "../src/lib/time";

const prisma = new PrismaClient();

async function main() {
  const date = appDate();
  const yesterday = new Date(date); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const [decisions, feedback] = await Promise.all([
    prisma.groupDecision.deleteMany({ where: { date } }).then(async (r) => { await prisma.groupVote.deleteMany({ where: { date } }); return r; }),
    prisma.feedback.deleteMany({ where: { date: { in: [date, yesterday] } } }),
  ]);
  console.log(`Reset ${toIso(date)} (+ yesterday's feedback): removed ${decisions.count} decisions and ${feedback.count} feedback rows.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
