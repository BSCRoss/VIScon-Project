import { prisma } from "@/lib/db";
import { appDate, FEEDBACK_DELAY_MIN, isDemoDate, zurichNowMinutes } from "@/lib/time";

/**
 * The user's plan for the app date if feedback is due and not yet given.
 * "Due" = the group's committed slot (or the start of the user's window) + 45 min has passed.
 * On a demo date the real clock is meaningless, so feedback becomes due once the group has committed.
 */
export async function getPendingFeedback(userId: string) {
  const date = appDate();
  const [plan, existing] = await Promise.all([
    prisma.plan.findUnique({ where: { userId_date: { userId, date } }, include: { mensa: true, group: true } }),
    prisma.feedback.findUnique({ where: { userId_date: { userId, date } } }),
  ]);
  if (!plan || existing) return null;
  const decision = plan.groupId
    ? await prisma.groupDecision.findUnique({ where: { groupId_date: { groupId: plan.groupId, date } }, include: { mensa: true } })
    : null;
  const slot = decision?.slotMinutes ?? plan.fromMinutes;
  if (slot === null) return null;
  // Demo: the clock is fake, so ask only once the group has committed. Live: 45 min after the agreed/first slot.
  const due = isDemoDate() ? decision !== null : zurichNowMinutes() >= slot + FEEDBACK_DELAY_MIN;
  return { plan, decision, slot, mensaName: decision?.mensa.name ?? plan.mensa?.name ?? null, due };
}

/** Data for the feedback form: plan, decision, existing feedback, candidate mensas and liked dishes. */
export async function getFeedbackFormData(userId: string) {
  const date = appDate();
  const [plan, existing, userMensas, likes] = await Promise.all([
    prisma.plan.findUnique({ where: { userId_date: { userId, date } } }),
    prisma.feedback.findUnique({ where: { userId_date: { userId, date } } }),
    prisma.userMensa.findMany({ where: { userId }, include: { mensa: { select: { id: true, name: true } } } }),
    prisma.swipe.findMany({ where: { userId, value: { gt: 0 }, dish: { date } }, include: { dish: { select: { id: true, name: true, mensaId: true } } } }),
  ]);
  const decision = plan?.groupId
    ? await prisma.groupDecision.findUnique({ where: { groupId_date: { groupId: plan.groupId, date } }, include: { mensa: { select: { id: true, name: true } } } })
    : null;
  const mensas = userMensas.map((um) => um.mensa);
  for (const extra of [decision?.mensa, plan?.mensaId ? await prisma.mensa.findUnique({ where: { id: plan.mensaId }, select: { id: true, name: true } }) : null]) {
    if (extra && !mensas.some((m) => m.id === extra.id)) mensas.push(extra);
  }
  const likedMensaIds = new Set(likes.map((l) => l.dish.mensaId));
  const defaultMensaId = existing?.mensaId ?? decision?.mensaId ?? plan?.mensaId ?? mensas.find((m) => likedMensaIds.has(m.id))?.id ?? mensas[0]?.id ?? "";
  return {
    plan,
    planSlot: decision?.slotMinutes ?? plan?.fromMinutes ?? null,
    existing,
    mensas,
    likedDishes: likes.map((l) => ({ id: l.dish.id, name: l.dish.name, mensaId: l.dish.mensaId })),
    defaultMensaId,
  };
}
