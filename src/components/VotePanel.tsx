"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Users } from "lucide-react";
import { castVote } from "@/lib/actions/votes";
import { formatSlot } from "@/lib/time";

export type VoteOption = { mensaId: string; mensaName: string; slotMinutes: number; count: number; voters: string[]; mine: boolean };
type Props = {
  groupId: string;
  options: VoteOption[];
  memberCount: number;
  majority: number;
  votedCount: number;
  deadlineMinutes: number | null;
  notVoted: string[];
  demo: boolean;
};

/** Tap an option to vote (tap another to change). Closes itself at majority or 45 min before the earliest option. */
export function VotePanel({ groupId, options, memberCount, majority, votedCount, deadlineMinutes, notVoted, demo }: Props) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function vote(o: VoteOption) {
    const key = `${o.mensaId}|${o.slotMinutes}`;
    setBusy(key);
    start(async () => {
      const r = await castVote(groupId, o.mensaId, o.slotMinutes);
      setMsg(r.ok ? r.message ?? null : r.error);
      setBusy(null);
    });
  }

  return (
    <div className="space-y-3" data-testid="vote-panel">
      <ul className="space-y-2">
        {options.map((o) => {
          const key = `${o.mensaId}|${o.slotMinutes}`;
          const share = memberCount ? o.count / memberCount : 0;
          return (
            <li key={key}>
              <button
                type="button" onClick={() => vote(o)} disabled={pending} aria-pressed={o.mine} data-testid="vote-option"
                className={`relative w-full overflow-hidden rounded-xl border px-3.5 py-3 text-left transition active:scale-[0.99] ${o.mine ? "border-brand-700 bg-brand-50 ring-1 ring-brand-700" : "border-line bg-surface hover:bg-stone-50"}`}
              >
                <div className="absolute inset-y-0 left-0 bg-brand-600/10" style={{ width: `${share * 100}%` }} aria-hidden />
                <div className="relative flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium"><span className="tabular-nums">{formatSlot(o.slotMinutes)}</span> · {o.mensaName}</p>
                    <p className="truncate text-[12px] text-muted">{o.voters.length ? o.voters.join(", ") : "no votes yet"}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {busy === key ? <Loader2 size={16} className="animate-spin text-muted" /> : o.mine ? <Check size={16} className="text-brand-700" /> : null}
                    <span className={`chip px-2 py-1 text-[12px] ${o.count >= majority ? "bg-brand-700 text-white" : "bg-stone-100 text-ink"}`}><Users size={11} /> {o.count}/{memberCount}</span>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-[12px] text-muted" data-testid="vote-status">
        {votedCount}/{memberCount} voted · majority at {majority}
        {deadlineMinutes !== null ? ` · closes automatically at ${formatSlot(Math.max(0, deadlineMinutes))}${demo ? " (clock paused in demo mode)" : ""}` : ""}
        {notVoted.length ? ` · waiting for ${notVoted.join(", ")}` : ""}
      </p>
      {msg ? <p className="text-[13px] font-medium text-brand-700" aria-live="polite">{msg}</p> : null}
    </div>
  );
}
