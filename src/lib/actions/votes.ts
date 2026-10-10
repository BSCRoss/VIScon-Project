"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { appDate, isValidSlot } from "@/lib/time";
import { resolveGroupVote } from "@/lib/votes";
import { fail, ok, type ActionResult } from "./types";

/** Cast or change my vote for one option. Resolves the vote if it now has a majority. */
export async function castVote(groupId: string, mensaId: string, slotMinutes: number): Promise<ActionResult> {
  const user = await requireUser();
  if (!isValidSlot(slotMinutes)) return fail("Invalid time");
  const date = appDate();
  const [member, mensa, decided] = await Promise.all([
    prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: user.id } } }),
    prisma.mensa.findUnique({ where: { id: mensaId }, select: { id: true } }),
    prisma.groupDecision.findUnique({ where: { groupId_date: { groupId, date } } }),
  ]);
  if (!member) return fail("You are not a member of this group");
  if (!mensa) return fail("Unknown mensa");
  if (decided) return fail("The vote is already closed");
  await prisma.groupVote.upsert({
    where: { groupId_date_userId: { groupId, date, userId: user.id } },
    update: { mensaId, slotMinutes },
    create: { groupId, date, userId: user.id, mensaId, slotMinutes },
  });
  const decision = await resolveGroupVote(groupId, date, { byUserId: user.id });
  revalidatePath("/today");
  revalidatePath("/plan");
  revalidatePath("/groups", "layout");
  return ok(decision ? "Majority reached – it's decided!" : "Vote saved");
}

/** Close the vote now (any member): the option with most votes wins. Bound as a form action. */
export async function endVote(groupId: string): Promise<void> {
  const user = await requireUser();
  const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: user.id } } });
  if (!member) return;
  await resolveGroupVote(groupId, appDate(), { force: true, byUserId: user.id });
  revalidatePath("/today");
  revalidatePath("/groups", "layout");
}
