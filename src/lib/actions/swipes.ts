"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { toIso, zurichTodayString } from "@/lib/time";
import { fail, ok, type ActionResult } from "./types";

const SWIPE_VALUES = [-2, -1, 1, 2] as const;

/** Right = "I want to eat this today". Called directly from the SwipeDeck client component. */
export async function swipe(dishId: string, value: number): Promise<ActionResult> {
  const user = await requireUser();
  if (!SWIPE_VALUES.includes(value as (typeof SWIPE_VALUES)[number])) return fail("Bad swipe value");
  const dish = await prisma.dish.findUnique({ where: { id: dishId }, select: { date: true } });
  if (!dish) return fail("Dish not found");
  if (toIso(dish.date) !== zurichTodayString()) return fail("You can only swipe today's dishes");

  await prisma.swipe.upsert({
    where: { userId_dishId: { userId: user.id, dishId } },
    update: { value },
    create: { userId: user.id, dishId, value },
  });
  revalidatePath("/today");
  revalidatePath("/groups", "layout");
  return ok();
}

export async function undoSwipe(dishId: string): Promise<ActionResult> {
  const user = await requireUser();
  await prisma.swipe.deleteMany({ where: { userId: user.id, dishId } });
  revalidatePath("/today");
  revalidatePath("/groups", "layout");
  return ok();
}
