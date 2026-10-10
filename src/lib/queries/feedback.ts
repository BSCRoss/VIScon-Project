import { prisma } from "@/lib/db";
import { FEEDBACK_DELAY_MIN, zurichNowMinutes, zurichToday } from "@/lib/time";

/** Today's plan if feedback is due (slot + 45 min passed) and not yet given. */
export async function getPendingFeedback(userId: string) {
  const today = zurichToday();
  const [plan, existing] = await Promise.all([
    prisma.plan.findUnique({ where: { userId_date: { userId, date: today } }, include: { mensa: true, group: true } }),
    prisma.feedback.findUnique({ where: { userId_date: { userId, date: today } } }),
  ]);
  if (!plan || plan.slotMinutes === null || existing) return null;
  const due = zurichNowMinutes() >= plan.slotMinutes + FEEDBACK_DELAY_MIN;
  return { plan, due };
}

/** Data for the feedback form: plan, existing feedback, candidate mensas and liked dishes. */
export async function getFeedbackFormData(userId: string) {
  const today = zurichToday();
  const [plan, existing, userMensas, likes] = await Promise.all([
    prisma.plan.findUnique({ where: { userId_date: { userId, date: today } } }),
    prisma.feedback.findUnique({ where: { userId_date: { userId, date: today } } }),
    prisma.userMensa.findMany({ where: { userId }, include: { mensa: { select: { id: true, name: true } } } }),
    prisma.swipe.findMany({ where: { userId, value: { gt: 0 }, dish: { date: today } }, include: { dish: { select: { id: true, name: true, mensaId: true } } } }),
  ]);
  const mensas = userMensas.map((um) => um.mensa);
  const likedMensaIds = new Set(likes.map((l) => l.dish.mensaId));
  // make sure the plan's mensa is selectable even if not in the user's list
  if (plan?.mensaId && !mensas.some((m) => m.id === plan.mensaId)) {
    const m = await prisma.mensa.findUnique({ where: { id: plan.mensaId }, select: { id: true, name: true } });
    if (m) mensas.push(m);
  }
  const defaultMensaId = existing?.mensaId ?? plan?.mensaId ?? mensas.find((m) => likedMensaIds.has(m.id))?.id ?? mensas[0]?.id ?? "";
  return {
    plan,
    existing,
    mensas,
    likedDishes: likes.map((l) => ({ id: l.dish.id, name: l.dish.name, mensaId: l.dish.mensaId })),
    defaultMensaId,
  };
}
