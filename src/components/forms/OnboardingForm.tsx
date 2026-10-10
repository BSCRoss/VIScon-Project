"use client";

import { useActionState } from "react";
import { saveOnboarding } from "@/lib/actions/onboarding";
import type { ActionResult } from "@/lib/actions/types";
import { FormMessage, SubmitButton } from "@/components/ui";

type MensaOpt = { id: string; name: string };
export type OnboardingProps = {
  mensasByCampus: { campus: string; label: string; mensas: MensaOpt[] }[];
  allergens: { id: number; nameEn: string }[];
  selectedMensaIds: string[];
  selectedAllergenIds: number[];
  vegetarian: boolean;
  vegan: boolean;
};

export function OnboardingForm(p: OnboardingProps) {
  const [state, action] = useActionState<ActionResult | undefined, FormData>(saveOnboarding, undefined);
  return (
    <form action={action} className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Pick your mensas</h2>
        {p.mensasByCampus.map((g) => (
          <div key={g.campus}>
            <p className="label">{g.label}</p>
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
        <h2 className="text-lg font-semibold">Preferences</h2>
        <label className="flex items-center gap-2"><input type="checkbox" name="vegetarian" defaultChecked={p.vegetarian} /> Prefer vegetarian</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="vegan" defaultChecked={p.vegan} /> Prefer vegan</label>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Allergens to flag</h2>
        <div className="grid grid-cols-2 gap-1 text-sm">
          {p.allergens.map((a) => (
            <label key={a.id} className="flex items-center gap-2">
              <input type="checkbox" name="allergenIds" value={a.id} defaultChecked={p.selectedAllergenIds.includes(a.id)} /> {a.id} · {a.nameEn}
            </label>
          ))}
        </div>
      </section>
      <FormMessage state={state} />
      <SubmitButton className="w-full">Save</SubmitButton>
    </form>
  );
}
