"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import type { ActionResult } from "@/lib/actions/types";

export function SubmitButton({ children, className = "", variant = "primary" }: { children: React.ReactNode; className?: string; variant?: "primary" | "secondary" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${variant === "primary" ? "btn-primary" : "btn-secondary"} ${className}`}>
      {pending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionResult | undefined }) {
  if (!state) return null;
  if (state.ok) return state.message ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">{state.message}</p> : null;
  return <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700" role="alert">{state.error}</p>;
}
