"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { ArrowRight, ThumbsDown, ThumbsUp, Undo2 } from "lucide-react";
import { swipe, undoSwipe } from "@/lib/actions/swipes";
import type { DishDTO } from "@/lib/queries/today";
import { DishCard } from "./DishCard";

type Done = { dish: DishDTO; value: number };

const COMMIT_PX = 90; // drag distance that counts as a swipe
const STRONG_PX = 220; // drag distance that counts as a double swipe

/**
 * Tinder-style deck. The card follows the finger; releasing past COMMIT_PX swipes it (past STRONG_PX = double),
 * releasing earlier snaps it back. Right = "I want to eat this today".
 *
 * The deck tracks *which dish ids* were handled instead of a position index, so it keeps working when the
 * server refreshes the page data after each swipe (the swiped dish disappears from `dishes`).
 */
export function SwipeDeck({ dishes, flaggedAllergenIds, lastGroupId }: { dishes: DishDTO[]; flaggedAllergenIds: number[]; lastGroupId?: string | null }) {
  const [done, setDone] = useState<Done[]>([]);
  const [restored, setRestored] = useState<DishDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ dx: number; dy: number; animating: boolean }>({ dx: 0, dy: 0, animating: false });
  const [, startTransition] = useTransition();
  const startRef = useRef<{ x: number; y: number; id: number } | null>(null);

  const handled = new Set(done.map((d) => d.dish.id));
  const pool = [...restored, ...dishes.filter((d) => !restored.some((r) => r.id === d.id))];
  const remaining = pool.filter((d) => !handled.has(d.id));
  const current = remaining[0];
  const next = remaining[1];

  function commit(value: number) {
    if (!current) return;
    const dish = current;
    setDone((d) => [...d, { dish, value }]);
    setRestored((r) => r.filter((x) => x.id !== dish.id));
    setDrag({ dx: 0, dy: 0, animating: false });
    startTransition(async () => {
      const r = await swipe(dish.id, value);
      if (!r.ok) setError(r.error);
    });
  }
  function flyOut(value: number) {
    // animate off-screen, then commit
    const dir = value > 0 ? 1 : -1;
    setDrag({ dx: dir * 600, dy: 0, animating: true });
    window.setTimeout(() => commit(value), 180);
  }
  function undo() {
    const last = done.at(-1);
    if (!last) return;
    setDone((d) => d.slice(0, -1));
    setRestored((r) => [last.dish, ...r.filter((x) => x.id !== last.dish.id)]);
    startTransition(async () => { await undoSwipe(last.dish.id); });
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (drag.animating) return;
    startRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ dx: 0, dy: 0, animating: false });
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const s = startRef.current;
    if (!s || s.id !== e.pointerId) return;
    setDrag({ dx: e.clientX - s.x, dy: (e.clientY - s.y) * 0.3, animating: false });
  }
  function onPointerCancel(e: React.PointerEvent<HTMLDivElement>) {
    if (!startRef.current || startRef.current.id !== e.pointerId) return;
    startRef.current = null;
    setDrag({ dx: 0, dy: 0, animating: true });
  }
  function onPointerEnd(e: React.PointerEvent<HTMLDivElement>) {
    const s = startRef.current;
    if (!s || s.id !== e.pointerId) return;
    startRef.current = null;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) >= COMMIT_PX) flyOut(Math.sign(dx) * (Math.abs(dx) >= STRONG_PX ? 2 : 1));
    else setDrag({ dx: 0, dy: 0, animating: true }); // snap back
  }

  if (!current) {
    const likes = done.filter((d) => d.value > 0);
    const byMensa = new Map<string, number>();
    for (const l of likes) byMensa.set(l.dish.mensaName, (byMensa.get(l.dish.mensaName) ?? 0) + 1);
    return (
      <div className="card space-y-4 py-8 text-center">
        <h2 className="text-[20px] font-semibold tracking-tight">That&apos;s everything for today</h2>
        <p className="text-[14px] text-muted">
          {likes.length
            ? `You liked ${likes.length} ${likes.length === 1 ? "dish" : "dishes"} at ${[...byMensa.entries()].map(([m, n]) => `${m} (${n})`).join(", ")}.`
            : "Nothing caught your eye. You can still set your availability."}
        </p>
        <div className="flex flex-col gap-2 px-4">
          <Link href="/plan" className="btn-primary">Set when you&apos;re free</Link>
          <Link href={lastGroupId ? `/groups/${lastGroupId}` : "/groups"} className="btn-secondary">See your group</Link>
          {done.length ? <button onClick={undo} className="btn-ghost text-[13px]"><Undo2 size={14} /> Undo last swipe</button> : null}
        </div>
      </div>
    );
  }

  const progress = Math.max(-1, Math.min(1, drag.dx / STRONG_PX));
  const rotate = progress * 10;
  const strong = Math.abs(drag.dx) >= STRONG_PX;
  const past = Math.abs(drag.dx) >= COMMIT_PX;

  return (
    <div className="space-y-4">
      <p className="text-center text-[12px] text-muted">Drag the card · right = I want this · further = definitely · {remaining.length} left</p>
      <div className="relative" style={{ minHeight: 320 }}>
        {next ? (
          <div className="absolute inset-0 scale-[0.96] translate-y-2 opacity-70" aria-hidden>
            <DishCard dish={next} flaggedAllergenIds={flaggedAllergenIds} />
          </div>
        ) : null}
        <div
          data-testid="swipe-card"
          className="relative cursor-grab select-none active:cursor-grabbing"
          style={{
            touchAction: "pan-y",
            transform: `translate(${drag.dx}px, ${drag.dy}px) rotate(${rotate}deg)`,
            transition: drag.animating ? "transform 180ms ease-out" : "none",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerCancel}
          onDragStart={(e) => e.preventDefault()}
          onTransitionEnd={() => setDrag((d) => (d.animating && Math.abs(d.dx) < 1 ? { dx: 0, dy: 0, animating: false } : d))}
        >
          <DishCard dish={current} flaggedAllergenIds={flaggedAllergenIds} />
          <span
            className="pointer-events-none absolute left-4 top-4 rounded-lg border-2 border-brand-700 px-2 py-1 text-[14px] font-bold uppercase tracking-wide text-brand-700"
            style={{ opacity: drag.dx > 0 ? Math.min(1, drag.dx / COMMIT_PX) : 0, transform: "rotate(-12deg)" }}
          >
            {strong ? "Definitely!" : past ? "Want it" : "Want it"}
          </span>
          <span
            className="pointer-events-none absolute right-4 top-4 rounded-lg border-2 border-red-600 px-2 py-1 text-[14px] font-bold uppercase tracking-wide text-red-600"
            style={{ opacity: drag.dx < 0 ? Math.min(1, -drag.dx / COMMIT_PX) : 0, transform: "rotate(12deg)" }}
          >
            {strong ? "No way" : "Not today"}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <button onClick={() => flyOut(-2)} className="btn-secondary text-red-600" aria-label="Definitely not"><ThumbsDown size={18} /><ThumbsDown size={18} /></button>
        <button onClick={() => flyOut(-1)} className="btn-secondary text-red-600" aria-label="Not today"><ThumbsDown size={18} /></button>
        <button onClick={() => flyOut(1)} className="btn-secondary text-brand-700" aria-label="I want this"><ThumbsUp size={18} /></button>
        <button onClick={() => flyOut(2)} className="btn-secondary text-brand-700" aria-label="Definitely this"><ThumbsUp size={18} /><ThumbsUp size={18} /></button>
      </div>
      <div className="flex items-center justify-between text-[13px]">
        <button onClick={undo} disabled={!done.length} className="btn-ghost px-2 py-1 disabled:opacity-40"><Undo2 size={14} /> Undo</button>
        {error ? <span className="text-red-600">{error}</span> : null}
      </div>
      <div className="card flex items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <p className="text-[14px] font-medium">Seen enough?</p>
          <p className="text-[12px] text-muted">Your swipes are saved. Set your time now, finish the rest later.</p>
        </div>
        <Link href="/plan" className="btn-primary shrink-0 py-2">Set my time <ArrowRight size={16} /></Link>
      </div>
    </div>
  );
}
