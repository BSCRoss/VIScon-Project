/**
 * Build the popularity index and predict the current week.
 *   pnpm popularity            (uses DEMO_DATE / today; Qdrant at QDRANT_URL if running, else in-memory fallback)
 *   pnpm popularity explain <dishId>
 */
import { refreshPopularity, explain } from "../src/lib/popularity";
import { appDateString } from "../src/lib/time";
import { prisma } from "../src/lib/db";

async function main() {
  if (process.argv[2] === "explain" && process.argv[3]) {
    const dish = await prisma.dish.findUnique({ where: { id: process.argv[3] }, select: { name: true, predictedScore: true, predictedN: true } });
    console.log(dish);
    for (const n of await explain(process.argv[3])) console.log(`  ${n.similarity.toFixed(2)}  score ${n.score.toFixed(2)} (n=${n.n})  ${n.name}`);
    return;
  }
  const r = await refreshPopularity(appDateString());
  console.log(JSON.stringify(r));
  const top = await prisma.dish.findMany({ where: { predictedScore: { not: null }, date: new Date(appDateString()) }, orderBy: { predictedScore: "desc" }, take: 5, select: { name: true, predictedScore: true, predictedN: true, mensa: { select: { name: true } } } });
  for (const d of top) console.log(`  ${d.predictedScore!.toFixed(2)} (n=${d.predictedN})  ${d.name} @ ${d.mensa.name}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
