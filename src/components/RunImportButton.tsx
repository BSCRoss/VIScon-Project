"use client";

import { useState, useTransition } from "react";
import { runImportAction } from "@/lib/actions/admin";

export function RunImportButton() {
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <button className="btn-secondary" disabled={pending} onClick={() => start(async () => setResult(await runImportAction()))}>
        {pending ? "Importing…" : "Run menu import now"}
      </button>
      {result ? <pre className="max-h-64 overflow-auto rounded bg-stone-100 p-2 text-xs">{result}</pre> : null}
    </div>
  );
}
