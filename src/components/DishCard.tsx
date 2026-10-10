import Image from "next/image";
import { Flame, Leaf, Snowflake, Sprout, UtensilsCrossed } from "lucide-react";
import type { DishDTO } from "@/lib/queries/today";
import { SWIPE_LABEL } from "@/lib/labels";
import type { Vote } from "@/lib/useDishVote";
import { QuickVote } from "./QuickVote";

export type DishCardProps = {
  dish: DishDTO;
  flaggedAllergenIds?: number[];
  compact?: boolean;
  /** controlled vote UI (from useDishVote); omit for a read-only card */
  vote?: { value: Vote; onVote: (v: Vote) => void; pending?: boolean };
};

export function DishCard({ dish, flaggedAllergenIds = [], compact = false, vote }: DishCardProps) {
  const flagged = dish.allergenIds.filter((a) => flaggedAllergenIds.includes(a));
  const shownVote = vote ? vote.value : dish.mySwipe;
  return (
    <article className={`card overflow-hidden p-0 ${compact ? "flex gap-3 p-3" : ""}`}>
      <div className={`relative shrink-0 overflow-hidden bg-stone-100 ${compact ? "size-[72px] rounded-xl" : "aspect-[16/10] w-full"}`}>
        {dish.imageUrl ? (
          <Image src={compact ? (dish.thumbUrl ?? dish.imageUrl) : dish.imageUrl} alt="" fill sizes={compact ? "72px" : "(max-width: 640px) 100vw, 640px"} className="object-cover" draggable={false} unoptimized referrerPolicy="no-referrer" loading={compact ? "lazy" : "eager"} />
        ) : (
          <div className="flex size-full items-center justify-center text-stone-300" aria-hidden>
            <UtensilsCrossed size={compact ? 22 : 36} strokeWidth={1.5} />
          </div>
        )}
      </div>
      <div className={`min-w-0 flex-1 ${compact ? "" : "p-4"}`}>
        <div className="flex items-start justify-between gap-2">
          <p className="eyebrow truncate">{dish.lineName ?? dish.mensaName}</p>
          {vote ? <QuickVote value={vote.value} onVote={vote.onVote} pending={vote.pending} /> : shownVote ? <span className="text-[13px]" title="Your vote">{SWIPE_LABEL[shownVote]}</span> : null}
        </div>
        <h3 className={`mt-0.5 font-semibold leading-snug tracking-tight ${compact ? "text-[15px]" : "text-[17px]"}`}>{dish.name}</h3>
        {dish.description && !compact ? <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">{dish.description}</p> : null}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {dish.priceStudent !== null ? <span className="text-[13px] font-semibold tabular-nums">CHF {dish.priceStudent.toFixed(2)}</span> : null}
          {dish.isVegan ? <span className="chip bg-emerald-50 text-emerald-700"><Sprout size={11} /> Vegan</span> : dish.isVegetarian ? <span className="chip bg-lime-50 text-lime-700"><Leaf size={11} /> Vegetarian</span> : null}
          {dish.predicted?.label === "popular" ? <span className="chip bg-orange-50 text-orange-700" title={`Predicted from ${dish.predicted.n} similar dishes`}><Flame size={11} /> Likely popular</span> : null}
          {dish.predicted?.label === "unpopular" ? <span className="chip bg-sky-50 text-sky-700" title={`Predicted from ${dish.predicted.n} similar dishes`}><Snowflake size={11} /> Low demand</span> : null}
          {dish.allergenIds.map((a) => (
            <span key={a} className={`chip ${flagged.includes(a) ? "bg-red-50 text-red-700 ring-1 ring-red-200" : "bg-stone-100 text-muted"}`} title={`Allergen ${a}`}>{a}</span>
          ))}
        </div>
      </div>
    </article>
  );
}
