/**
 * Download + resize + cache dish photos for the current week (idempotent, skips cached ones).
 *   pnpm images:cache
 */
import { prisma } from "../src/lib/db";
import { cacheDishImages } from "../src/lib/images";
import { addDays, appDateString, dateOnly, mondayOf } from "../src/lib/time";

async function main() {
  const monday = mondayOf(appDateString());
  const dishes = await prisma.dish.findMany({ where: { date: { gte: dateOnly(monday), lte: dateOnly(addDays(monday, 6)) }, imageUrl: { not: null } }, select: { id: true } });
  const t = Date.now();
  const r = await cacheDishImages(dishes.map((d) => d.id));
  const size = await prisma.$queryRaw<{ kb: number }[]>`SELECT (sum(octet_length(thumb)) + sum(octet_length(medium)))/1024 AS kb FROM "DishImage"`;
  console.log(JSON.stringify({ week: monday, ...r, seconds: Math.round((Date.now() - t) / 1000), totalKb: Math.round(Number(size[0]?.kb ?? 0)) }));
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
