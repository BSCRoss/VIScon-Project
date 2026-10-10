import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toIso, zurichToday } from "@/lib/time";

const dishInclude = (userId: string) =>
  ({
    mensa: { select: { id: true, name: true, campus: true } },
    allergens: { select: { allergenId: true } },
    swipes: { where: { userId }, select: { value: true } },
  }) satisfies Prisma.DishInclude;

type DishRow = Prisma.DishGetPayload<{ include: ReturnType<typeof dishInclude> }>;

/** Plain, serialisable dish for client components (Decimal → number). */
export type DishDTO = {
  id: string;
  mensaId: string;
  mensaName: string;
  lineName: string | null;
  name: string;
  description: string | null;
  mealClass: string | null;
  isVegetarian: boolean | null;
  isVegan: boolean | null;
  priceStudent: number | null;
  imageUrl: string | null;
  allergenIds: number[];
  mySwipe: number | null;
};

export function toDishDTO(d: DishRow): DishDTO {
  return {
    id: d.id,
    mensaId: d.mensa.id,
    mensaName: d.mensa.name,
    lineName: d.lineName,
    name: d.name,
    description: d.description,
    mealClass: d.mealClass,
    isVegetarian: d.isVegetarian,
    isVegan: d.isVegan,
    priceStudent: d.priceStudent === null ? null : Number(d.priceStudent),
    imageUrl: d.imageUrl,
    allergenIds: d.allergens.map((a) => a.allergenId),
    mySwipe: d.swipes[0]?.value ?? null,
  };
}

/** Today's lunch dishes at the user's mensas, with the user's swipe and flagged allergens. */
export async function getTodayDishes(userId: string) {
  const today = zurichToday();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { mensas: { include: { mensa: true } }, allergens: true },
  });
  const rows = await prisma.dish.findMany({
    where: { date: today, mealTime: "LUNCH", mensaId: { in: user.mensas.map((m) => m.mensaId) } },
    include: dishInclude(userId),
    orderBy: [{ mensa: { name: "asc" } }, { lineName: "asc" }, { name: "asc" }],
  });
  return {
    today: toIso(today),
    user,
    dishes: rows.map(toDishDTO),
    flaggedAllergenIds: user.allergens.map((a) => a.allergenId),
  };
}

export async function getUserPlan(userId: string) {
  return prisma.plan.findUnique({
    where: { userId_date: { userId, date: zurichToday() } },
    include: { group: { select: { id: true, name: true } }, mensa: { select: { id: true, name: true } } },
  });
}

export async function getAllergens() {
  return prisma.allergen.findMany({ orderBy: { id: "asc" } });
}

export async function getActiveMensas() {
  return prisma.mensa.findMany({ where: { isActive: true }, orderBy: [{ campus: "asc" }, { name: "asc" }] });
}
