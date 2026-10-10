import { mondayOf, zurichTodayString } from "@/lib/time";
import { importEth } from "./eth";
import { importFood2050 } from "./food2050";
import type { ImportResult } from "./types";
import { refreshPopularity } from "@/lib/popularity";
import { cacheDishImages } from "@/lib/images";
import { prisma } from "@/lib/db";
import { addDays, dateOnly } from "@/lib/time";

export type ImportSource = "eth" | "food2050" | "all";

export async function runImport(source: ImportSource = "all", anyDayOfWeekIso?: string) {
  const week = mondayOf(anyDayOfWeekIso ?? zurichTodayString());
  const results: Record<string, ImportResult | { error: string }> = {};
  const jobs: [string, () => Promise<ImportResult>][] = [];
  if (source === "eth" || source === "all") jobs.push(["eth", () => importEth(week)]);
  if (source === "food2050" || source === "all") jobs.push(["food2050", () => importFood2050(week)]);
  for (const [name, job] of jobs) {
    try {
      results[name] = await job();
    } catch (e) {
      results[name] = { error: (e as Error).message };
    }
  }
  // photo cache for the imported week (never fails the import)
  let images: unknown = "skipped";
  try {
    const ids = await prisma.dish.findMany({ where: { date: { gte: dateOnly(week), lte: dateOnly(addDays(week, 6)) }, imageUrl: { not: null } }, select: { id: true } });
    images = await cacheDishImages(ids.map((d) => d.id));
  } catch (e) { images = { error: (e as Error).message }; }
  // popularity prediction for the imported week (never fails the import). Needs the local embedding model,
  // so it is off on serverless hosts: set POPULARITY_ON_IMPORT=false there and run `pnpm popularity` elsewhere.
  let popularity: unknown = "skipped";
  if (process.env.POPULARITY_ON_IMPORT !== "false") {
    try { popularity = await refreshPopularity(week); } catch (e) { popularity = { error: (e as Error).message }; }
  }
  return { ranAt: new Date().toISOString(), week, results, images, popularity };
}
