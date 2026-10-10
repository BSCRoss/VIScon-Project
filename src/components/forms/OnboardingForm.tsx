"use client";

import { useActionState, useMemo, useState } from "react";
import type { Area } from "@prisma/client";
import { saveOnboarding } from "@/lib/actions/onboarding";
import type { ActionResult } from "@/lib/actions/types";
import { AREA_SHORT, WEEKDAY_LABEL, WEEKDAYS } from "@/lib/area";
import { FormMessage, SubmitButton } from "@/components/ui";

type MensaOpt = { id: string; name: string; area: Area | null };
export type OnboardingProps = {
  mensasByCampus: { campus: string; label: string; area: Area | null; mensas: MensaOpt[] }[];
  allergens: { id: number; nameEn: string }[];
  selectedMensaIds: string[];
  selectedAllergenIds: number[];
  weekdays: Record<number, Area | "OFF">;
  vegetarian: boolean;
  vegan: boolean;
};

const CHOICES: { value: Area | "OFF"; label: string }[] = [
  { value: "ZENTRUM", label: AREA_SHORT.ZENTRUM },
  { value: "HOENGGERBERG", label: AREA_SHORT.HOENGGERBERG },
  { value: "OFF", label: "Off" },
];

export function OnboardingForm(p: OnboardingProps) {
  const [state, action] = useActionState<ActionResult | undefined, FormData>(saveOnboarding, undefined);
  const [weekdays, setWeekdays] = useState<Record<number, Area | "OFF">>(p.weekdays);
  const activeAreas = useMemo(() => new Set(Object.values(weekdays).filter((a): a is Area => a !== "OFF")), [weekdays]);
  // Only propose mensas in the areas the user is actually in; nothing selected yet = show all.
  const groups = p.mensasByCampus.filter((g) => activeAreas.size === 0 || (g.area !== null && activeAreas.has(g.area)));

  return (
    <form action={action} className="space-y-7">
      <section className="space-y-3">
        <div>
          <h2 className="section-title">Where are you each day?</h2>
          <p className="text-[13px] text-muted">Zentrum (HG) or Hönggerberg. Change it any time under Me.</p>
        </div>
        <div className="card divide-y divide-line p-0">
          {WEEKDAYS.map((wd) => (
            <div key={wd} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[14px] font-medium">{WEEKDAY_LABEL[wd]}</span>
              <div className="flex rounded-lg bg-stone-100 p-0.5">
                {CHOICES.map((c) => (
                  <label key={c.value} className="cursor-pointer">
                    <input type="radio" name={`weekday-${wd}`} value={c.value} checked={weekdays[wd] === c.value} onChange={() => setWeekdays((w) => ({ ...w, [wd]: c.value }))} className="peer sr-only" />
                    <span className="block rounded-md px-3 py-1 text-[13px] font-medium text-muted transition peer-checked:bg-surface peer-checked:text-ink peer-checked:shadow-sm">{c.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="section-title">Your mensas</h2>
          <p className="text-[13px] text-muted">{activeAreas.size ? "Showing mensas in the areas you picked." : "Pick your weekdays above to narrow this down."}</p>
        </div>
        {groups.map((g) => (
          <div key={g.campus}>
            <p className="eyebrow mb-1.5">{g.label}</p>
            <div className="grid grid-cols-2 gap-2">
              {g.mensas.map((m) => (
                <label key={m.id} className="tile">
                  <input type="checkbox" name="mensaIds" value={m.id} defaultChecked={p.selectedMensaIds.includes(m.id)} className="peer sr-only" />
                  <span className="tile-inner">{m.name}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="section-title">Diet</h2>
        <div className="card flex gap-6 py-3">
          <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" name="vegetarian" defaultChecked={p.vegetarian} className="accent-brand-700" /> Vegetarian</label>
          <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" name="vegan" defaultChecked={p.vegan} className="accent-brand-700" /> Vegan</label>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="section-title">Allergens to flag</h2>
        <div className="card grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
          {p.allergens.map((a) => (
            <label key={a.id} className="flex items-center gap-2">
              <input type="checkbox" name="allergenIds" value={a.id} defaultChecked={p.selectedAllergenIds.includes(a.id)} className="accent-brand-700" /> <span className="text-muted tabular-nums">{a.id}</span> {a.nameEn}
            </label>
          ))}
        </div>
      </section>

      <FormMessage state={state} />
      <SubmitButton className="w-full">Save</SubmitButton>
    </form>
  );
}
