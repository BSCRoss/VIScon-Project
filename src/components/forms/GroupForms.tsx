"use client";

import { useActionState } from "react";
import { createGroup, inviteByUsername } from "@/lib/actions/groups";
import type { ActionResult } from "@/lib/actions/types";
import { FormMessage, SubmitButton } from "@/components/ui";

export function CreateGroupForm() {
  const [state, action] = useActionState<ActionResult | undefined, FormData>(createGroup, undefined);
  return (
    <form action={action} className="space-y-3">
      <label className="block"><span className="label">Group name</span><input name="name" required minLength={2} maxLength={40} className="input" placeholder="e.g. Lab lunch" /></label>
      <FormMessage state={state} />
      <SubmitButton className="w-full">Create group</SubmitButton>
    </form>
  );
}

export function InviteForm({ groupId }: { groupId: string }) {
  const [state, action] = useActionState<ActionResult | undefined, FormData>(inviteByUsername, undefined);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="groupId" value={groupId} />
      <div className="flex gap-2">
        <input name="username" required autoCapitalize="none" className="input flex-1" placeholder="username" />
        <SubmitButton>Invite</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
