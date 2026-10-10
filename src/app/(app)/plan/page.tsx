import { requireOnboardedUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getUserPlan } from "@/lib/queries/today";
import { getUserGroups } from "@/lib/queries/group";
import { zurichToday } from "@/lib/time";
import { PlanForm } from "@/components/forms/PlanForm";

export default async function PlanPage() {
  const user = await requireOnboardedUser();
  const [groups, plan, liked] = await Promise.all([
    getUserGroups(user.id),
    getUserPlan(user.id),
    prisma.swipe.findMany({ where: { userId: user.id, value: { gt: 0 }, dish: { date: zurichToday() } }, select: { dish: { select: { mensa: { select: { id: true, name: true } } } } } }),
  ]);
  const mensas = [...new Map(liked.map((l) => [l.dish.mensa.id, l.dish.mensa])).values()];
  if (plan?.mensa && !mensas.some((m) => m.id === plan.mensa!.id)) mensas.push(plan.mensa);

  // how many members of the user's groups picked each slot today (hint under the chips)
  const slotRows = await prisma.plan.groupBy({
    by: ["slotMinutes"],
    where: { date: zurichToday(), groupId: { in: groups.map((g) => g.id) }, slotMinutes: { not: null }, userId: { not: user.id } },
    _count: { _all: true },
  });
  const slotCounts = Object.fromEntries(slotRows.map((r) => [r.slotMinutes as number, r._count._all]));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Your plan for today</h1>
      <PlanForm
        groups={groups.map((g) => ({ id: g.id, name: g.name }))}
        mensas={mensas}
        current={{ groupId: plan?.groupId ?? null, slotMinutes: plan?.slotMinutes ?? null, mensaId: plan?.mensaId ?? null }}
        slotCounts={slotCounts}
      />
    </div>
  );
}
