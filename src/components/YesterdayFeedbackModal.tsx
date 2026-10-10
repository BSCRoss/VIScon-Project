"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { Check, UtensilsCrossed, X } from "lucide-react";
import { submitQuickFeedback } from "@/lib/actions/quickFeedback";
import { StarRating } from "./StarRating";

type DishOpt = { id: string; name: string; imageUrl: string | null };
export type YesterdayPrompt = {
  dateIso: string;
  dateLabel: string;
  /** our best guess of where and what */
  inferred: { mensaId: string; mensaName: string; dishId: string; reason: string };
  /** yesterday's dishes per candidate mensa, inferred mensa first */
  options: { mensaId: string; mensaName: string; dishes: DishOpt[] }[];
  existing: { rating: number; wouldAgain: boolean | null } | null;
  /** demo: show on every page load; live: remember a dismissal per day */
  alwaysShow: boolean;
};

/** "How was yesterday's lunch?" – inferred dish (changeable), stars, would-eat-again. Small × in the corner to dismiss. */
export function YesterdayFeedbackModal({ prompt }: { prompt: YesterdayPrompt }) {
  const key = `gg:yesterday-feedback:${prompt.dateIso}`;
  const [open, setOpen] = useState(false);
  const [dishId, setDishId] = useState(prompt.inferred.dishId);
  const all = prompt.options.flatMap((m) => m.dishes.map((d) => ({ ...d, mensaName: m.mensaName })));
  const dish = all.find((d) => d.id === dishId) ?? all[0];
  const [rating, setRating] = useState<number | null>(prompt.existing?.rating ?? null);
  const [again, setAgain] = useState<boolean | null>(prompt.existing?.wouldAgain ?? null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let dismissed = false;
    try { dismissed = !prompt.alwaysShow && localStorage.getItem(key) === "1"; } catch {}
    if (!dismissed) setOpen(true);
  }, [key, prompt.alwaysShow]);

  function close() {
    setOpen(false);
    try { if (!prompt.alwaysShow) localStorage.setItem(key, "1"); } catch {}
  }
  function submit() {
    if (!rating) { setError("Tap a star first"); return; }
    setError(null);
    start(async () => {
      const r = await submitQuickFeedback({ dishId: dish.id, dateIso: prompt.dateIso, rating, wouldAgain: again });
      if (!r.ok) { setError(r.error); return; }
      setDone(true);
      window.setTimeout(close, 900);
    });
  }
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-4 backdrop-blur-[2px] sm:items-center" role="dialog" aria-modal="true" aria-labelledby="yf-title" data-testid="yesterday-modal">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-surface shadow-2xl animate-pop">
        <button type="button" onClick={close} aria-label="Close" className="absolute right-2.5 top-2.5 z-10 grid size-7 place-items-center rounded-full bg-black/35 text-white backdrop-blur hover:bg-black/50" data-testid="yesterday-close">
          <X size={14} strokeWidth={2.5} />
        </button>
        <div className="relative aspect-[16/9] w-full bg-stone-100">
          {dish.imageUrl ? (
            <Image key={dish.id} src={dish.imageUrl} alt="" fill sizes="(max-width: 640px) 100vw, 384px" className="object-cover" unoptimized referrerPolicy="no-referrer" />
          ) : (
            <div className="flex size-full items-center justify-center text-stone-300"><UtensilsCrossed size={40} strokeWidth={1.5} /></div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-10 text-white">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/80">{prompt.dateLabel} · {dish.mensaName}</p>
            <h2 id="yf-title" className="text-[18px] font-semibold leading-tight">{dish.name}</h2>
          </div>
        </div>
        <div className="space-y-4 p-4">
          {done ? (
            <div className="flex items-center justify-center gap-2 py-6 text-[16px] font-semibold text-brand-700"><Check size={20} /> Thanks, noted!</div>
          ) : (
            <>
              <div>
                <label className="label" htmlFor="yf-dish">What did you eat? <span className="font-normal">· we think {prompt.inferred.mensaName} because {prompt.inferred.reason}</span></label>
                <select id="yf-dish" value={dish.id} onChange={(e) => setDishId(e.target.value)} className="input py-2 text-[14px]" data-testid="yesterday-dish">
                  {prompt.options.map((m) => (
                    <optgroup key={m.mensaId} label={m.mensaName}>
                      {m.dishes.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <p className="label">How was it?</p>
                <StarRating value={rating} onChange={setRating} />
              </div>
              <div>
                <p className="label">Would you eat it again?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setAgain(true)} aria-pressed={again === true} className={`btn-secondary ${again === true ? "border-brand-700 bg-brand-50 text-brand-800 ring-1 ring-brand-700" : ""}`}>Yes</button>
                  <button type="button" onClick={() => setAgain(false)} aria-pressed={again === false} className={`btn-secondary ${again === false ? "border-brand-700 bg-brand-50 text-brand-800 ring-1 ring-brand-700" : ""}`}>No</button>
                </div>
              </div>
              {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
              <button type="button" onClick={submit} disabled={pending} className="btn-primary w-full" data-testid="yesterday-submit">{pending ? "Saving…" : "Send"}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
