import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { requireOnboardedUser } from "@/lib/session";
import { getDecisionsForUser, getTodayContext, getUserPlan } from "@/lib/queries/today";
import { formatDateLong, formatSlot } from "@/lib/time";
import { AREA_LABEL } from "@/lib/area";
import { AppHeader } from "@/components/AppHeader";
import { DishCard } from "@/components/DishCard";
import { DecisionBanner } from "@/components/DecisionBanner";
import { TrafficLight } from "@/components/TrafficLight";

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const user = await requireOnboardedUser();
  const { filter } = await searchParams;
  const [{ dateIso, area, mensas, dishes, flaggedAllergenIds, loads, user: me }, plan, decisions] = await Promise.all([
    getTodayContext(user.id), getUserPlan(user.id), getDecisionsForUser(user.id),
  ]);

  const mode = filter ?? (me.vegan ? "vegan" : me.vegetarian ? "vegetarian" : "all");
  const shown = dishes.filter((d) => (mode === "vegan" ? d.isVegan : mode === "vegetarian" ? d.isVegetarian || d.isVegan : true));
  const unswiped = dishes.filter((d) => d.mySwipe === null).length;
  const planLabel = plan?.fromMinutes != null && plan?.toMinutes != null
    ? `${plan.group?.name ?? "No group"} · ${formatSlot(plan.fromMinutes)}–${formatSlot(plan.toMinutes)}`
    : "Set your availability";

  return (
    <div>
      <AppHeader
        eyebrow="Lunch"
        title={formatDateLong(dateIso)}
        subtitle={<span className="inline-flex items-center gap-1"><MapPin size={13} /> {area ? AREA_LABEL[area] : "All your mensas"}</span>}
        right={<Link href="/plan" className="pill">{planLabel}</Link>}
      />

      <DecisionBanner decisions={decisions} />

      <nav className="mb-4 flex gap-2">
        {(["all", "vegetarian", "vegan"] as const).map((f) => (
          <Link key={f} href={`/today?filter=${f}`} className={`pill ${mode === f ? "pill-active" : ""}`}>{f[0].toUpperCase() + f.slice(1)}</Link>
        ))}
      </nav>

      {mensas.length === 0 ? (
        <div className="card text-center text-[14px] text-muted">
          None of your mensas are in {area ? AREA_LABEL[area] : "this area"} today. <Link href="/onboarding" className="font-medium text-brand-700">Adjust your mensas</Link>.
        </div>
      ) : dishes.length === 0 ? (
        <div className="card text-center text-[14px] text-muted">
          <p>No menus yet for this day.</p>
          <p className="mt-1">Menus are imported each morning. You can trigger an import under <Link href="/settings" className="font-medium text-brand-700">Me</Link>.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {mensas.map((m) => {
            const list = shown.filter((d) => d.mensaId === m.id);
            const load = loads[m.id];
            return (
              <section key={m.id}>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h2 className="text-[17px] font-semibold tracking-tight">{m.name}</h2>
                  {load ? <TrafficLight level={load.level} label={load.label} /> : null}
                </div>
                {list.length === 0 ? (
                  <p className="text-[13px] text-muted">{dishes.some((d) => d.mensaId === m.id) ? "Nothing matches the filter." : "No menu published for this day."}</p>
                ) : (
                  <div className="space-y-2">{list.map((d) => <DishCard key={d.id} dish={d} flaggedAllergenIds={flaggedAllergenIds} compact />)}</div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {unswiped > 0 ? (
        <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom,0px))] z-10 px-4">
          <Link href="/swipe" className="btn-primary mx-auto flex max-w-xl shadow-lg shadow-brand-700/20">Swipe today&apos;s menu · {unswiped} to go <ArrowRight size={16} /></Link>
        </div>
      ) : null}
    </div>
  );
}
