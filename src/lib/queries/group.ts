import { prisma } from "@/lib/db";
import { appDate, slots, toIso } from "@/lib/time";

export async function getUserGroups(userId: string) {
  return prisma.group.findMany({
    where: { members: { some: { userId } } },
    include: { _count: { select: { members: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function getInvites(userId: string) {
  return prisma.groupInvite.findMany({
    where: { toUserId: userId, status: "PENDING" },
    include: { group: { select: { id: true, name: true } }, from: { select: { username: true, displayName: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export type GroupToday = NonNullable<Awaited<ReturnType<typeof getGroupToday>>>;
export type SlotAvailability = { slotMinutes: number; count: number; names: string[]; mine: boolean };

/** Everything the group screen and the availability grid need for the app date. Null if the viewer is not a member. */
export async function getGroupToday(groupId: string, viewerId: string) {
  const group = await prisma.group.findFirst({
    where: { id: groupId, members: { some: { userId: viewerId } } },
    include: { members: { include: { user: { select: { id: true, username: true, displayName: true } } }, orderBy: { joinedAt: "asc" } } },
  });
  if (!group) return null;

  const date = appDate();
  const memberIds = group.members.map((m) => m.userId);
  const [plans, likes, decision] = await Promise.all([
    prisma.plan.findMany({ where: { date, userId: { in: memberIds } }, include: { mensa: { select: { id: true, name: true } } } }),
    prisma.swipe.findMany({
      where: { userId: { in: memberIds }, value: { gt: 0 }, dish: { date } },
      include: { dish: { select: { id: true, name: true, mensaId: true, mensa: { select: { name: true } } } } },
    }),
    prisma.groupDecision.findUnique({
      where: { groupId_date: { groupId, date } },
      include: { mensa: { select: { id: true, name: true } }, committedBy: { select: { username: true, displayName: true } } },
    }),
  ]);

  const nameOf = (u: { username: string; displayName: string | null }) => u.displayName ?? u.username;
  const members = group.members.map((m) => {
    const plan = plans.find((p) => p.userId === m.userId) ?? null;
    return {
      user: m.user,
      name: nameOf(m.user),
      role: m.role,
      isViewer: m.userId === viewerId,
      plan,
      hasAvailability: plan?.fromMinutes != null && plan?.toMinutes != null,
      likes: likes
        .filter((s) => s.userId === m.userId)
        .sort((a, b) => b.value - a.value)
        .map((s) => ({ dishId: s.dish.id, name: s.dish.name, value: s.value, mensaId: s.dish.mensaId, mensaName: s.dish.mensa.name })),
    };
  });

  // "Where": mensas ranked by members with a right swipe there (explicit plan mensas count too)
  const byMensaMap = new Map<string, { mensaId: string; name: string; memberIds: Set<string>; dishes: Map<string, { name: string; votes: number }> }>();
  for (const s of likes) {
    const e = byMensaMap.get(s.dish.mensaId) ?? { mensaId: s.dish.mensaId, name: s.dish.mensa.name, memberIds: new Set(), dishes: new Map() };
    e.memberIds.add(s.userId);
    const d = e.dishes.get(s.dish.id) ?? { name: s.dish.name, votes: 0 };
    d.votes += s.value;
    e.dishes.set(s.dish.id, d);
    byMensaMap.set(s.dish.mensaId, e);
  }
  for (const p of plans) {
    if (!p.mensa) continue;
    const e = byMensaMap.get(p.mensa.id) ?? { mensaId: p.mensa.id, name: p.mensa.name, memberIds: new Set(), dishes: new Map() };
    e.memberIds.add(p.userId);
    byMensaMap.set(p.mensa.id, e);
  }
  const byMensa = [...byMensaMap.values()]
    .map((e) => ({ mensaId: e.mensaId, name: e.name, memberCount: e.memberIds.size, topDishes: [...e.dishes.values()].sort((a, b) => b.votes - a.votes).slice(0, 3) }))
    .sort((a, b) => b.memberCount - a.memberCount);

  // "When": availability per 15-minute slot (inclusive windows)
  const availability: SlotAvailability[] = slots().map((slotMinutes) => {
    const here = members.filter((m) => m.plan?.fromMinutes != null && m.plan?.toMinutes != null && m.plan.fromMinutes <= slotMinutes && slotMinutes <= m.plan.toMinutes);
    return { slotMinutes, count: here.length, names: here.map((m) => m.name), mine: here.some((m) => m.isViewer) };
  });
  const memberCount = members.length;
  const fullOverlapSlots = availability.filter((a) => a.count === memberCount && memberCount > 0).map((a) => a.slotMinutes);
  const bestCount = Math.max(0, ...availability.map((a) => a.count));
  const bestSlots = availability.filter((a) => a.count === bestCount && bestCount > 0).map((a) => a.slotMinutes);
  const allSubmitted = members.every((m) => m.hasAvailability);
  const waitingFor = members.filter((m) => !m.hasAvailability).map((m) => m.name);

  // Mensa options for committing: ranked mensas, else the union of members' followed mensas
  let mensaOptions = byMensa.map((m) => ({ id: m.mensaId, name: m.name }));
  if (mensaOptions.length === 0) {
    const followed = await prisma.userMensa.findMany({ where: { userId: { in: memberIds } }, include: { mensa: { select: { id: true, name: true } } } });
    mensaOptions = [...new Map(followed.map((f) => [f.mensa.id, f.mensa])).values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  const canCommit = allSubmitted && fullOverlapSlots.length > 0 && mensaOptions.length > 0;
  const suggestion = { slotMinutes: fullOverlapSlots[0] ?? bestSlots[0] ?? null, mensaId: mensaOptions[0]?.id ?? null };

  return {
    group: { id: group.id, name: group.name, ownerId: group.ownerId },
    dateIso: toIso(date),
    memberCount,
    members,
    summary: { byMensa, availability, fullOverlapSlots, bestSlots, allSubmitted, waitingFor, canCommit, suggestion, mensaOptions },
    decision,
  };
}
