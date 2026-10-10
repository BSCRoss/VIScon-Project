"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { appDate, formatSlot, isValidSlot } from "@/lib/time";
import { fail, ok, type ActionResult } from "./types";

/** Commit "we eat at <mensa> at <slot>" for the group on the app date. Any member may commit or change it. */
export async function commitDecision(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const groupId = String(formData.get("groupId") ?? "");
  const mensaId = String(formData.get("mensaId") ?? "");
  const slotMinutes = Number(formData.get("slotMinutes"));

  if (!isValidSlot(slotMinutes)) return fail("Pick a time between 11:00 and 14:00");
  const [member, mensa] = await Promise.all([
    prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: user.id } } }),
    prisma.mensa.findUnique({ where: { id: mensaId }, select: { name: true } }),
  ]);
  if (!member) return fail("You are not a member of this group");
  if (!mensa) return fail("Pick a mensa");

  const date = appDate();
  await prisma.groupDecision.upsert({
    where: { groupId_date: { groupId, date } },
    update: { mensaId, slotMinutes, committedById: user.id },
    create: { groupId, date, mensaId, slotMinutes, committedById: user.id },
  });
  revalidatePath("/today");
  revalidatePath("/plan");
  revalidatePath("/groups", "layout");
  return ok(`Committed: ${mensa.name} at ${formatSlot(slotMinutes)}`);
}

/** Bound as a form action: clearDecision.bind(null, groupId) */
export async function clearDecision(groupId: string): Promise<void> {
  const user = await requireUser();
  const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: user.id } } });
  if (!member) return;
  const date = appDate();
  await prisma.$transaction([
    prisma.groupDecision.deleteMany({ where: { groupId, date } }),
    prisma.groupVote.deleteMany({ where: { groupId, date } }), // reopening = a fresh vote
  ]);
  revalidatePath("/today");
  revalidatePath("/groups", "layout");
}
