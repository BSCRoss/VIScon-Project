/**
 * Seed: allergens (fixed), a few mensas, demo users + group with weekday areas and availability,
 * and fake UZH dishes for the app date so the app has content before an import. Idempotent.
 * Run: pnpm db:seed   (uses DATABASE_URL and DEMO_DATE from .env)
 */
import { PrismaClient, Campus, MenuSource, MealTime, Area } from "@prisma/client";
import { ALLERGENS } from "../src/lib/allergens";
import bcrypt from "bcryptjs";
import { addDays, appDate, dateOnly, mondayOf, toIso, SLOT_STEP } from "../src/lib/time";

const prisma = new PrismaClient();



const MENSAS = [
  { source: MenuSource.ETH_COOKPIT, sourceId: "9", name: "Mensa Polyterrasse", campus: Campus.ETH_ZENTRUM, infoUrl: "https://ethz.ch/en/campus/getting-to-know/cafes-restaurants-shops/gastronomy/restaurants-and-cafeterias/zentrum/mensa-polyterrasse.html" },
  { source: MenuSource.ETH_COOKPIT, sourceId: "3", name: "Clausiusbar", campus: Campus.ETH_ZENTRUM, infoUrl: "https://ethz.ch/en/campus/getting-to-know/cafes-restaurants-shops/gastronomy/restaurants-and-cafeterias/zentrum/clausiusbar.html" },
  { source: MenuSource.ETH_COOKPIT, sourceId: "22", name: "Rice Up!", campus: Campus.ETH_HOENGGERBERG, infoUrl: "https://ethz.ch/en/campus/getting-to-know/cafes-restaurants-shops/gastronomy/restaurants-and-cafeterias/hoenggerberg/rice-up.html" },
  { source: MenuSource.FOOD2050, sourceId: "uzh-zentrum/untere-mensa/mittag", name: "UZH Zentrum Lower Mensa", campus: Campus.UZH_ZENTRUM, infoUrl: "https://app.food2050.ch/de/zfv/uzh-zentrum/untere-mensa/menu/weekly" },
  { source: MenuSource.FOOD2050, sourceId: "uzh-zentrum/obere-mensa/mittag", name: "UZH Zentrum Upper Mensa", campus: Campus.UZH_ZENTRUM, infoUrl: "https://app.food2050.ch/de/zfv/uzh-zentrum/obere-mensa/menu/weekly" },
];

// Fallback UZH dishes (plans/3-menu-import.md §4). German like the source.
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

type DemoUser = { username: string; displayName: string; weekdays: Record<number, Area>; window: [number, number] };
const DEMO_USERS: DemoUser[] = [
  { username: "alice", displayName: "Alice", weekdays: { 1: Area.ZENTRUM, 2: Area.ZENTRUM, 3: Area.ZENTRUM, 4: Area.ZENTRUM, 5: Area.ZENTRUM }, window: [11 * 60 + 45, 13 * 60] },
  { username: "bob", displayName: "Bob", weekdays: { 1: Area.ZENTRUM, 2: Area.HOENGGERBERG, 3: Area.ZENTRUM, 4: Area.HOENGGERBERG, 5: Area.ZENTRUM }, window: [12 * 60, 13 * 60 + 30] },
  { username: "carol", displayName: "Carol", weekdays: { 1: Area.ZENTRUM, 2: Area.ZENTRUM, 3: Area.ZENTRUM, 4: Area.ZENTRUM, 5: Area.ZENTRUM }, window: [12 * 60 + 15, 13 * 60] },
];

async function main() {
  const date = appDate();
  const dateIso = toIso(date);

  for (const a of ALLERGENS) await prisma.allergen.upsert({ where: { id: a.id }, update: a, create: a });

  const mensaIds: Record<string, string> = {};
  for (const m of MENSAS) {
    const row = await prisma.mensa.upsert({
      where: { source_sourceId: { source: m.source, sourceId: m.sourceId } },
      update: { name: m.name, campus: m.campus, infoUrl: m.infoUrl },
      create: { ...m, offersLunch: true, offersDinner: false },
    });
    mensaIds[m.sourceId] = row.id;
  }

  // Fake dishes for the app date at the UZH mensas, keyed "seed:<date>:<i>" so they coexist with real imports.
  const fakeDishIds: string[] = [];
  for (const [sourceId, dishes] of Object.entries(FAKE_UZH_DISHES)) {
    for (const [i, d] of dishes.entries()) {
      const sourceKey = `seed:${dateIso}:${i}`;
      const row = await prisma.dish.upsert({
        where: { mensaId_sourceKey: { mensaId: mensaIds[sourceId], sourceKey } },
        update: {},
        create: {
          mensaId: mensaIds[sourceId], date, mealTime: MealTime.LUNCH, sourceKey,
          lineName: d.lineName, name: d.name, description: d.description,
          mealClass: d.vegan ? "Vegan" : d.veg ? "Vegetarian" : "Meat",
          isVegan: !!d.vegan, isVegetarian: !!(d.veg || d.vegan), priceStudent: d.price,
          allergens: { create: d.allergens.map((allergenId) => ({ allergenId })) },
        },
      });
      fakeDishIds.push(row.id);
    }
  }

  // Demo users (password: password123) with weekday areas; all follow all seeded mensas.
  const passwordHash = await bcrypt.hash("password123", 10);
  const users: Record<string, string> = {};
  for (const u of DEMO_USERS) {
    const row = await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: { username: u.username, displayName: u.displayName, passwordHash, mensas: { create: Object.values(mensaIds).map((mensaId) => ({ mensaId })) } },
    });
    users[u.username] = row.id;
    await prisma.userWeekday.deleteMany({ where: { userId: row.id } });
    await prisma.userWeekday.createMany({ data: Object.entries(u.weekdays).map(([wd, area]) => ({ userId: row.id, weekday: Number(wd), area })) });
  }

  let group = await prisma.group.findFirst({ where: { name: "Hackathon", ownerId: users.alice } });
  if (!group) {
    group = await prisma.group.create({
      data: { name: "Hackathon", ownerId: users.alice, members: { create: [{ userId: users.alice, role: "OWNER" }, { userId: users.bob }, { userId: users.carol }] } },
    });
  }

  // Availability windows for the app date (overlap 12:15–13:00 → the group can commit)
  for (const u of DEMO_USERS) {
    const [from, to] = u.window;
    const slots: number[] = [];
    for (let m = from; m <= to; m += SLOT_STEP) slots.push(m);
    await prisma.plan.upsert({
      where: { userId_date: { userId: users[u.username], date } },
      update: { groupId: group.id, slots },
      create: { userId: users[u.username], date, groupId: group.id, slots },
    });
  }

  // Synthetic vote history on the other days of the week (SYNTHETIC: bootstraps the popularity prediction
  // until real users have voted). Six "history" users vote by simple taste rules + deterministic jitter.
  const monday = mondayOf(dateIso);
  const pastDays = [0, 1, 2, 3, 4].map((i) => addDays(monday, i)).filter((d) => d !== dateIso);
  const past = await prisma.dish.findMany({ where: { date: { in: pastDays.map(dateOnly) }, mealTime: MealTime.LUNCH }, select: { id: true, name: true, description: true, lineName: true, priceStudent: true } });
  const histUsers: string[] = [];
  for (let i = 1; i <= 6; i++) {
    const row = await prisma.user.upsert({ where: { username: `hist${i}` }, update: {}, create: { username: `hist${i}`, displayName: `History ${i}`, passwordHash } });
    histUsers.push(row.id);
  }
  // Student taste model (SYNTHETIC). Only a minority of dishes are real crowd-pullers; most are middling;
  // "healthy but boring" and expensive per-100g items sell slowly. Price matters: cheap wins.
  const HIT = /pizza|burger|pasta|penne|spaghetti|lasagne|curry|ramen|noodle|wok|schnitzel|fries|pommes|chicken wings|kebab|döner|doner|gyoza|fried chicken|tacos|burrito|mac ?&? ?cheese|cordon bleu|bratwurst|rösti|risotto|bolognese|carbonara|pad thai|krapow|kra paow/i;
  const OK = /bowl|poulet|chicken|salmon|lachs|steak|beef|rind|pork|schwein|thai|teriyaki|falafel|wrap|quesadilla/i;
  const FLOP = /tofu|soup|suppe|salat|salad|buffet|100 ?g|lentil|linsen|cauliflower|blumenkohl|porridge|quinoa|steamed|gedämpft|liver|leber|polenta|beetroot|rande|kohl|cabbage|fish fillet|fischfilet|qingzheng|boiled|gekocht/i;
  const h = (t: string) => { let x = 2166136261; for (let i = 0; i < t.length; i++) x = Math.imul(x ^ t.charCodeAt(i), 16777619); return (x >>> 0) % 100; };
  let histVotes = 0;
  for (const d of past) {
    const text = `${d.name} ${d.lineName ?? ""} ${d.description ?? ""}`;
    let bias = HIT.test(text) ? 0.65 : FLOP.test(text) ? -0.6 : OK.test(text) ? 0.15 : -0.2;
    const price = d.priceStudent === null ? null : Number(d.priceStudent);
    if (price !== null) bias += Math.max(-0.3, Math.min(0.2, (8.5 - price) / 10)); // CHF 6.50 → +0.2, CHF 12 → -0.3
    bias += (h(`dish:${d.id}`) / 100 - 0.5) * 0.3; // per-dish personality so not every pizza is identical
    for (const [i, uid] of histUsers.entries()) {
      if (h(`${d.id}:${i}:skip`) < 40) continue; // not everyone votes on everything
      const r = h(`${d.id}:${i}`) / 100; // 0..1
      const p = Math.max(0.05, Math.min(0.95, 0.5 + bias / 2)); // probability of liking
      const value = r < p ? (r < p * 0.3 ? 2 : 1) : r > 0.92 ? -2 : -1;
      await prisma.swipe.upsert({ where: { userId_dishId: { userId: uid, dishId: d.id } }, update: { value }, create: { userId: uid, dishId: d.id, value } });
      histVotes++;
    }
  }
  // Bob has already voted (Polyterrasse 12:15): one more vote on the same option = majority → decided live on stage.
  await prisma.groupVote.upsert({
    where: { groupId_date_userId: { groupId: group.id, date, userId: users.bob } },
    update: { mensaId: mensaIds["9"], slotMinutes: 12 * 60 + 15 },
    create: { groupId: group.id, date, userId: users.bob, mensaId: mensaIds["9"], slotMinutes: 12 * 60 + 15 },
  });

  // Demo users' swipes: on real Polyterrasse dishes for the date if imported, else on the fake UZH dishes.
  const poly = await prisma.dish.findMany({ where: { date, mealTime: "LUNCH", mensaId: mensaIds["9"] }, orderBy: { lineName: "asc" }, take: 4 });
  const targets = poly.length >= 3 ? poly.map((d) => d.id) : fakeDishIds;
  if (targets.length >= 4) {
    const sw = [
      { userId: users.alice, dishId: targets[0], value: 2 }, { userId: users.alice, dishId: targets[2], value: 1 }, { userId: users.alice, dishId: targets[1], value: -1 },
      { userId: users.bob, dishId: targets[0], value: 1 }, { userId: users.bob, dishId: targets[3], value: -2 },
      { userId: users.carol, dishId: targets[0], value: 1 }, { userId: users.carol, dishId: targets[2], value: 2 },
    ];
    for (const x of sw) await prisma.swipe.upsert({ where: { userId_dishId: { userId: x.userId, dishId: x.dishId } }, update: { value: x.value }, create: x });
  }

  // Yesterday (previous weekday): the group agreed on Polyterrasse and the demo users liked dishes there,
  // so the "how was yesterday?" popup can infer where they were and what they probably ate.
  let yIso = addDays(dateIso, -1);
  const wd = (d: string) => ((dateOnly(d).getUTCDay() + 6) % 7) + 1;
  if (wd(yIso) > 5) yIso = addDays(yIso, -(wd(yIso) - 5));
  const yDate = dateOnly(yIso);
  const yAll = await prisma.dish.findMany({ where: { date: yDate, mealTime: MealTime.LUNCH, mensaId: mensaIds["9"], imageUrl: { not: null } }, orderBy: { name: "asc" } });
  const CROWD = /pasta|noodle|nudel|curry|chicken|poulet|burger|pizza|bolognese|schnitzel|risotto|ramen|wok/i;
  const yPoly = [...yAll.filter((d) => CROWD.test(`${d.name} ${d.lineName ?? ""}`)), ...yAll.filter((d) => !CROWD.test(`${d.name} ${d.lineName ?? ""}`))].slice(0, 3);
  if (yPoly.length >= 2) {
    await prisma.groupDecision.upsert({
      where: { groupId_date: { groupId: group.id, date: yDate } },
      update: { mensaId: mensaIds["9"], slotMinutes: 12 * 60 + 15, committedById: users.alice },
      create: { groupId: group.id, date: yDate, mensaId: mensaIds["9"], slotMinutes: 12 * 60 + 15, committedById: users.alice },
    });
    const ySw = [
      { userId: users.alice, dishId: yPoly[0].id, value: 2 }, { userId: users.bob, dishId: yPoly[1].id, value: 1 }, { userId: users.carol, dishId: yPoly[0].id, value: 1 },
    ];
    for (const x of ySw) await prisma.swipe.upsert({ where: { userId_dishId: { userId: x.userId, dishId: x.dishId } }, update: { value: x.value }, create: x });
    console.log(`Yesterday (${yIso}): group decision Polyterrasse 12:15 + likes on "${yPoly[0].name}" / "${yPoly[1].name}".`);
  }

  console.log(`Synthetic history: ${histVotes} votes on ${past.length} dishes from ${pastDays.join(", ")}.`);
  console.log(`Seeded for ${dateIso}: ${ALLERGENS.length} allergens, ${MENSAS.length} mensas, ${fakeDishIds.length} fake UZH dishes, 3 users (password123) with weekday areas + availability, group "Hackathon". Swipes on ${poly.length >= 3 ? "real Polyterrasse" : "fake UZH"} dishes.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
