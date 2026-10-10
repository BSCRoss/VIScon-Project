/**
 * Seed: allergens (fixed), a few mensas, demo users + group, and fake UZH dishes for *today*
 * so the app has content before the ETH import has run. Idempotent.
 * Run: pnpm db:seed   (uses DATABASE_URL)
 */
import { PrismaClient, Campus, MenuSource, MealTime } from "@prisma/client";
import bcrypt from "bcryptjs";
import { zurichToday } from "../src/lib/time";

const prisma = new PrismaClient();

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

const MENSAS = [
  { source: MenuSource.ETH_COOKPIT, sourceId: "9", name: "Mensa Polyterrasse", campus: Campus.ETH_ZENTRUM, infoUrl: "https://ethz.ch/en/campus/getting-to-know/cafes-restaurants-shops/gastronomy/restaurants-and-cafeterias/zentrum/mensa-polyterrasse.html" },
  { source: MenuSource.ETH_COOKPIT, sourceId: "3", name: "Clausiusbar", campus: Campus.ETH_ZENTRUM, infoUrl: "https://ethz.ch/en/campus/getting-to-know/cafes-restaurants-shops/gastronomy/restaurants-and-cafeterias/zentrum/clausiusbar.html" },
  { source: MenuSource.FOOD2050, sourceId: "uzh-zentrum/untere-mensa/mittag", name: "UZH Zentrum Lower Mensa", campus: Campus.UZH_ZENTRUM, infoUrl: "https://app.food2050.ch/de/zfv/uzh-zentrum/untere-mensa/menu/weekly" },
  { source: MenuSource.FOOD2050, sourceId: "uzh-zentrum/obere-mensa/mittag", name: "UZH Zentrum Upper Mensa", campus: Campus.UZH_ZENTRUM, infoUrl: "https://app.food2050.ch/de/zfv/uzh-zentrum/obere-mensa/menu/weekly" },
];

// Fallback UZH dishes (plans/3-menu-import.md §4). Realistic names, German like the source.
const FAKE_UZH_DISHES: Record<string, { lineName: string; name: string; description: string; price: number; veg?: boolean; vegan?: boolean; allergens: number[] }[]> = {
  "uzh-zentrum/untere-mensa/mittag": [
    { lineName: "Menü 1", name: "Schweinsgeschnetzeltes Zürcher Art", description: "mit Rösti und Saisongemüse", price: 7.2, allergens: [1, 7] },
    { lineName: "Menü 2", name: "Gemüse-Lasagne", description: "mit Blattsalat", price: 6.6, veg: true, allergens: [1, 3, 7] },
    { lineName: "Vegan", name: "Linsen-Dal", description: "mit Basmatireis und Mango-Chutney", price: 6.6, veg: true, vegan: true, allergens: [] },
    { lineName: "Pasta", name: "Penne all'arrabbiata", description: "mit Parmesan", price: 6.0, veg: true, allergens: [1, 7] },
    { lineName: "Salat", name: "Grosser Salatteller", description: "mit Kernen und Brot", price: 5.9, veg: true, vegan: true, allergens: [1] },
  ],
  "uzh-zentrum/obere-mensa/mittag": [
    { lineName: "Menü 1", name: "Pouletbrust mit Zitronensauce", description: "mit Couscous und Ratatouille", price: 7.2, allergens: [1, 7] },
    { lineName: "Menü 2", name: "Kürbis-Risotto", description: "mit gerösteten Kürbiskernen", price: 6.6, veg: true, allergens: [7] },
    { lineName: "Vegan", name: "Tofu-Curry", description: "mit Jasminreis", price: 6.6, veg: true, vegan: true, allergens: [6] },
    { lineName: "Wok", name: "Rindfleisch-Wok", description: "mit Nudeln und Gemüse", price: 7.9, allergens: [1, 6, 11] },
    { lineName: "Suppe", name: "Tomatensuppe", description: "mit Brot", price: 4.5, veg: true, vegan: true, allergens: [1] },
  ],
};

async function main() {
  const today = zurichToday();

  for (const a of ALLERGENS) {
    await prisma.allergen.upsert({ where: { id: a.id }, update: a, create: a });
  }

  const mensaIds: Record<string, string> = {};
  for (const m of MENSAS) {
    const row = await prisma.mensa.upsert({
      where: { source_sourceId: { source: m.source, sourceId: m.sourceId } },
      update: { name: m.name, campus: m.campus, infoUrl: m.infoUrl },
      create: { ...m, offersLunch: true, offersDinner: false },
    });
    mensaIds[m.sourceId] = row.id;
  }

  // Fake dishes for today at the UZH mensas, keyed "seed:<date>:<index>" so they coexist with real imports.
  const dishIds: string[] = [];
  for (const [sourceId, dishes] of Object.entries(FAKE_UZH_DISHES)) {
    for (const [i, d] of dishes.entries()) {
      const sourceKey = `seed:${today.toISOString().slice(0, 10)}:${i}`;
      const row = await prisma.dish.upsert({
        where: { mensaId_sourceKey: { mensaId: mensaIds[sourceId], sourceKey } },
        update: {},
        create: {
          mensaId: mensaIds[sourceId],
          date: today,
          mealTime: MealTime.LUNCH,
          sourceKey,
          lineName: d.lineName,
          name: d.name,
          description: d.description,
          mealClass: d.vegan ? "Vegan" : d.veg ? "Vegetarian" : "Meat",
          isVegan: !!d.vegan,
          isVegetarian: !!(d.veg || d.vegan),
          priceStudent: d.price,
          allergens: { create: d.allergens.map((allergenId) => ({ allergenId })) },
        },
      });
      dishIds.push(row.id);
    }
  }

  // Demo users (password: password123), one group, some plans and swipes.
  const passwordHash = await bcrypt.hash("password123", 10);
  const users: Record<string, string> = {};
  for (const u of ["alice", "bob", "carol"]) {
    const row = await prisma.user.upsert({
      where: { username: u },
      update: {},
      create: {
        username: u,
        displayName: u[0].toUpperCase() + u.slice(1),
        passwordHash,
        mensas: { create: Object.values(mensaIds).map((mensaId) => ({ mensaId })) },
      },
    });
    users[u] = row.id;
  }

  let group = await prisma.group.findFirst({ where: { name: "Hackathon", ownerId: users.alice } });
  if (!group) {
    group = await prisma.group.create({
      data: {
        name: "Hackathon",
        ownerId: users.alice,
        members: { create: [{ userId: users.alice, role: "OWNER" }, { userId: users.bob }, { userId: users.carol }] },
      },
    });
  }

  await prisma.plan.upsert({ where: { userId_date: { userId: users.alice, date: today } }, update: {}, create: { userId: users.alice, date: today, groupId: group.id, slotMinutes: 12 * 60 + 15 } });
  await prisma.plan.upsert({ where: { userId_date: { userId: users.bob, date: today } }, update: {}, create: { userId: users.bob, date: today, groupId: group.id, slotMinutes: 12 * 60 + 30 } });

  if (dishIds.length >= 4) {
    const sw = [
      { userId: users.alice, dishId: dishIds[0], value: 2 },
      { userId: users.alice, dishId: dishIds[2], value: 1 },
      { userId: users.alice, dishId: dishIds[1], value: -1 },
      { userId: users.bob, dishId: dishIds[0], value: 1 },
      { userId: users.bob, dishId: dishIds[3], value: -2 },
    ];
    for (const s of sw) {
      await prisma.swipe.upsert({ where: { userId_dishId: { userId: s.userId, dishId: s.dishId } }, update: { value: s.value }, create: s });
    }
  }

  console.log(`Seeded ${ALLERGENS.length} allergens, ${MENSAS.length} mensas, ${dishIds.length} fake dishes for ${today.toISOString().slice(0, 10)}, 3 users (password123), group "Hackathon".`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
