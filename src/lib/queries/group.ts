import { prisma } from "@/lib/db";
import { toIso, zurichToday } from "@/lib/time";

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

/** Everything the group screen needs for today. Returns null if the viewer is not a member. */
export async function getGroupToday(groupId: string, viewerId: string) {
  const group = await prisma.group.findFirst({
    where: { id: groupId, members: { some: { userId: viewerId } } },
    include: { members: { include: { user: { select: { id: true, username: true, displayName: true } } }, orderBy: { joinedAt: "asc" } } },
  });
  if (!group) return null;

  const today = zurichToday();
  const memberIds = group.members.map((m) => m.userId);
  const [plans, likes] = await Promise.all([
    prisma.plan.findMany({ where: { date: today, userId: { in: memberIds } }, include: { mensa: { select: { id: true, name: true } } } }),
    prisma.swipe.findMany({
      where: { userId: { in: memberIds }, value: { gt: 0 }, dish: { date: today } },
      include: { dish: { select: { id: true, name: true, mensaId: true, mensa: { select: { name: true } } } } },
    }),
  ]);

  const members = group.members.map((m) => ({
    user: m.user,
    role: m.role,
    isViewer: m.userId === viewerId,
    plan: plans.find((p) => p.userId === m.userId) ?? null,
    likes: likes
      .filter((s) => s.userId === m.userId)
      .sort((a, b) => b.value - a.value)
      .map((s) => ({ dishId: s.dish.id, name: s.dish.name, value: s.value, mensaId: s.dish.mensaId, mensaName: s.dish.mensa.name })),
  }));

  // "Where": mensas ranked by number of members with at least one right swipe there
  const byMensaMap = new Map<string, { mensaId: string; name: string; memberIds: Set<string>; dishes: Map<string, { name: string; votes: number }> }>();
  for (const s of likes) {
    const e = byMensaMap.get(s.dish.mensaId) ?? { mensaId: s.dish.mensaId, name: s.dish.mensa.name, memberIds: new Set(), dishes: new Map() };
    e.memberIds.add(s.userId);
    const d = e.dishes.get(s.dish.id) ?? { name: s.dish.name, votes: 0 };
    d.votes += s.value;
    e.dishes.set(s.dish.id, d);
    byMensaMap.set(s.dish.mensaId, e);
  }
  // explicit mensa choices in plans count too
  for (const p of plans) {
    if (!p.mensa) continue;
    const e = byMensaMap.get(p.mensa.id) ?? { mensaId: p.mensa.id, name: p.mensa.name, memberIds: new Set(), dishes: new Map() };
    e.memberIds.add(p.userId);
    byMensaMap.set(p.mensa.id, e);
  }
  const byMensa = [...byMensaMap.values()]
    .map((e) => ({
      mensaId: e.mensaId,
      name: e.name,
      memberCount: e.memberIds.size,
      topDishes: [...e.dishes.values()].sort((a, b) => b.votes - a.votes).slice(0, 3),
    }))
    .sort((a, b) => b.memberCount - a.memberCount);

  // "When": slots ranked by member count
  const slotCounts = new Map<number, number>();
  for (const p of plans) if (p.slotMinutes !== null) slotCounts.set(p.slotMinutes, (slotCounts.get(p.slotMinutes) ?? 0) + 1);
  const bySlot = [...slotCounts.entries()].map(([slotMinutes, memberCount]) => ({ slotMinutes, memberCount })).sort((a, b) => b.memberCount - a.memberCount || a.slotMinutes - b.slotMinutes);

  return { group: { id: group.id, name: group.name, ownerId: group.ownerId }, today: toIso(today), memberCount: members.length, members, summary: { byMensa, bySlot } };
}
