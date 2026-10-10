"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { appDate, isValidSlot } from "@/lib/time";
import { fail, ok, type ActionResult } from "./types";

export type AvailabilityInput = {
  groupId: string | null;
  /** inclusive slot bounds, or both null to clear */
  fromMinutes: number | null;
  toMinutes: number | null;
  mensaId?: string | null;
};

/** Upserts the user's plan for the app date: group + availability window (+ optional mensa). Called from the availability grid. */
export async function saveAvailability(input: AvailabilityInput): Promise<ActionResult> {
  const user = await requireUser();
  const { groupId, fromMinutes, toMinutes } = input;
  const mensaId = input.mensaId ?? null;

  if ((fromMinutes === null) !== (toMinutes === null)) return fail("Incomplete time window");
  if (fromMinutes !== null && toMinutes !== null) {
    if (!isValidSlot(fromMinutes) || !isValidSlot(toMinutes) || fromMinutes > toMinutes) return fail("Pick a window between 11:00 and 14:00");
  }
  if (groupId) {
    const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: user.id } } });
    if (!member) return fail("You are not a member of that group");
  }
  if (mensaId && !(await prisma.mensa.findUnique({ where: { id: mensaId } }))) return fail("Unknown mensa");

  const date = appDate();
  await prisma.plan.upsert({
    where: { userId_date: { userId: user.id, date } },
    update: { groupId, fromMinutes, toMinutes, mensaId },
    create: { userId: user.id, date, groupId, fromMinutes, toMinutes, mensaId },
  });
  revalidatePath("/today");
  revalidatePath("/plan");
  revalidatePath("/groups", "layout");
  return ok();
}
