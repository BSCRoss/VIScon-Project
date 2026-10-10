import Link from "next/link";
import { requireOnboardedUser } from "@/lib/session";
import { getUserPlan } from "@/lib/queries/today";
import { getGroupToday, getUserGroups } from "@/lib/queries/group";
import { AppHeader } from "@/components/AppHeader";
import { AvailabilityGrid } from "@/components/AvailabilityGrid";

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const user = await requireOnboardedUser();
  const { group: groupParam } = await searchParams;
  const [groups, plan] = await Promise.all([getUserGroups(user.id), getUserPlan(user.id)]);
  const groupId = groupParam && groups.some((g) => g.id === groupParam) ? groupParam : plan?.groupId ?? groups[0]?.id ?? null;
  const gt = groupId ? await getGroupToday(groupId, user.id) : null;

  const slots = (gt?.summary.availability ?? []).map((a) => ({
    slotMinutes: a.slotMinutes,
    othersCount: a.count - (a.mine ? 1 : 0),
    names: a.names.filter((n) => !gt!.members.find((m) => m.isViewer && m.name === n)),
  }));
  const othersTotal = gt ? gt.memberCount - 1 : 0;

  return (
    <div>
      <AppHeader eyebrow="Plan" title="Your lunch plan" subtitle="Pick the group you eat with, then mark when you can start. The group column shows where everyone overlaps." />

      {groups.length === 0 ? (
        <div className="card text-center text-[14px] text-muted">
          You are not in a group yet. <Link href="/groups/new" className="font-medium text-brand-700">Create one</Link> to coordinate.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {groups.map((g) => (
              <Link key={g.id} href={`/plan?group=${g.id}`} className={`pill shrink-0 ${g.id === groupId ? "pill-active" : ""}`}>{g.name}</Link>
            ))}
          </div>
          {gt ? (
            <AvailabilityGrid
              key={gt.group.id}
              groupId={gt.group.id}
              slots={slots}
              othersTotal={othersTotal}
              initial={plan?.groupId === gt.group.id ? plan.slots : []}
              fullOverlapSlots={gt.summary.fullOverlapSlots}
              decisionSlot={gt.decision?.slotMinutes ?? null}
            />
          ) : null}
          {gt ? (
            <Link href={`/groups/${gt.group.id}`} className="btn-secondary w-full">See the group&apos;s overview</Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
