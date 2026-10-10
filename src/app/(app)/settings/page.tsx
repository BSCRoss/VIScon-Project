import Link from "next/link";
import { LogOut, Settings2 } from "lucide-react";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { logout } from "@/lib/actions/auth";
import { canRunImport } from "@/lib/actions/admin";
import { AREA_SHORT, WEEKDAY_LABEL, WEEKDAYS } from "@/lib/area";
import { AppHeader } from "@/components/AppHeader";
import { RunImportButton } from "@/components/RunImportButton";

export default async function SettingsPage() {
  const user = await requireUser();
  const me = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { mensas: { include: { mensa: true } }, allergens: true, weekdays: true } });
  const showDev = await canRunImport(user.username);
  return (
    <div>
      <AppHeader eyebrow="Preferences" title={me.displayName ?? me.username} subtitle={`@${me.username}`} />

      <section className="card mb-4 space-y-4">
        <div>
          <p className="eyebrow mb-1.5">Where you are</p>
          <div className="flex gap-1.5">
            {WEEKDAYS.map((wd) => {
              const a = me.weekdays.find((w) => w.weekday === wd)?.area;
              return <span key={wd} className="chip bg-brand-50 px-2 py-1 text-brand-800">{WEEKDAY_LABEL[wd]} · {a ? AREA_SHORT[a] : "Both"}</span>;
            })}
          </div>
        </div>
        <div>
          <p className="eyebrow mb-1.5">Your mensas</p>
          <p className="text-[14px]">{me.mensas.map((m) => m.mensa.name).join(", ") || "none"}</p>
        </div>
        <div>
          <p className="eyebrow mb-1.5">Diet &amp; allergens</p>
          <p className="text-[14px]">{[me.vegetarian && "vegetarian", me.vegan && "vegan"].filter(Boolean).join(", ") || "no preference"} · flagged: {me.allergens.map((a) => a.allergenId).join(", ") || "none"}</p>
        </div>
        <Link href="/onboarding" className="btn-secondary w-full"><Settings2 size={16} /> Edit preferences</Link>
      </section>

      <section className="card mb-4 space-y-2">
        <Link href="/feedback" className="btn-secondary w-full">Give feedback for today</Link>
        <form action={logout}><button className="btn-ghost w-full"><LogOut size={16} /> Sign out</button></form>
      </section>

      {showDev ? (
        <section className="card space-y-2">
          <p className="eyebrow">Developer</p>
          <RunImportButton />
        </section>
      ) : null}
    </div>
  );
}
