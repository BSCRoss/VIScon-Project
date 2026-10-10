"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, SlidersHorizontal, Users, UtensilsCrossed } from "lucide-react";

const items = [
  { href: "/today", label: "Today", Icon: UtensilsCrossed },
  { href: "/plan", label: "Plan", Icon: CalendarClock },
  { href: "/groups", label: "Group", Icon: Users },
  { href: "/settings", label: "Preferences", Icon: SlidersHorizontal },
];

export function BottomNav({ badges }: { badges: Partial<Record<string, number>> }) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <ul className="mx-auto grid max-w-xl grid-cols-4">
        {items.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          const badge = badges[href];
          return (
            <li key={href}>
              <Link href={href} className={`relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${active ? "text-brand-700" : "text-muted"}`}>
                <Icon size={22} strokeWidth={active ? 2.25 : 1.75} aria-hidden />
                {label}
                {badge ? <span className="absolute left-1/2 top-1.5 ml-2 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-4 text-white">{badge}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
