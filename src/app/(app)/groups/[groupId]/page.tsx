import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, UserPlus, Vote } from "lucide-react";
import { requireUser } from "@/lib/session";
import { getGroupToday } from "@/lib/queries/group";
import { leaveGroup } from "@/lib/actions/groups";
import { clearDecision } from "@/lib/actions/decisions";
import { formatDateLong, formatSlot } from "@/lib/time";
import { formatSlotRanges } from "@/lib/slots";
import { SWIPE_LABEL } from "@/lib/labels";
import { AppHeader } from "@/components/AppHeader";
import { InviteForm } from "@/components/forms/GroupForms";
import { VotePanel } from "@/components/VotePanel";
import { endVote } from "@/lib/actions/votes";
import { isDemoDate } from "@/lib/time";

function range(slotsList: number[]): string {
  if (slotsList.length === 0) return "";
  return slotsList.length === 1 ? formatSlot(slotsList[0]) : `${formatSlot(slotsList[0])}–${formatSlot(slotsList[slotsList.length - 1])}`;
}

export default async function GroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const user = await requireUser();
  const { groupId } = await params;
  const data = await getGroupToday(groupId, user.id);
  if (!data) notFound();
  const { group, dateIso, members, memberCount, summary, decision, vote } = data;
  const how = decision?.method === "VOTE_MAJORITY" ? "Decided by majority vote" : decision?.method === "VOTE_DEADLINE" ? "Vote closed 45 min before lunch" : decision?.method === "VOTE_ENDED" ? "Vote ended" : "Committed";

  return (
    <div>
      <AppHeader eyebrow={formatDateLong(dateIso)} title={group.name} subtitle={`${memberCount} ${memberCount === 1 ? "member" : "members"}`} />

      {decision ? (
        <section className="mb-5 rounded-2xl border border-brand-200 bg-brand-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 shrink-0 text-brand-700" size={22} />
            <div className="min-w-0 flex-1">
              <p className="eyebrow text-brand-700">Agreed</p>
              <p className="text-[20px] font-semibold tracking-tight text-brand-800">{decision.mensa.name} · {formatSlot(decision.slotMinutes)}</p>
              <p className="text-[12px] text-brand-700">{how} · {decision.committedBy.displayName ?? decision.committedBy.username}</p>
            </div>
          </div>
          <form action={clearDecision.bind(null, group.id)} className="mt-3 text-right">
            <button className="btn-ghost py-1 text-[13px]">Reopen the vote</button>
          </form>
        </section>
      ) : (
        <section className="card mb-5 space-y-3">
          <div className="flex items-center gap-2">
            <Vote size={18} className="text-muted" />
            <h2 className="section-title">Vote: where and when</h2>
          </div>
          {!summary.allSubmitted ? (
            <p className="text-[13px] text-muted">Still waiting for availability from <span className="font-medium text-ink">{summary.waitingFor.join(", ")}</span> – options use the best overlap so far.</p>
          ) : summary.fullOverlapSlots.length === 0 ? (
            <p className="text-[13px] text-muted">No slot works for everyone yet; options use the best overlap ({range(summary.bestSlots)}). Adjust under <Link href={`/plan?group=${group.id}`} className="font-medium text-brand-700">Plan</Link>.</p>
          ) : (
            <p className="text-[13px] text-muted">Everyone is free <span className="font-semibold text-ink">{range(summary.fullOverlapSlots)}</span>{summary.byMensa[0] ? <> and most want <span className="font-semibold text-ink">{summary.byMensa[0].name}</span></> : null}. Tap an option to vote.</p>
          )}
          {vote.options.length ? (
            <VotePanel groupId={group.id} options={vote.options} memberCount={memberCount} majority={vote.majority} votedCount={vote.votedCount} deadlineMinutes={vote.deadlineMinutes} notVoted={vote.notVoted} demo={isDemoDate()} />
          ) : (
            <p className="text-[13px] text-muted">Nothing to vote on yet: like some dishes and set your availability.</p>
          )}
          {vote.votedCount > 0 ? (
            <form action={endVote.bind(null, group.id)} className="text-right">
              <button className="btn-secondary py-1.5 text-[13px]" data-testid="end-vote">End vote now</button>
            </form>
          ) : null}
        </section>
      )}

      <section className="mb-5">
        <h2 className="section-title mb-2">When</h2>
        <div className="card p-3">
          <div className="flex items-end gap-0.5" style={{ height: 56 }}>
            {summary.availability.map((a) => (
              <div key={a.slotMinutes} className="flex h-full flex-1 flex-col items-center justify-end" title={`${formatSlot(a.slotMinutes)}: ${a.names.join(", ") || "nobody"}`}>
                <div className={`w-full rounded-t-sm ${a.count === memberCount && memberCount > 0 ? "bg-brand-700" : "bg-brand-200"}`} style={{ height: `${memberCount ? (a.count / memberCount) * 100 : 0}%`, minHeight: a.count ? 4 : 0 }} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted"><span>11:00</span><span>12:00</span><span>13:00</span><span>14:00</span></div>
        </div>
      </section>

      <section className="mb-5">
        <h2 className="section-title mb-2">Where</h2>
        {summary.byMensa.length === 0 ? (
          <p className="card text-[14px] text-muted">Nobody has swiped yet.</p>
        ) : (
          <ul className="card divide-y divide-line p-0">
            {summary.byMensa.map((m) => (
              <li key={m.mensaId} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{m.name}</p>
                  {m.topDishes.length ? <p className="truncate text-[12px] text-muted">{m.topDishes.map((d) => d.name).join(" · ")}</p> : null}
                </div>
                <span className="shrink-0 text-[13px] tabular-nums text-muted">{m.memberCount} of {memberCount}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-5">
        <h2 className="section-title mb-2">Members</h2>
        <ul className="card divide-y divide-line p-0">
          {members.map((m) => (
            <li key={m.user.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{m.name} {m.isViewer ? <span className="text-[12px] font-normal text-muted">(you)</span> : null}</p>
                <p className="text-[13px] tabular-nums text-muted">{m.hasAvailability ? formatSlotRanges(m.plan!.slots) : "no window yet"}</p>
              </div>
              {m.likes.length ? (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {m.likes.map((l) => <span key={l.dishId} className="chip bg-stone-100 px-2 py-1 text-ink" title={l.mensaName}>{SWIPE_LABEL[l.value]} {l.name}</span>)}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="card mb-5 space-y-2">
        <div className="flex items-center gap-2"><UserPlus size={16} className="text-muted" /><h2 className="section-title">Invite by username</h2></div>
        <InviteForm groupId={group.id} />
      </section>

      <form action={leaveGroup.bind(null, group.id)} className="text-center">
        <button className="btn-ghost text-[13px] text-muted">Leave group</button>
      </form>
    </div>
  );
}
