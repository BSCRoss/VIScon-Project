import Image from "next/image";
import { Leaf, Sprout, UtensilsCrossed } from "lucide-react";
import type { DishDTO } from "@/lib/queries/today";
import { SWIPE_LABEL } from "@/lib/labels";

export function DishCard({ dish, flaggedAllergenIds = [], compact = false }: { dish: DishDTO; flaggedAllergenIds?: number[]; compact?: boolean }) {
  const flagged = dish.allergenIds.filter((a) => flaggedAllergenIds.includes(a));
  return (
    <article className={`card overflow-hidden p-0 ${compact ? "flex gap-3 p-3" : ""}`}>
      <div className={`relative shrink-0 overflow-hidden bg-stone-100 ${compact ? "size-[72px] rounded-xl" : "aspect-[16/10] w-full"}`}>
        {dish.imageUrl ? (
          <Image src={dish.imageUrl} alt="" fill sizes={compact ? "72px" : "(max-width: 640px) 100vw, 640px"} className="object-cover" draggable={false} priority={!compact} />
        ) : (
          <div className="flex size-full items-center justify-center text-stone-300" aria-hidden>
            <UtensilsCrossed size={compact ? 22 : 36} strokeWidth={1.5} />
          </div>
        )}
      </div>
      <div className={`min-w-0 flex-1 ${compact ? "" : "p-4"}`}>
        <div className="flex items-start justify-between gap-2">
          <p className="eyebrow truncate">{dish.lineName ?? dish.mensaName}</p>
          {dish.mySwipe ? <span className="text-[13px]" title="Your swipe">{SWIPE_LABEL[dish.mySwipe]}</span> : null}
        </div>
        <h3 className={`mt-0.5 font-semibold leading-snug tracking-tight ${compact ? "text-[15px]" : "text-[17px]"}`}>{dish.name}</h3>
        {dish.description && !compact ? <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">{dish.description}</p> : null}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {dish.priceStudent !== null ? <span className="text-[13px] font-semibold tabular-nums">CHF {dish.priceStudent.toFixed(2)}</span> : null}
          {dish.isVegan ? <span className="chip bg-emerald-50 text-emerald-700"><Sprout size={11} /> Vegan</span> : dish.isVegetarian ? <span className="chip bg-lime-50 text-lime-700"><Leaf size={11} /> Vegetarian</span> : null}
          {dish.allergenIds.map((a) => (
            <span key={a} className={`chip ${flagged.includes(a) ? "bg-red-50 text-red-700 ring-1 ring-red-200" : "bg-stone-100 text-muted"}`} title={`Allergen ${a}`}>{a}</span>
          ))}
        </div>
      </div>
    </article>
  );
}
