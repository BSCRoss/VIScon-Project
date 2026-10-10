"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/today", label: "Today", icon: "🍽️" },
  { href: "/swipe", label: "Swipe", icon: "👆" },
  { href: "/groups", label: "Group", icon: "👥" },
  { href: "/settings", label: "Me", icon: "🙂" },
];

export function BottomNav({ badges }: { badges: Partial<Record<string, number>> }) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <ul className="mx-auto grid max-w-xl grid-cols-4">
        {items.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + "/");
          const badge = badges[it.href];
          return (
            <li key={it.href}>
              <Link href={it.href} className={`relative flex flex-col items-center gap-0.5 py-2 text-xs ${active ? "text-stone-900 font-semibold" : "text-stone-500"}`}>
                <span className="text-lg leading-none" aria-hidden>{it.icon}</span>
                {it.label}
                {badge ? <span className="absolute right-1/4 top-1 rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">{badge}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
