import { prisma } from "@/lib/db";
import { dateOnly } from "@/lib/time";
import type { NormalizedDish, NormalizedMensa } from "./types";
import { ensureAllergens } from "@/lib/allergens";

/** Upserts mensas on (source, sourceId) and dishes on (mensaId, sourceKey); replaces dish allergens. */
export async function upsertNormalized(mensas: NormalizedMensa[], dishes: NormalizedDish[]) {
  const errors: string[] = [];
  await ensureAllergens();

  for (const m of mensas) {
    await prisma.mensa.upsert({
      where: { source_sourceId: { source: m.source, sourceId: m.sourceId } },
      update: { name: m.name, campus: m.campus, offersLunch: m.offersLunch, offersDinner: m.offersDinner, infoUrl: m.infoUrl },
      create: m,
    });
  }

  const sources = [...new Set(dishes.map((d) => d.mensa.source))];
  const mensaRows = await prisma.mensa.findMany({ where: { source: { in: sources } }, select: { id: true, source: true, sourceId: true } });
  const mensaId = new Map(mensaRows.map((r) => [`${r.source}:${r.sourceId}`, r.id]));

  let written = 0;
  const CHUNK = 10;
  for (let i = 0; i < dishes.length; i += CHUNK) {
    await Promise.all(
      dishes.slice(i, i + CHUNK).map(async (d) => {
        const mid = mensaId.get(`${d.mensa.source}:${d.mensa.sourceId}`);
        if (!mid) {
          errors.push(`no mensa for ${d.mensa.source}:${d.mensa.sourceId} (dish ${d.sourceKey})`);
          return;
        }
        try {
          const data = {
            date: dateOnly(d.date), mealTime: d.mealTime, lineName: d.lineName, name: d.name, description: d.description,
            mealClass: d.mealClass, isVegetarian: d.isVegetarian, isVegan: d.isVegan,
            priceStudent: d.priceStudent, priceInternal: d.priceInternal, priceExternal: d.priceExternal,
            imageUrl: d.imageUrl, calories: d.calories, protein: d.protein, fat: d.fat, carbs: d.carbs, sugar: d.sugar, salt: d.salt,
            importedAt: new Date(),
          };
          const row = await prisma.dish.upsert({
            where: { mensaId_sourceKey: { mensaId: mid, sourceKey: d.sourceKey } },
            update: data,
            create: { ...data, mensaId: mid, sourceKey: d.sourceKey },
            select: { id: true },
          });
          const ids = [...new Set(d.allergenIds.filter((n) => n >= 1 && n <= 14))];
          await prisma.$transaction([
            prisma.dishAllergen.deleteMany({ where: { dishId: row.id, allergenId: { notIn: ids } } }),
            prisma.dishAllergen.createMany({ data: ids.map((allergenId) => ({ dishId: row.id, allergenId })), skipDuplicates: true }),
          ]);
          written++;
        } catch (e) {
          errors.push(`${d.mensa.sourceId}/${d.sourceKey}: ${(e as Error).message}`);
        }
      }),
    );
  }
  return { mensas: mensas.length, dishes: written, errors };
}
