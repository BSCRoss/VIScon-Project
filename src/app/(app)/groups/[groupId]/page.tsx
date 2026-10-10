import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getGroupToday } from "@/lib/queries/group";
import { leaveGroup } from "@/lib/actions/groups";
import { formatDateLong, formatSlot } from "@/lib/time";
import { SWIPE_LABEL } from "@/lib/labels";
import { InviteForm } from "@/components/forms/GroupForms";

export default async function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const user = await requireUser();
  const { groupId } = await params;
  const data = await getGroupToday(groupId, user.id);
  if (!data) notFound();
  const { group, today, members, summary } = data;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">{group.name}</h1>
        <p className="text-sm text-stone-500">{formatDateLong(today)} · {members.length} {members.length === 1 ? "member" : "members"}</p>
      </header>

      <section className="card space-y-3">
        <div>
          <h2 className="label">Where</h2>
          {summary.byMensa.length === 0 ? <p className="text-sm text-stone-500">Nobody has swiped yet.</p> : (
            <ul className="space-y-1">
              {summary.byMensa.map((m) => (
                <li key={m.mensaId}>
                  <span className="font-medium">{m.name}</span> <span className="text-sm text-stone-500">· {m.memberCount} of {members.length}</span>
                  {m.topDishes.length ? <p className="text-xs text-stone-500">{m.topDishes.map((d) => d.name).join(" · ")}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2 className="label">When</h2>
          {summary.bySlot.length === 0 ? <p className="text-sm text-stone-500">No times picked yet.</p> : (
            <div className="flex flex-wrap gap-2">
              {summary.bySlot.map((s) => <span key={s.slotMinutes} className="chip border border-stone-300 bg-white px-2 py-1 text-sm">{formatSlot(s.slotMinutes)} · {s.memberCount}</span>)}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Members</h2>
        {members.map((m) => {
          const notAvailable = (m as any).availability === "NOT_AVAILABLE" && !m.isViewer;
          const noPrefs = (m as any).availability === "NO_PREFS";
          return (
            <div key={m.user.id} className="card space-y-1">
              <div className="flex items-center justify-between">
                <p className="font-medium">{m.user.displayName ?? m.user.username} {m.isViewer ? <span className="text-xs text-stone-500">(you)</span> : null}</p>
                <p className="text-sm">
                  {notAvailable ? (
                    <span className="text-stone-400">not available</span>
                  ) : m.plan?.slotMinutes != null ? (
                    <>
                      {formatSlot(m.plan.slotMinutes)}{m.plan?.mensa ? ` · ${m.plan.mensa.name}` : ""}
                    </>
                  ) : (
                    <span className="text-stone-400">has not set lunch preferences</span>
                  )}
                </p>
              </div>
              {!notAvailable && (
                m.likes.length ? (
                  <div className="flex flex-wrap gap-1">
                    {m.likes.map((l) => <span key={l.dishId} className="chip bg-stone-100 px-2 py-1" title={l.mensaName}>{SWIPE_LABEL[l.value]} {l.name}</span>)}
                  </div>
                ) : <p className="text-xs text-stone-400">no swipes yet</p>
              )}
              {m.isViewer ? <Link href="/plan" className="text-sm underline">Edit my plan</Link> : null}
            </div>
          );
        })}
      </section>

      <section className="card space-y-2">
        <h2 className="label">Invite by username</h2>
        <InviteForm groupId={group.id} />
      </section>

      <form action={leaveGroup.bind(null, group.id)} className="text-center">
        <button className="text-sm text-stone-500 underline">Leave group</button>
      </form>
    </div>
  );
}
