import type { Campus, MealTime, MenuSource } from "@prisma/client";

export type NormalizedMensa = {
  source: MenuSource;
  sourceId: string;
  name: string;
  campus: Campus;
  offersLunch: boolean;
  offersDinner: boolean;
  infoUrl?: string;
};

export type NormalizedDish = {
  mensa: { source: MenuSource; sourceId: string };
  /** "YYYY-MM-DD" in Europe/Zurich */
  date: string;
  mealTime: MealTime;
  /** stable within the mensa; drives upsert */
  sourceKey: string;
  lineName?: string;
  name: string;
  description?: string;
  mealClass?: string;
  isVegetarian?: boolean;
  isVegan?: boolean;
  priceStudent?: number;
  priceInternal?: number;
  priceExternal?: number;
  imageUrl?: string;
  calories?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  sugar?: number;
  salt?: number;
  /** EU codes 1..14 */
  allergenIds: number[];
};

export type ImportResult = {
  source: MenuSource;
  mensas: number;
  dishes: number;
  errors: string[];
  skipped?: string;
};

export function userAgent(): string {
  return process.env.IMPORT_USER_AGENT ?? "greyGiraffe/0.1 (hackathon)";
}
