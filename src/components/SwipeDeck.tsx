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
  // Allow adjusting any dish's swipe after finishing (and on reload) by tracking local overrides
  const [overrides, setOverrides] = useState<Record<string, number>>({});
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
    // Build a consolidated review list: swipes from this session + already-swiped dishes from props
    const preSwiped = dishes.filter((d) => d.mySwipe !== null);
    const doneMap = new Map(done.map((d) => [d.dish.id, d] as const));
    const combined = [
      ...done.map((d) => d.dish),
      ...preSwiped.filter((d) => !doneMap.has(d.id)),
    ];

    const valueFor = (id: string, fallback: number | null) => {
      if (id in overrides) return overrides[id as keyof typeof overrides]!;
      const d = doneMap.get(id)?.value;
      return d ?? fallback;
    };

    const likesCount = combined.reduce((acc, d) => acc + ((valueFor(d.id, d.mySwipe) ?? 0) > 0 ? 1 : 0), 0);
    const byMensa = new Map<string, number>();
    for (const d of combined) {
      const v = valueFor(d.id, d.mySwipe) ?? 0;
      if (v > 0) byMensa.set(d.mensaName, (byMensa.get(d.mensaName) ?? 0) + 1);
    }

    function changeValue(dishId: string, value: number) {
      // Update local overrides so UI reflects change for any item (session or pre-swiped)
      setOverrides((o) => ({ ...o, [dishId]: value }));
      // Keep done array in sync if it contains this dish (purely cosmetic; overrides already cover it)
      setDone((ds) => ds.map((it) => (it.dish.id === dishId ? { ...it, value } : it)));
      startTransition(async () => {
        const r = await swipe(dishId, value);
        if (!r.ok) setError(r.error);
      });
    }

    return (
      <div className="space-y-4">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold">That&apos;s everything for today</h2>
          {combined.length ? (
            <p className="text-stone-600">
              You liked {likesCount} {likesCount === 1 ? "dish" : "dishes"}
              {byMensa.size ? ` at ${[...byMensa.entries()].map(([m, n]) => `${m} (${n})`).join(", ")}.` : "."}
            </p>
          ) : (
            <p className="text-stone-600">Nothing caught your eye. You can still set a plan.</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Link href="/plan" className="btn-primary">Set time &amp; group</Link>
          <Link href={lastGroupId ? `/groups/${lastGroupId}` : "/groups"} className="btn-secondary">See what your group chose</Link>
        </div>

        {combined.length ? (
          <div className="space-y-3">
            <h3 className="font-semibold">Review your swipes</h3>
            <ul className="space-y-3">
              {combined.map((dish) => {
                const v = valueFor(dish.id, dish.mySwipe) ?? 0;
                return (
                  <li key={dish.id} className="space-y-2">
                    <DishCard dish={dish} flaggedAllergenIds={flaggedAllergenIds} compact swipeValue={v} />
                    <div className="grid grid-cols-4 gap-2">
                      <button onClick={() => changeValue(dish.id, -2)} className={`btn-secondary text-lg ${v === -2 ? "ring-2 ring-stone-400" : ""}`} aria-label="Definitely not">👎👎</button>
                      <button onClick={() => changeValue(dish.id, -1)} className={`btn-secondary text-lg ${v === -1 ? "ring-2 ring-stone-400" : ""}`} aria-label="Not today">👎</button>
                      <button onClick={() => changeValue(dish.id, 1)} className={`btn-secondary text-lg ${v === 1 ? "ring-2 ring-stone-400" : ""}`} aria-label="I want this">👍</button>
                      <button onClick={() => changeValue(dish.id, 2)} className={`btn-secondary text-lg ${v === 2 ? "ring-2 ring-stone-400" : ""}`} aria-label="Definitely this">👍👍</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-col items-center gap-1">
          {done.length ? <button onClick={undo} className="text-sm text-stone-500 underline">Undo last swipe</button> : null}
          {error ? <span className="text-center text-red-600">{error}</span> : null}
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
