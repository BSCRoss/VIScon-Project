"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useSwipeable } from "react-swipeable";
import { swipe, undoSwipe } from "@/lib/actions/swipes";
import type { DishDTO } from "@/lib/queries/today";
import { DishCard } from "./DishCard";

type Done = { dish: DishDTO; value: number };

/** Right = "I want to eat this today". Long swipes (>200px) count double. Persists optimistically. */
export function SwipeDeck({ dishes, flaggedAllergenIds, lastGroupId }: { dishes: DishDTO[]; flaggedAllergenIds: number[]; lastGroupId?: string | null }) {
  // Freeze the initial unswiped list so server re-renders (after server actions) don't shift the deck and skip items
  const [list] = useState(() => dishes.filter((d) => d.mySwipe === null));
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState<Done[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const current = list[index];

  function commit(value: number) {
    if (!current) return;
    setDone((d) => [...d, { dish: current, value }]);
    setIndex((i) => i + 1);
    startTransition(async () => {
      const r = await swipe(current.id, value);
      if (!r.ok) setError(r.error);
    });
  }
  function undo() {
    const last = done.at(-1);
    if (!last) return;
    setDone((d) => d.slice(0, -1));
    setIndex((i) => i - 1);
    startTransition(async () => { await undoSwipe(last.dish.id); });
  }

  const handlers = useSwipeable({
    onSwipedLeft: (e) => commit(Math.abs(e.deltaX) > 200 ? -2 : -1),
    onSwipedRight: (e) => commit(Math.abs(e.deltaX) > 200 ? 2 : 1),
    preventScrollOnSwipe: true,
    trackMouse: true,
  });

  if (!current) {
    const likes = done.filter((d) => d.value > 0);
    const byMensa = new Map<string, number>();
    for (const l of likes) byMensa.set(l.dish.mensaName, (byMensa.get(l.dish.mensaName) ?? 0) + 1);
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-xl font-semibold">That&apos;s everything for today</h2>
        {likes.length ? (
          <p className="text-stone-600">
            You liked {likes.length} {likes.length === 1 ? "dish" : "dishes"} at {[...byMensa.entries()].map(([m, n]) => `${m} (${n})`).join(", ")}.
          </p>
        ) : (
          <p className="text-stone-600">Nothing caught your eye. You can still set a plan.</p>
        )}
        <div className="flex flex-col gap-2">
          <Link href="/plan" className="btn-primary">Set time &amp; group</Link>
          <Link href={lastGroupId ? `/groups/${lastGroupId}` : "/groups"} className="btn-secondary">See what your group chose</Link>
          {done.length ? <button onClick={undo} className="text-sm text-stone-500 underline">Undo last swipe</button> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-center text-xs text-stone-500">Swipe right = I want to eat this today · {list.length - index} left</p>
      <div {...handlers} className="touch-pan-y select-none">
        <DishCard dish={current} flaggedAllergenIds={flaggedAllergenIds} />
      </div>
      <div className="grid grid-cols-4 gap-2">
        <button onClick={() => commit(-2)} className="btn-secondary text-xl" aria-label="Definitely not">👎👎</button>
        <button onClick={() => commit(-1)} className="btn-secondary text-xl" aria-label="Not today">👎</button>
        <button onClick={() => commit(1)} className="btn-secondary text-xl" aria-label="I want this">👍</button>
        <button onClick={() => commit(2)} className="btn-secondary text-xl" aria-label="Definitely this">👍👍</button>
      </div>
      <div className="flex items-center justify-between text-sm">
        <button onClick={undo} disabled={!done.length} className="text-stone-500 underline disabled:opacity-40">Undo</button>
        {error ? <span className="text-red-600">{error}</span> : null}
      </div>
    </div>
  );
}
