/**
 * UZH (ZFV) importer via food2050. STATUS: not implemented – see plans/3-menu-import.md §4.
 * The site's menus are fetched client-side from POST https://app.food2050.ch/api/v2/graphql
 * (Apollo, introspection disabled). Capture the weekly-menu query in browser DevTools, replay it here,
 * then map to NormalizedDish and call upsertNormalized(). Until then, prisma/seed.ts provides UZH dishes.
 */
import { MenuSource } from "@prisma/client";
import type { ImportResult } from "./types";

/** food2050 allergen externalId → EU code */
export function mapFood2050Allergen(externalId: string): number | null {
  const m: Record<string, number> = {
    cerealsContainingGluten: 1, wheat: 1, barley: 1, rye: 1,
    crustaceans: 2, eggs: 3, fish: 4, peanuts: 5, soybeans: 6, milk: 7,
    nuts: 8, walnut: 8, almond: 8, cashew: 8, pistachio: 8, hazel: 8, pecan: 8, brazilNut: 8, macadamia: 8, queenslandNut: 8,
    celery: 9, mustard: 10, sesame: 11, sulphites: 12, lupin: 13, molluscs: 14,
  };
  return m[externalId] ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function importFood2050(_mondayIso: string): Promise<ImportResult> {
  return { source: MenuSource.FOOD2050, mensas: 0, dishes: 0, errors: [], skipped: "not implemented – see plans/3-menu-import.md §4" };
}
