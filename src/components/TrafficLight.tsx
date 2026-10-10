import type { LoadLevel } from "@/lib/load";

const COLOR: Record<LoadLevel, string> = { low: "bg-emerald-500", medium: "bg-amber-500", high: "bg-red-500" };
const TEXT: Record<LoadLevel, string> = { low: "text-emerald-700", medium: "text-amber-700", high: "text-red-700" };

/** Mensa load indicator. Data is a dummy model for now (see lib/load.ts). */
export function TrafficLight({ level, label }: { level: LoadLevel; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${TEXT[level]}`} title="Expected load (demo data)">
      <span className="relative flex size-2.5">
        {level === "high" ? <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 ${COLOR[level]}`} /> : null}
        <span className={`relative inline-flex size-2.5 rounded-full ${COLOR[level]}`} />
      </span>
      {label}
    </span>
  );
}
