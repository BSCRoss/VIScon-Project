"use client";

import { useState, useTransition } from "react";
import { swipe, undoSwipe } from "@/lib/actions/swipes";

export type Vote = 2 | 1 | -1 | -2 | null;

/** One place for "what did I vote on this dish": optimistic local state + the server action. */
export function useDishVote(dishId: string, initial: number | null) {
  const [value, setValue] = useState<Vote>((initial as Vote) ?? null);
  const [pending, start] = useTransition();
  function vote(next: Vote) {
    setValue(next);
    start(async () => {
      const r = next === null ? await undoSwipe(dishId) : await swipe(dishId, next);
      if (!r.ok) setValue((initial as Vote) ?? null);
    });
  }
  return { value, vote, pending };
}
