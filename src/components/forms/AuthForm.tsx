"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, register } from "@/lib/actions/auth";
import type { ActionResult } from "@/lib/actions/types";
import { FormMessage, SubmitButton } from "@/components/ui";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [state, action] = useActionState<ActionResult | undefined, FormData>(mode === "login" ? login : register, undefined);
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="label">Username</span>
        <input name="username" required autoComplete="username" autoCapitalize="none" className="input" pattern="[A-Za-z0-9_]{3,24}" />
      </label>
      <label className="block">
        <span className="label">Password</span>
        <input name="password" type="password" required minLength={mode === "register" ? 8 : 1} autoComplete={mode === "login" ? "current-password" : "new-password"} className="input" />
      </label>
      {mode === "register" ? (
        <label className="block">
          <span className="label">Display name <span className="font-normal">(optional)</span></span>
          <input name="displayName" className="input" maxLength={40} />
        </label>
      ) : null}
      <FormMessage state={state} />
      <SubmitButton className="w-full">{mode === "login" ? "Log in" : "Create account"}</SubmitButton>
      <p className="text-center text-[13px] text-muted">
        {mode === "login" ? (<>New here? <Link className="font-medium text-brand-700" href="/register">Create an account</Link></>) : (<>Already have an account? <Link className="font-medium text-brand-700" href="/login">Log in</Link></>)}
      </p>
    </form>
  );
}
