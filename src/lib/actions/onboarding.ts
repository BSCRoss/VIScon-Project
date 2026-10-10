"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Area } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { WEEKDAYS } from "@/lib/area";
import { fail, type ActionResult } from "./types";

const AREAS = new Set<string>(["ZENTRUM", "HOENGGERBERG"]);

export async function saveOnboarding(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const mensaIds = [...new Set(formData.getAll("mensaIds").map(String))];
  const allergenIds = [...new Set(formData.getAll("allergenIds").map(Number).filter((n) => n >= 1 && n <= 14))];
  const vegetarian = formData.get("vegetarian") === "on";
  const vegan = formData.get("vegan") === "on";
  // "BOTH" (or missing) = no row: that weekday shows mensas from both areas.
  const weekdays = WEEKDAYS.map((wd) => ({ weekday: wd, area: String(formData.get(`weekday-${wd}`) ?? "BOTH") }))
    .filter((w) => AREAS.has(w.area))
    .map((w) => ({ weekday: w.weekday, area: w.area as Area }));

  if (mensaIds.length === 0) return fail("Pick at least one mensa");
  const valid = await prisma.mensa.count({ where: { id: { in: mensaIds }, isActive: true } });
  if (valid !== mensaIds.length) return fail("Unknown mensa selected");

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { vegetarian, vegan } }),
    prisma.userWeekday.deleteMany({ where: { userId: user.id } }),
    prisma.userWeekday.createMany({ data: weekdays.map((w) => ({ userId: user.id, ...w })) }),
    prisma.userMensa.deleteMany({ where: { userId: user.id } }),
    prisma.userMensa.createMany({ data: mensaIds.map((mensaId) => ({ userId: user.id, mensaId })) }),
    prisma.userAllergen.deleteMany({ where: { userId: user.id } }),
    prisma.userAllergen.createMany({ data: allergenIds.map((allergenId) => ({ userId: user.id, allergenId })) }),
  ]);
  revalidatePath("/", "layout");
  redirect("/today");
}
