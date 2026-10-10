"use client";

import { useRef, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import type { DishDTO } from "@/lib/queries/today";
import { useDishVote, type Vote } from "@/lib/useDishVote";
import { DishCard } from "./DishCard";

const COMMIT_PX = 80;   // drag distance that counts as a vote
const STRONG_PX = 190;  // drag distance that counts as a double vote
const DECIDE_PX = 8;    // movement before we decide between horizontal drag and vertical scroll

type Zone = 0 | 1 | 2; // none · vote · strong vote
const zoneOf = (dx: number): Zone => (Math.abs(dx) >= STRONG_PX ? 2 : Math.abs(dx) >= COMMIT_PX ? 1 : 0);
/** Haptic detents: a tick entering the vote zone, a double tick entering the strong zone (Android/Chrome; iOS Safari has no vibration API). */
function haptic(zone: Zone) {
  if (!("vibrate" in navigator)) return;
  if (zone === 2) navigator.vibrate([14, 50, 24]);
  else if (zone === 1) navigator.vibrate(10);
}
/** Beyond the strong threshold the card resists, like pushing through a stop. */
function withResistance(dx: number): number {
  const a = Math.abs(dx);
  if (a <= STRONG_PX) return dx;
  return Math.sign(dx) * (STRONG_PX + (a - STRONG_PX) * 0.3);
}

/**
 * A dish card on the overview that can be dragged right (= I want this today) or left (= not today).
 * The card follows the finger, a stamp fades in, and on release it springs back and shows the result.
 * Vertical movement is left to the page so the list still scrolls.
 */
export function SwipeableDishCard({ dish, flaggedAllergenIds }: { dish: DishDTO; flaggedAllergenIds: number[] }) {
  const { value, vote, pending } = useDishVote(dish.id, dish.mySwipe);
  const [dx, setDx] = useState(0);
  const [zone, setZone] = useState<Zone>(0);
  const [settling, setSettling] = useState(false);
  const [flash, setFlash] = useState<Vote>(null);
  const start = useRef<{ x: number; y: number; id: number; mode: "undecided" | "drag" | "scroll" } | null>(null);
  const el = useRef<HTMLDivElement>(null);

  function commit(v: Vote) {
    vote(v);
    setFlash(v);
    window.setTimeout(() => setFlash(null), 900);
    if ("vibrate" in navigator) navigator.vibrate(v && Math.abs(v) === 2 ? [20, 40, 30] : 18);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return; // the vote buttons handle themselves
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, mode: "undecided" };
    setSettling(false);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const s = start.current;
    if (!s || s.id !== e.pointerId || s.mode === "scroll") return;
    const ddx = e.clientX - s.x, ddy = e.clientY - s.y;
    if (s.mode === "undecided") {
      if (Math.abs(ddx) < DECIDE_PX && Math.abs(ddy) < DECIDE_PX) return;
      if (Math.abs(ddy) > Math.abs(ddx)) { s.mode = "scroll"; return; }
      s.mode = "drag";
      el.current?.setPointerCapture(e.pointerId);
    }
    const z = zoneOf(ddx);
    if (z !== zone) { setZone(z); if (z > 0) haptic(z); }
    setDx(ddx);
  }
  function onPointerEnd(e: React.PointerEvent<HTMLDivElement>, cancelled = false) {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    start.current = null;
    if (s.mode !== "drag") return;
    const ddx = e.clientX - s.x;
    const z = cancelled ? 0 : zoneOf(ddx);
    setSettling(true);
    setDx(0);
    setZone(0);
    if (z > 0) commit((Math.sign(ddx) * z) as Vote);
  }

  const vdx = withResistance(dx);
  const progress = Math.max(-1, Math.min(1, vdx / STRONG_PX));
  const stampOpacity = Math.min(1, Math.abs(dx) / COMMIT_PX);
  const right = dx > 0;
  // zone styling: 1 = outlined stamp + light tint, 2 = solid stamp + strong tint + ring (the "very" level)
  const tintBg = zone === 0 ? "transparent" : right ? (zone === 2 ? "rgba(15,118,110,0.18)" : "rgba(15,118,110,0.07)") : zone === 2 ? "rgba(220,38,38,0.18)" : "rgba(220,38,38,0.07)";
  const ringNow = zone === 2 ? (right ? "ring-4 ring-brand-600" : "ring-4 ring-red-500") : zone === 1 ? (right ? "ring-2 ring-brand-300" : "ring-2 ring-red-300") : "";
  const flashClass = flash === null ? "" : flash > 0 ? "animate-vote-right" : "animate-vote-left";
  const flashRing = flash === null ? "" : Math.abs(flash) === 2 ? (flash > 0 ? "ring-4 ring-brand-600" : "ring-4 ring-red-500") : flash > 0 ? "ring-2 ring-brand-400" : "ring-2 ring-red-400";
  const stamp = (side: "right" | "left") => {
    const active = side === "right" ? right : !right;
    const solid = zone === 2;
    const col = side === "right" ? "brand-700" : "red-600";
    return (
      <span
        key={side}
        className={`pointer-events-none absolute left-1/2 top-1/2 rounded-xl border-2 px-3 py-1.5 text-[15px] font-bold uppercase tracking-wide shadow-sm transition-[background-color,color,transform] duration-100 ${solid ? `border-${col} bg-${col} text-white` : `border-${col} bg-white/90 text-${col}`}`}
        style={{ opacity: active ? stampOpacity : 0, transform: `translate(-50%, -50%) rotate(${side === "right" ? -8 : 8}deg) scale(${zone === 2 ? 1.25 : 0.9 + stampOpacity * 0.2})` }}
      >
        {side === "right" ? (zone === 2 ? "Definitely!" : "Want it") : zone === 2 ? "No way" : "Not today"}
      </span>
    );
  };

  return (
    <div
      ref={el}
      data-testid="dish-card"
      className={`relative rounded-2xl ${flashClass} ${flash !== null ? flashRing : ringNow}`}
      style={{
        touchAction: "pan-y",
        transform: `translateX(${vdx}px) rotate(${progress * 4}deg)`,
        transition: settling ? "transform 260ms cubic-bezier(.2,.9,.3,1.3)" : "none",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => onPointerEnd(e)}
      onPointerCancel={(e) => onPointerEnd(e, true)}
      onDragStart={(e) => e.preventDefault()}
      onTransitionEnd={() => setSettling(false)}
    >
      <DishCard dish={dish} flaggedAllergenIds={flaggedAllergenIds} compact vote={{ value, onVote: vote, pending }} />
      {/* tint + stamps while dragging; the "very" zone is unmistakable: solid stamp, strong tint, thick ring */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl transition-colors duration-100" style={{ backgroundColor: tintBg }} />
      {stamp("right")}
      {stamp("left")}
      {/* result toast after release */}
      {flash !== null ? (
        <span className={`pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold text-white shadow animate-pop ${flash > 0 ? "bg-brand-700" : "bg-red-600"}`} data-testid="vote-toast">
          {flash > 0 ? <ThumbsUp size={13} /> : <ThumbsDown size={13} />}
          {flash === 2 ? "Definitely! (double vote)" : flash === 1 ? "Added to your likes" : flash === -1 ? "Skipped" : "No way (double vote)"}
        </span>
      ) : null}
    </div>
  );
}
