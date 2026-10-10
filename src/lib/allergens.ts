import { prisma } from "@/lib/db";

/** EU allergen codes used by ETH (desc-short) and food2050 (mapped). Fixed 14 rows. */
export const ALLERGENS: { id: number; nameEn: string; nameDe: string }[] = [
  { id: 1, nameEn: "Cereals containing gluten", nameDe: "Glutenhaltiges Getreide" },
  { id: 2, nameEn: "Crustaceans", nameDe: "Krebstiere" },
  { id: 3, nameEn: "Eggs", nameDe: "Eier" },
  { id: 4, nameEn: "Fish", nameDe: "Fisch" },
  { id: 5, nameEn: "Peanuts", nameDe: "Erdnüsse" },
  { id: 6, nameEn: "Soya", nameDe: "Soja" },
  { id: 7, nameEn: "Milk", nameDe: "Milch" },
  { id: 8, nameEn: "Nuts", nameDe: "Hartschalenobst (Nüsse)" },
  { id: 9, nameEn: "Celery", nameDe: "Sellerie" },
  { id: 10, nameEn: "Mustard", nameDe: "Senf" },
  { id: 11, nameEn: "Sesame", nameDe: "Sesam" },
  { id: 12, nameEn: "Sulphur dioxide and sulphites", nameDe: "Schwefeldioxid und Sulfite" },
  { id: 13, nameEn: "Lupines", nameDe: "Lupine" },
  { id: 14, nameEn: "Molluscs", nameDe: "Weichtiere" },
];

/** Idempotent: the importer calls this so dish→allergen links never hit a missing row on a fresh database. */
export async function ensureAllergens(): Promise<void> {
  const n = await prisma.allergen.count();
  if (n >= ALLERGENS.length) return;
  for (const a of ALLERGENS) await prisma.allergen.upsert({ where: { id: a.id }, update: a, create: a });
}
