import { mondayOf, zurichTodayString } from "@/lib/time";
import { importEth } from "./eth";
import { importFood2050 } from "./food2050";
import type { ImportResult } from "./types";

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
  return { ranAt: new Date().toISOString(), week, results };
}
