"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { isValidSlot, zurichToday } from "@/lib/time";
import { fail, type ActionResult } from "./types";

const str = (v: FormDataEntryValue | null) => (v ? String(v) : null);

/** Upserts today's plan (group, start slot, optional mensa). */
export async function setPlan(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const groupId = str(formData.get("groupId"));
  const mensaId = str(formData.get("mensaId"));
  const slotRaw = str(formData.get("slotMinutes"));
  const slotMinutes = slotRaw ? Number(slotRaw) : null;

  if (slotMinutes !== null && !isValidSlot(slotMinutes)) return fail("Pick a time between 11:00 and 14:00");
  if (groupId) {
    const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: user.id } } });
    if (!member) return fail("You are not a member of that group");
  }
  if (mensaId && !(await prisma.mensa.findUnique({ where: { id: mensaId } }))) return fail("Unknown mensa");

  const date = zurichToday();
  await prisma.plan.upsert({
    where: { userId_date: { userId: user.id, date } },
    update: { groupId, slotMinutes, mensaId },
    create: { userId: user.id, date, groupId, slotMinutes, mensaId },
  });
  revalidatePath("/today");
  revalidatePath("/plan");
  revalidatePath("/groups", "layout");
  redirect(groupId ? `/groups/${groupId}` : "/today");
}
