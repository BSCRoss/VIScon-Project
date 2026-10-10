"use client";

import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/lib/actions/types";

export function SubmitButton({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`btn-primary ${className}`}>
      {pending ? "…" : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionResult | undefined }) {
  if (!state) return null;
  if (state.ok) return state.message ? <p className="text-sm text-green-700">{state.message}</p> : null;
  return <p className="text-sm text-red-600" role="alert">{state.error}</p>;
}
