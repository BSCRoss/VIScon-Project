/**
 * Group voting on "where + when". Replaces the manual commit:
 *  - every member picks one option (mensa + start slot); changing the vote is allowed until it closes;
 *  - the vote closes by itself when an option has a majority (> half of the members), or
 *    45 minutes before the earliest proposed start (live mode; demo mode ignores the clock), or
 *    when any member ends it ("End vote now"). The winner becomes the GroupDecision – same effect as a commit.
 * Resolution is lazy: resolveGroupVote() runs whenever the group data is read or a vote is cast, so no cron is needed.
 */
import { prisma } from "@/lib/db";
import { appDateString, isDemoDate, zurichNowMinutes, zurichTodayString } from "@/lib/time";

export const VOTE_CLOSE_BEFORE_MIN = 45;

export type Tally = { mensaId: string; slotMinutes: number; count: number; voterIds: string[] };

export function tally(votes: { userId: string; mensaId: string; slotMinutes: number }[]): Tally[] {
  const m = new Map<string, Tally>();
  for (const v of votes) {
    const k = `${v.mensaId}|${v.slotMinutes}`;
    const t = m.get(k) ?? { mensaId: v.mensaId, slotMinutes: v.slotMinutes, count: 0, voterIds: [] };
    t.count++; t.voterIds.push(v.userId); m.set(k, t);
  }
  return [...m.values()].sort((a, b) => b.count - a.count || a.slotMinutes - b.slotMinutes);
}

export function majorityNeeded(memberCount: number): number {
  return Math.floor(memberCount / 2) + 1;
}

/** Deadline in minutes-after-midnight: 45 min before the earliest proposed slot (null without votes). */
export function voteDeadline(votes: { slotMinutes: number }[]): number | null {
  if (votes.length === 0) return null;
  return Math.min(...votes.map((v) => v.slotMinutes)) - VOTE_CLOSE_BEFORE_MIN;
}

/** Resolve the vote for a group/date if a closing condition holds. Returns the decision (new or existing) or null. */
export async function resolveGroupVote(groupId: string, date: Date, opts: { force?: boolean; byUserId?: string } = {}) {
  const existing = await prisma.groupDecision.findUnique({ where: { groupId_date: { groupId, date } } });
  if (existing) return existing;
  const [votes, memberCount] = await Promise.all([
    prisma.groupVote.findMany({ where: { groupId, date } }),
    prisma.groupMember.count({ where: { groupId } }),
  ]);
  if (votes.length === 0) return null;
  const t = tally(votes);
  const top = t[0];
  let method: string | null = null;
  if (top.count >= majorityNeeded(memberCount)) method = "VOTE_MAJORITY";
  else if (opts.force) method = "VOTE_ENDED";
  else {
    const deadline = voteDeadline(votes)!;
    const clockIsReal = !isDemoDate() && appDateString() === zurichTodayString();
    if (clockIsReal && zurichNowMinutes() >= deadline) method = "VOTE_DEADLINE";
  }
  if (!method) return null;
  const committedById = opts.byUserId ?? top.voterIds[0];
  return prisma.groupDecision.create({ data: { groupId, date, mensaId: top.mensaId, slotMinutes: top.slotMinutes, committedById, method } });
}
