"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { appDate, isValidSlot } from "@/lib/time";
import { fail, ok, type ActionResult } from "./types";

export type AvailabilityInput = {
  groupId: string | null;
  /** selected start slots in minutes; empty = no availability */
  slots: number[];
  mensaId?: string | null;
};

/** Upserts the user's plan for the app date: group + selected slots (+ optional mensa). Called from the availability grid. */
export async function saveAvailability(input: AvailabilityInput): Promise<ActionResult> {
  const user = await requireUser();
  const { groupId } = input;
  const mensaId = input.mensaId ?? null;
  const slots = [...new Set(input.slots)].sort((a, b) => a - b);
  if (!slots.every(isValidSlot)) return fail("Pick times between 11:00 and 14:00");
  if (groupId) {
    const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: user.id } } });
    if (!member) return fail("You are not a member of that group");
  }
  if (mensaId && !(await prisma.mensa.findUnique({ where: { id: mensaId } }))) return fail("Unknown mensa");

  const date = appDate();
  await prisma.plan.upsert({
    where: { userId_date: { userId: user.id, date } },
    update: { groupId, slots, mensaId },
    create: { userId: user.id, date, groupId, slots, mensaId },
  });
  revalidatePath("/today");
  revalidatePath("/plan");
  revalidatePath("/groups", "layout");
  return ok();
}
