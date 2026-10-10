"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import type { Vote } from "@/lib/useDishVote";

/** Inline like / dislike buttons. Controlled: the parent owns the vote (see useDishVote). Tapping the active one clears it. */
export function QuickVote({ value, onVote, pending }: { value: Vote; onVote: (v: Vote) => void; pending?: boolean }) {
  const liked = value !== null && value > 0;
  const disliked = value !== null && value < 0;
  const toggle = (v: 1 | -1) => onVote(value !== null && Math.sign(value) === v ? null : v);
  return (
    <div className="flex gap-1" aria-label="Quick vote">
      <button type="button" onClick={() => toggle(-1)} disabled={pending} aria-pressed={disliked} aria-label="Not today"
        className={`grid size-8 place-items-center rounded-full border transition ${disliked ? "border-red-200 bg-red-50 text-red-600" : "border-line bg-surface text-muted hover:text-ink"}`}>
        <ThumbsDown size={15} strokeWidth={disliked ? 2.5 : 2} />
      </button>
      <button type="button" onClick={() => toggle(1)} disabled={pending} aria-pressed={liked} aria-label="I want this"
        className={`grid size-8 place-items-center rounded-full border transition ${liked ? "border-brand-200 bg-brand-50 text-brand-700" : "border-line bg-surface text-muted hover:text-ink"}`}>
        <ThumbsUp size={15} strokeWidth={liked ? 2.5 : 2} />
      </button>
    </div>
  );
}
