"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { commitDecision } from "@/lib/actions/decisions";
import type { ActionResult } from "@/lib/actions/types";
import { formatSlot } from "@/lib/time";
import { FormMessage, SubmitButton } from "@/components/ui";

export function CommitForm({ groupId, mensaOptions, slotOptions, suggestion }: {
  groupId: string;
  mensaOptions: { id: string; name: string }[];
  slotOptions: number[];
  suggestion: { slotMinutes: number | null; mensaId: string | null };
}) {
  const [state, action] = useActionState<ActionResult | undefined, FormData>(commitDecision, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="groupId" value={groupId} />
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className="label">Where</span>
          <select name="mensaId" defaultValue={suggestion.mensaId ?? ""} className="input" required>
            {mensaOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
        <label className="block"><span className="label">When</span>
          <select name="slotMinutes" defaultValue={suggestion.slotMinutes ?? ""} className="input" required>
            {slotOptions.map((s) => <option key={s} value={s}>{formatSlot(s)}</option>)}
          </select>
        </label>
      </div>
      <FormMessage state={state} />
      <SubmitButton className="w-full"><CheckCircle2 size={16} /> Commit for the group</SubmitButton>
    </form>
  );
}
