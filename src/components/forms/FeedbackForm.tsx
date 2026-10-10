"use client";

import { useActionState, useState } from "react";
import { submitFeedback } from "@/lib/actions/feedback";
import type { ActionResult } from "@/lib/actions/types";
import { QUEUE_LABEL } from "@/lib/labels";
import { formatSlot, slots } from "@/lib/time";
import { FormMessage, SubmitButton } from "@/components/ui";
import { StarRating } from "@/components/StarRating";

export type FeedbackFormProps = {
  mensas: { id: string; name: string }[];
  likedDishes: { id: string; name: string; mensaId: string }[];
  defaultMensaId: string;
  planSlot: number | null;
  existing: { mensaId: string; dishId: string | null; queueBucket: string | null; rating: number; waitMinutes: number | null; wouldAgain: boolean | null; arrivedAt: number | null; comment: string | null } | null;
};

export function FeedbackForm({ mensas, likedDishes, defaultMensaId, planSlot, existing }: FeedbackFormProps) {
  const [state, action] = useActionState<ActionResult | undefined, FormData>(submitFeedback, undefined);
  const [rating, setRating] = useState<number | null>(existing?.rating ?? null);
  return (
    <form action={action} className="space-y-5">
      <label className="block"><span className="label">Where did you eat?</span>
        <select name="mensaId" defaultValue={existing?.mensaId ?? defaultMensaId} className="input" required>
          {mensas.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </label>
      <label className="block"><span className="label">What did you eat? (optional)</span>
        <select name="dishId" defaultValue={existing?.dishId ?? ""} className="input">
          <option value="">— not in my likes —</option>
          {likedDishes.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </label>
      <fieldset>
        <legend className="label">How many people were queueing? <span className="font-normal">(optional)</span></legend>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(QUEUE_LABEL) as (keyof typeof QUEUE_LABEL)[]).map((k) => (
            <label key={k} className="tile"><input type="radio" name="queueBucket" value={k} defaultChecked={existing?.queueBucket === k} className="peer sr-only" /><span className="tile-inner">{QUEUE_LABEL[k]}</span></label>
          ))}
        </div>
      </fieldset>
      <label className="block"><span className="label">How long did you wait? (minutes, optional)</span><input name="waitMinutes" type="number" min={0} max={180} inputMode="numeric" defaultValue={existing?.waitMinutes ?? ""} className="input" /></label>
      <div>
        <p className="label">Rate your dish</p>
        <StarRating value={rating} onChange={setRating} />
      </div>
      <fieldset>
        <legend className="label">Would you eat it again?</legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="tile"><input type="radio" name="wouldAgain" value="yes" defaultChecked={existing?.wouldAgain === true} className="peer sr-only" /><span className="tile-inner">Yes</span></label>
          <label className="tile"><input type="radio" name="wouldAgain" value="no" defaultChecked={existing?.wouldAgain === false} className="peer sr-only" /><span className="tile-inner">No</span></label>
        </div>
      </fieldset>
      <label className="block"><span className="label">When did you actually get there?</span>
        <select name="arrivedAt" defaultValue={existing?.arrivedAt ?? planSlot ?? ""} className="input">
          <option value="">—</option>
          {slots().map((s) => <option key={s} value={s}>{formatSlot(s)}</option>)}
        </select>
      </label>
      <label className="block"><span className="label">Anything else? (optional)</span><textarea name="comment" maxLength={500} rows={2} defaultValue={existing?.comment ?? ""} className="input" /></label>
      <FormMessage state={state} />
      <SubmitButton className="w-full">{existing ? "Update feedback" : "Submit feedback"}</SubmitButton>
    </form>
  );
}
