import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { appDate, toIso } from "@/lib/time";
import { areaForDate, mensaMatchesArea } from "@/lib/area";
import { getMensaLoads } from "@/lib/load";
import { popularityLabel, type PopularityLabel } from "@/lib/popularity";
import { mediumUrl, thumbUrl } from "@/lib/images";

const dishInclude = (userId: string) =>
  ({
    mensa: { select: { id: true, name: true, campus: true } },
    allergens: { select: { allergenId: true } },
    swipes: { where: { userId }, select: { value: true } },
    image: { select: { dishId: true } },
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
  /** medium (720px) image */
  imageUrl: string | null;
  /** small (192px) thumbnail */
  thumbUrl: string | null;
  allergenIds: number[];
  mySwipe: number | null;
  predicted: { label: PopularityLabel; score: number; n: number } | null;
};

export function toDishDTO(d: DishRow): DishDTO {
  return {
    id: d.id, mensaId: d.mensa.id, mensaName: d.mensa.name, lineName: d.lineName, name: d.name, description: d.description,
    mealClass: d.mealClass, isVegetarian: d.isVegetarian, isVegan: d.isVegan,
    priceStudent: d.priceStudent === null ? null : Number(d.priceStudent),
    imageUrl: d.imageUrl ? (d.image ? mediumUrl(d.id) : d.imageUrl) : null,
    thumbUrl: d.imageUrl ? (d.image ? thumbUrl(d.id) : d.imageUrl) : null,
    allergenIds: d.allergens.map((a) => a.allergenId), mySwipe: d.swipes[0]?.value ?? null,
    predicted: (() => { const l = popularityLabel(d.predictedScore, d.predictedN); return l ? { label: l, score: d.predictedScore!, n: d.predictedN! } : null; })(),
  };
}

/**
 * Everything the Today/Swipe screens need: the app date, the user's area for that weekday,
 * the user's mensas filtered to that area, their lunch dishes, and the load indicator per mensa.
 */
export async function getTodayContext(userId: string) {
  const date = appDate();
  const dateIso = toIso(date);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { mensas: { include: { mensa: true } }, allergens: true, weekdays: true },
  });
  const area = areaForDate(user.weekdays, dateIso);
  const mensas = user.mensas.map((um) => um.mensa).filter((m) => mensaMatchesArea(m.campus, area)).sort((a, b) => a.name.localeCompare(b.name));
  const [rows, loads] = await Promise.all([
    prisma.dish.findMany({
      where: { date, mealTime: "LUNCH", mensaId: { in: mensas.map((m) => m.id) } },
      include: dishInclude(userId),
      orderBy: [{ mensa: { name: "asc" } }, { lineName: "asc" }, { name: "asc" }],
    }),
    getMensaLoads(mensas.map((m) => m.id), date),
  ]);
  return {
    dateIso,
    area,
    user,
    mensas,
    dishes: rows.map(toDishDTO),
    flaggedAllergenIds: user.allergens.map((a) => a.allergenId),
    loads,
  };
}

export async function getUserPlan(userId: string) {
  return prisma.plan.findUnique({
    where: { userId_date: { userId, date: appDate() } },
    include: { group: { select: { id: true, name: true } }, mensa: { select: { id: true, name: true } } },
  });
}

/** Committed decisions of all the user's groups for the app date. */
export async function getDecisionsForUser(userId: string) {
  return prisma.groupDecision.findMany({
    where: { date: appDate(), group: { members: { some: { userId } } } },
    include: { group: { select: { id: true, name: true } }, mensa: { select: { id: true, name: true } }, committedBy: { select: { username: true, displayName: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getAllergens() {
  return prisma.allergen.findMany({ orderBy: { id: "asc" } });
}

export async function getActiveMensas() {
  return prisma.mensa.findMany({ where: { isActive: true }, orderBy: [{ campus: "asc" }, { name: "asc" }] });
}
