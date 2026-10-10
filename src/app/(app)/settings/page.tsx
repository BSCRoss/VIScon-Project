import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { logout } from "@/lib/actions/auth";
import { canRunImport } from "@/lib/actions/admin";
import { RunImportButton } from "@/components/RunImportButton";

export default async function SettingsPage() {
  const user = await requireUser();
  const me = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { mensas: { include: { mensa: true } }, allergens: true } });
  const showDev = await canRunImport(user.username);
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">{me.displayName ?? me.username}</h1>
        <p className="text-sm text-stone-500">@{me.username}</p>
      </header>
      <section className="card space-y-2">
        <p className="label">Your mensas</p>
        <p className="text-sm">{me.mensas.map((m) => m.mensa.name).join(", ") || "none"}</p>
        <p className="label">Preferences</p>
        <p className="text-sm">{[me.vegetarian && "vegetarian", me.vegan && "vegan"].filter(Boolean).join(", ") || "none"} · flagged allergens: {me.allergens.map((a) => a.allergenId).join(", ") || "none"}</p>
        <Link href="/onboarding" className="btn-secondary">Edit mensas &amp; preferences</Link>
      </section>
      <section className="card space-y-2">
        <Link href="/feedback" className="btn-secondary">Give feedback for today</Link>
        <form action={logout}><button className="btn-secondary w-full">Sign out</button></form>
      </section>
      {showDev ? (
        <section className="card space-y-2">
          <p className="label">Developer</p>
          <RunImportButton />
        </section>
      ) : null}
    </div>
  );
}
