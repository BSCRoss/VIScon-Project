"use client";

import Link from "next/link";
import { useActionState } from "react";
import { setPlan } from "@/lib/actions/plans";
import type { ActionResult } from "@/lib/actions/types";
import { formatSlot, slots } from "@/lib/time";
import { FormMessage, SubmitButton } from "@/components/ui";

export type PlanFormProps = {
  groups: { id: string; name: string }[];
  mensas: { id: string; name: string }[];
  current: { groupId: string | null; slotMinutes: number | null; mensaId: string | null };
  slotCounts?: Record<number, number>;
};

export function PlanForm({ groups, mensas, current, slotCounts = {} }: PlanFormProps) {
  const [state, action] = useActionState<ActionResult | undefined, FormData>(setPlan, undefined);
  return (
    <form action={action} className="space-y-6">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Who are you eating with?</h2>
        {groups.length === 0 ? <p className="text-sm text-stone-600">You are not in a group yet. <Link className="underline" href="/groups/new">Create one</Link>.</p> : null}
        <div className="grid grid-cols-2 gap-2">
          {groups.map((g) => (
            <label key={g.id} className="tile">
              <input type="radio" name="groupId" value={g.id} defaultChecked={current.groupId === g.id} className="peer sr-only" />
              <span className="tile-inner">{g.name}</span>
            </label>
          ))}
        </div>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">When do you want to start lunch?</h2>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {slots().map((s) => (
            <label key={s} className="tile shrink-0">
              <input type="radio" name="slotMinutes" value={s} defaultChecked={current.slotMinutes === s} className="peer sr-only" />
              <span className="tile-inner flex-col px-3">
                {formatSlot(s)}
                {slotCounts[s] ? <span className="text-[10px] text-stone-500">{slotCounts[s]} 👥</span> : null}
              </span>
            </label>
          ))}
        </div>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Mensa (optional)</h2>
        <select name="mensaId" defaultValue={current.mensaId ?? ""} className="input">
          <option value="">Decide with the group</option>
          {mensas.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </section>
      <FormMessage state={state} />
      <SubmitButton className="w-full">Save plan</SubmitButton>
    </form>
  );
}
