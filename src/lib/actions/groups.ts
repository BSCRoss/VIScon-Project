"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { fail, ok, type ActionResult } from "./types";

export async function createGroup(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 40) return fail("Group name: 2–40 characters");
  const group = await prisma.group.create({
    data: { name, ownerId: user.id, members: { create: { userId: user.id, role: "OWNER" } } },
  });
  revalidatePath("/groups");
  redirect(`/groups/${group.id}`);
}

export async function inviteByUsername(_prev: ActionResult | undefined, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const groupId = String(formData.get("groupId") ?? "");
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  if (!username) return fail("Enter a username");

  const member = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: user.id } } });
  if (!member) return fail("You are not a member of this group");
  const target = await prisma.user.findUnique({ where: { username } });
  if (!target) return fail(`No user named "${username}"`);
  if (target.id === user.id) return fail("That is you");
  if (await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId: target.id } } })) return fail(`${username} is already a member`);

  await prisma.groupInvite.upsert({
    where: { groupId_toUserId: { groupId, toUserId: target.id } },
    update: { status: "PENDING", fromUserId: user.id },
    create: { groupId, fromUserId: user.id, toUserId: target.id },
  });
  revalidatePath(`/groups/${groupId}`);
  return ok(`Invited ${username}`);
}

/** Bound as a form action: respondInvite.bind(null, inviteId, true) */
export async function respondInvite(inviteId: string, accept: boolean): Promise<void> {
  const user = await requireUser();
  const invite = await prisma.groupInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.toUserId !== user.id || invite.status !== "PENDING") return;
  if (accept) {
    await prisma.$transaction([
      prisma.groupInvite.update({ where: { id: inviteId }, data: { status: "ACCEPTED" } }),
      prisma.groupMember.upsert({
        where: { groupId_userId: { groupId: invite.groupId, userId: user.id } },
        update: {},
        create: { groupId: invite.groupId, userId: user.id },
      }),
    ]);
  } else {
    await prisma.groupInvite.update({ where: { id: inviteId }, data: { status: "DECLINED" } });
  }
  revalidatePath("/groups", "layout");
  if (accept) redirect(`/groups/${invite.groupId}`);
}

export async function leaveGroup(groupId: string): Promise<void> {
  const user = await requireUser();
  await prisma.groupMember.deleteMany({ where: { groupId, userId: user.id } });
  await prisma.plan.updateMany({ where: { userId: user.id, groupId }, data: { groupId: null } });
  revalidatePath("/groups", "layout");
  redirect("/groups");
}
