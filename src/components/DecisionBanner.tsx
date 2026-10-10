import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { formatSlot } from "@/lib/time";

export type DecisionLite = { group: { id: string; name: string }; mensa: { name: string }; slotMinutes: number };

/** "Your group agreed: Polyterrasse at 12:15" – shown on Today once a decision is committed. */
export function DecisionBanner({ decisions }: { decisions: DecisionLite[] }) {
  if (decisions.length === 0) return null;
  return (
    <div className="mb-4 space-y-2">
      {decisions.map((d) => (
        <Link key={d.group.id} href={`/groups/${d.group.id}`} className="flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3">
          <CheckCircle2 className="shrink-0 text-brand-700" size={22} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-brand-800">{d.mensa.name} · {formatSlot(d.slotMinutes)}</p>
            <p className="text-[12px] text-brand-700">Agreed with {d.group.name}</p>
          </div>
          <span className="text-[12px] font-medium text-brand-700">Details →</span>
        </Link>
      ))}
    </div>
  );
}
