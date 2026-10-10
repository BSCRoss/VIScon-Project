"use client";

import { useState } from "react";
import { Star } from "lucide-react";

const WORDS = ["", "Poor", "Meh", "Okay", "Good", "Excellent"];

/** Five tappable stars. Renders a hidden input so it works inside plain forms. */
export function StarRating({ name = "rating", value, onChange, size = 34 }: { name?: string; value: number | null; onChange?: (v: number) => void; size?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => onChange?.(n)} onMouseEnter={() => setHover(n)}
            className="rounded-md p-0.5 transition active:scale-90"
          >
            <Star size={size} strokeWidth={1.6} className={`transition-colors ${n <= shown ? "fill-amber-400 text-amber-400" : "text-stone-300"}`} />
          </button>
        ))}
      </div>
      <span className="min-w-16 text-[13px] font-medium text-muted">{WORDS[shown]}</span>
      <input type="hidden" name={name} value={value ?? ""} />
    </div>
  );
}
