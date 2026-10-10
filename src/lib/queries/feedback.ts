import { prisma } from "@/lib/db";
import { mediumUrl } from "@/lib/images";
import { addDays, appDate, appDateString, dateOnly, FEEDBACK_DELAY_MIN, formatDateLong, isDemoDate, isoWeekday, zurichNowMinutes } from "@/lib/time";

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
  const slot = decision?.slotMinutes ?? (plan.slots.length ? Math.min(...plan.slots) : null);
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
    planSlot: decision?.slotMinutes ?? (plan?.slots.length ? Math.min(...plan.slots) : null),
    existing,
    mensas,
    likedDishes: likes.map((l) => ({ id: l.dish.id, name: l.dish.name, mensaId: l.dish.mensaId })),
    defaultMensaId,
  };
}

/**
 * The "how was yesterday's lunch?" popup, with an inferred mensa + dish and a dropdown to correct it.
 * Mensa inference, in order: the group's committed decision that day → the user's plan mensa → the mensa of
 * the dish they liked most → the mensa with most likes → their first followed mensa.
 * Dish inference inside that mensa: liked dish (highest vote) → previously rated dish → most popular with photo → first.
 * Demo mode shows the popup on every page load; live mode only until answered or dismissed.
 */
export async function getYesterdayPrompt(userId: string) {
  let dateIso = addDays(appDateString(), -1);
  if (isoWeekday(dateIso) > 5) dateIso = addDays(dateIso, -(isoWeekday(dateIso) - 5)); // weekend → Friday
  const date = dateOnly(dateIso);
  const demo = isDemoDate();
  const [existing, userMensas, plan, decision, likes] = await Promise.all([
    prisma.feedback.findUnique({ where: { userId_date: { userId, date } }, select: { rating: true, wouldAgain: true, dishId: true, mensaId: true } }),
    prisma.userMensa.findMany({ where: { userId }, select: { mensaId: true } }),
    prisma.plan.findUnique({ where: { userId_date: { userId, date } }, select: { mensaId: true, groupId: true } }),
    prisma.groupDecision.findFirst({ where: { date, group: { members: { some: { userId } } } }, orderBy: { updatedAt: "desc" }, select: { mensaId: true, group: { select: { name: true } } } }),
    prisma.swipe.findMany({ where: { userId, value: { gt: 0 }, dish: { date } }, orderBy: { value: "desc" }, select: { dishId: true, value: true, dish: { select: { mensaId: true } } } }),
  ]);
  if (!demo && existing) return null;
  const followed = userMensas.map((m) => m.mensaId);
  if (followed.length === 0) return null;

  // candidate mensas = followed ∪ decision/plan mensa, with yesterday's lunch dishes
  const mensaIds = [...new Set([...followed, decision?.mensaId, plan?.mensaId, existing?.mensaId].filter((x): x is string => !!x))];
  const mensas = await prisma.mensa.findMany({
    where: { id: { in: mensaIds } },
    select: { id: true, name: true, dishes: { where: { date, mealTime: "LUNCH" }, orderBy: [{ predictedScore: { sort: "desc", nulls: "last" } }, { name: "asc" }], select: { id: true, name: true, imageUrl: true, image: { select: { dishId: true } } } } },
  });
  const withDishes = mensas.filter((m) => m.dishes.length > 0);
  if (withDishes.length === 0) return null;

  const likesByMensa = new Map<string, number>();
  for (const l of likes) likesByMensa.set(l.dish.mensaId, (likesByMensa.get(l.dish.mensaId) ?? 0) + 1);
  const has = (id?: string | null) => !!id && withDishes.some((m) => m.id === id);
  let inferredMensaId: string; let reason: string;
  if (existing?.mensaId && has(existing.mensaId)) { inferredMensaId = existing.mensaId; reason = "you rated it earlier"; }
  else if (has(decision?.mensaId)) { inferredMensaId = decision!.mensaId; reason = `${decision!.group.name} agreed on it`; }
  else if (has(plan?.mensaId)) { inferredMensaId = plan!.mensaId!; reason = "it was in your plan"; }
  else if (likes[0] && has(likes[0].dish.mensaId)) { inferredMensaId = likes[0].dish.mensaId; reason = "you liked a dish there"; }
  else { const top = [...likesByMensa.entries()].filter(([id]) => has(id)).sort((a, b) => b[1] - a[1])[0]; inferredMensaId = top?.[0] ?? withDishes[0].id; reason = top ? "most of your likes were there" : "it's your first mensa"; }

  const options = [...withDishes].sort((a, b) => (a.id === inferredMensaId ? -1 : b.id === inferredMensaId ? 1 : a.name.localeCompare(b.name))).map((m) => ({
    mensaId: m.id, mensaName: m.name,
    dishes: m.dishes.map((d) => ({ id: d.id, name: d.name, imageUrl: d.imageUrl ? (d.image ? mediumUrl(d.id) : d.imageUrl) : null })),
  }));
  const inferredMensa = options[0];
  const likedHere = likes.find((l) => l.dish.mensaId === inferredMensaId && inferredMensa.dishes.some((d) => d.id === l.dishId));
  const dishId = (existing?.dishId && inferredMensa.dishes.some((d) => d.id === existing.dishId) ? existing.dishId : null)
    ?? likedHere?.dishId
    ?? inferredMensa.dishes.find((d) => d.imageUrl)?.id
    ?? inferredMensa.dishes[0].id;

  return {
    dateIso,
    dateLabel: formatDateLong(dateIso),
    inferred: { mensaId: inferredMensaId, mensaName: inferredMensa.mensaName, dishId, reason },
    options,
    existing: existing ? { rating: existing.rating, wouldAgain: existing.wouldAgain } : null,
    alwaysShow: demo,
  };
}
