/**
 * ETH "cookpit" public JSON API importer. Spec: plans/3-menu-import.md §3.
 * All JSON keys are kebab-case. Verified live on 2026-10-10.
 */
import { Campus, MealTime, MenuSource } from "@prisma/client";
import { addDays, isoWeekday } from "@/lib/time";
import type { ImportResult, NormalizedDish, NormalizedMensa } from "./types";
import { userAgent } from "./types";
import { upsertNormalized } from "./upsert";

const BASE = "https://idapps.ethz.ch/cookpit-pub-services/v1";
const CLIENT = "client-id=ethz-wcms";
const PAGE = 50;

// --- raw API shapes (only the fields we read) ---
export type EthFacility = {
  "facility-id": number;
  "facility-name": string;
  "facility-url"?: string;
  "publication-type-code": number;
};
type EthPrice = { price: number; "customer-group-desc": string };
type EthCoded = { code: number; "desc-short": string; desc: string };
export type EthMeal = {
  "line-id"?: number;
  name: string;
  description?: string;
  "image-url"?: string | null;
  "meal-price-array"?: EthPrice[];
  "meal-class-array"?: EthCoded[];
  "allergen-array"?: EthCoded[];
  energy?: number | null; proteins?: number | null; fat?: number | null;
  carbohydrates?: number | null; sugar?: number | null; salt?: number | null;
};
type EthLine = { name: string; meal?: EthMeal | null };
type EthMealTime = { name: string; "time-from"?: string; "time-to"?: string; "line-array"?: EthLine[] | null };
type EthOpening = { "time-from"?: string; "time-to"?: string; "meal-time-array"?: EthMealTime[] | null };
type EthDay = { "day-of-week-code": number; "day-of-week-desc": string; "opening-hour-array"?: EthOpening[] | null };
export type EthRota = {
  "weekly-rota-id": number;
  "facility-id": number;
  "valid-from": string;
  "valid-to": string;
  "day-of-week-array": EthDay[];
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": userAgent(), Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw new Error(`ETH API ${res.status} for ${url}`);
  return (await res.json()) as T;
}

export async function fetchEthFacilities(lang = "en"): Promise<EthFacility[]> {
  const data = await getJson<{ "facility-array": EthFacility[] }>(`${BASE}/facilities?${CLIENT}&lang=${lang}&rs-first=0&rs-size=${PAGE}`);
  return data["facility-array"] ?? [];
}

/** All rotas valid after `validAfterIso` (pass the Monday of the target week). Pages until exhausted. */
export async function fetchEthRotas(validAfterIso: string, lang = "en"): Promise<EthRota[]> {
  const out: EthRota[] = [];
  for (let first = 0; ; first += PAGE) {
    const data = await getJson<{ "weekly-rota-array": EthRota[] }>(
      `${BASE}/weeklyrotas?${CLIENT}&lang=${lang}&rs-first=${first}&rs-size=${PAGE}&valid-after=${validAfterIso}`,
    );
    const page = data["weekly-rota-array"] ?? [];
    out.push(...page);
    if (page.length < PAGE) break;
    if (first > 20 * PAGE) break; // safety
  }
  return out;
}

export function campusFromUrl(url?: string): Campus {
  const u = (url ?? "").toLowerCase();
  if (u.includes("/zentrum/")) return Campus.ETH_ZENTRUM;
  if (u.includes("/hoenggerberg/")) return Campus.ETH_HOENGGERBERG;
  if (u.includes("/oerlikon/")) return Campus.ETH_OERLIKON;
  if (u.includes("/basel/")) return Campus.ETH_BASEL;
  return Campus.OTHER;
}

/** Facilities that publish menus → mensas. `mealTimes` (from rotas) decides lunch/dinner flags. */
export function mapEthFacilities(facilities: EthFacility[], mealTimes?: Map<number, Set<string>>): NormalizedMensa[] {
  return facilities
    .filter((f) => f["publication-type-code"] === 1)
    .map((f) => {
      const mt = mealTimes?.get(f["facility-id"]);
      return {
        source: MenuSource.ETH_COOKPIT,
        sourceId: String(f["facility-id"]),
        name: f["facility-name"],
        campus: campusFromUrl(f["facility-url"]),
        offersLunch: mt ? mt.has("Lunch") : true,
        offersDinner: mt ? mt.has("Dinner") : false,
        infoUrl: f["facility-url"],
      };
    });
}

function mealTimeOf(name: string): MealTime | null {
  const n = name.toLowerCase();
  if (n.includes("lunch") || n.includes("mittag")) return MealTime.LUNCH;
  if (n.includes("dinner") || n.includes("abend")) return MealTime.DINNER;
  return null;
}

function price(meal: EthMeal, group: string): number | undefined {
  const p = meal["meal-price-array"]?.find((x) => x["customer-group-desc"]?.toLowerCase() === group)?.price;
  return typeof p === "number" ? p : undefined;
}

const num = (v: number | null | undefined) => (typeof v === "number" ? v : undefined);

/**
 * Maps rotas to dishes for the week starting at `mondayIso`.
 * Also returns the meal-time names seen per facility (for lunch/dinner flags).
 */
export function mapEthRotas(rotas: EthRota[], mondayIso: string) {
  const dishes: NormalizedDish[] = [];
  const errors: string[] = [];
  const mealTimes = new Map<number, Set<string>>();
  const seen = new Set<string>();

  for (const rota of rotas) {
    const fid = rota["facility-id"];
    for (const day of rota["day-of-week-array"] ?? []) {
      const code = day["day-of-week-code"];
      if (!(code >= 1 && code <= 7)) continue;
      const date = addDays(mondayIso, code - 1);
      if (date < rota["valid-from"] || date > rota["valid-to"]) continue;
      if (isoWeekday(date) !== code) continue; // defensive

      for (const opening of day["opening-hour-array"] ?? []) {
        for (const mt of opening["meal-time-array"] ?? []) {
          if (!mealTimes.has(fid)) mealTimes.set(fid, new Set());
          mealTimes.get(fid)!.add(mt.name);
          const mealTime = mealTimeOf(mt.name);
          if (!mealTime) continue;

          for (const line of mt["line-array"] ?? []) {
            const meal = line.meal;
            if (!meal) continue;
            try {
              const classes = (meal["meal-class-array"] ?? []).map((c) => c["desc-short"]);
              const isVegan = classes.some((c) => c?.toLowerCase() === "vegan");
              const isVegetarian = isVegan || classes.some((c) => c?.toLowerCase() === "vegetarian");
              const allergenIds = (meal["allergen-array"] ?? [])
                .map((a) => Number.parseInt(a["desc-short"], 10))
                .filter((n) => Number.isInteger(n) && n >= 1 && n <= 14);
              const sourceKey = `${date}:${mealTime}:${meal["line-id"] ?? line.name}`;
              const dedupe = `${fid}|${sourceKey}`;
              if (seen.has(dedupe)) continue; // same facility appears in several rotas
              seen.add(dedupe);

              dishes.push({
                mensa: { source: MenuSource.ETH_COOKPIT, sourceId: String(fid) },
                date,
                mealTime,
                sourceKey,
                lineName: line.name,
                name: meal.name || line.name,
                description: meal.description || undefined,
                mealClass: classes[0] || undefined,
                isVegetarian,
                isVegan,
                priceStudent: price(meal, "students"),
                priceInternal: price(meal, "internal"),
                priceExternal: price(meal, "external"),
                imageUrl: meal["image-url"] ? `${meal["image-url"]}?client-id=ethz-wcms` : undefined,
                calories: meal.energy != null ? Math.round(meal.energy) : undefined,
                protein: num(meal.proteins), fat: num(meal.fat), carbs: num(meal.carbohydrates), sugar: num(meal.sugar), salt: num(meal.salt),
                allergenIds,
              });
            } catch (e) {
              errors.push(`facility ${fid} ${date} ${line.name}: ${(e as Error).message}`);
            }
          }
        }
      }
    }
  }
  return { dishes, errors, mealTimes };
}

/** Full ETH import for the week starting `mondayIso`. */
export async function importEth(mondayIso: string): Promise<ImportResult> {
  const [facilities, rotas] = await Promise.all([fetchEthFacilities(), fetchEthRotas(mondayIso)]);
  const { dishes, errors, mealTimes } = mapEthRotas(rotas, mondayIso);
  const mensas = mapEthFacilities(facilities, mealTimes);
  const known = new Set(mensas.map((m) => m.sourceId));
  const kept = dishes.filter((d) => known.has(d.mensa.sourceId));
  const res = await upsertNormalized(mensas, kept);
  return { source: MenuSource.ETH_COOKPIT, mensas: res.mensas, dishes: res.dishes, errors: [...errors, ...res.errors] };
}
