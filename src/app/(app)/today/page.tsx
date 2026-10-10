import Link from "next/link";
import { requireOnboardedUser } from "@/lib/session";
import { getTodayDishes, getUserPlan } from "@/lib/queries/today";
import { formatDateLong, formatSlot } from "@/lib/time";
import { DishCard } from "@/components/DishCard";

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const user = await requireOnboardedUser();
  const { filter } = await searchParams;
  const [{ today, dishes, flaggedAllergenIds, user: me }, plan] = await Promise.all([getTodayDishes(user.id), getUserPlan(user.id)]);

  const mode = filter ?? (me.vegan ? "vegan" : me.vegetarian ? "vegetarian" : "all");
  const shown = dishes.filter((d) => (mode === "vegan" ? d.isVegan : mode === "vegetarian" ? d.isVegetarian || d.isVegan : true));
  const unswiped = dishes.filter((d) => d.mySwipe === null).length;
  const byMensa = new Map<string, typeof shown>();
  for (const d of shown) byMensa.set(d.mensaName, [...(byMensa.get(d.mensaName) ?? []), d]);

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{formatDateLong(today)}</h1>
          <p className="text-sm text-stone-500">Lunch at your mensas</p>
        </div>
        <Link href="/plan" className="chip border border-stone-300 bg-white px-3 py-2 text-sm">
          {plan?.groupId || plan?.slotMinutes ? `${plan.group?.name ?? "No group"} · ${plan.slotMinutes !== null ? formatSlot(plan.slotMinutes) : "no time"}` : "Set your plan"}
        </Link>
      </header>

      <nav className="flex gap-2 text-sm">
        {(["all", "vegetarian", "vegan"] as const).map((f) => (
          <Link key={f} href={`/today?filter=${f}`} className={`chip px-3 py-1.5 ${mode === f ? "bg-stone-900 text-white" : "border border-stone-300 bg-white"}`}>{f[0].toUpperCase() + f.slice(1)}</Link>
        ))}
      </nav>

      {dishes.length === 0 ? (
        <div className="card text-center text-stone-600">
          <p>No menus yet for today.</p>
          <p className="mt-1 text-sm">Menus are imported each morning. You can trigger an import under <Link href="/settings" className="underline">Me</Link>.</p>
        </div>
      ) : (
        [...byMensa.entries()].map(([mensa, list]) => (
          <section key={mensa} className="space-y-2">
            <h2 className="text-lg font-semibold">{mensa}</h2>
            {list.map((d) => <DishCard key={d.id} dish={d} flaggedAllergenIds={flaggedAllergenIds} compact />)}
          </section>
        ))
      )}

      {unswiped > 0 ? (
        <Link href="/swipe" className="btn-primary fixed bottom-20 left-1/2 -translate-x-1/2 shadow-lg">Swipe through today&apos;s menu ({unswiped})</Link>
      ) : null}
    </div>
  );
}
