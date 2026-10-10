import type { DishDTO } from "@/lib/queries/today";
import { SWIPE_LABEL } from "@/lib/labels";

export function DishCard({ dish, flaggedAllergenIds = [], compact = false }: { dish: DishDTO; flaggedAllergenIds?: number[]; compact?: boolean }) {
  const flagged = dish.allergenIds.filter((a) => flaggedAllergenIds.includes(a));
  return (
    <article className="flex gap-3 rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
      <div className={`${compact ? "size-16" : "size-24"} shrink-0 overflow-hidden rounded-lg bg-stone-100`}>
        {dish.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dish.imageUrl} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="flex size-full items-center justify-center text-2xl text-stone-400">{dish.mensaName[0]}</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-xs uppercase tracking-wide text-stone-500">{dish.lineName ?? dish.mensaName}</p>
          {dish.mySwipe ? <span className="text-sm" title="Your swipe">{SWIPE_LABEL[dish.mySwipe]}</span> : null}
        </div>
        <h3 className="font-semibold leading-tight">{dish.name}</h3>
        {dish.description && !compact ? <p className="mt-0.5 line-clamp-2 text-sm text-stone-600">{dish.description}</p> : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          {dish.priceStudent !== null ? <span className="font-medium">CHF {dish.priceStudent.toFixed(2)}</span> : null}
          {dish.isVegan ? <span className="chip bg-green-100 text-green-800">Vegan</span> : dish.isVegetarian ? <span className="chip bg-lime-100 text-lime-800">Vegetarian</span> : null}
          {dish.allergenIds.map((a) => (
            <span key={a} className={`chip ${flagged.includes(a) ? "bg-red-100 text-red-700 font-semibold" : "bg-stone-100 text-stone-600"}`} title={`Allergen ${a}`}>{a}</span>
          ))}
        </div>
      </div>
    </article>
  );
}
