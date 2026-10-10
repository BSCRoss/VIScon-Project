"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { saveAvailability } from "@/lib/actions/plans";
import { formatSlot } from "@/lib/time";

export type GridSlot = { slotMinutes: number; othersCount: number; names: string[] };

type Props = {
  groupId: string | null;
  slots: GridSlot[];
  othersTotal: number;
  initial: { from: number; to: number } | null;
  fullOverlapSlots: number[];
  decisionSlot: number | null;
};

const ROW = 40; // px, also used to map pointer position → row

/**
 * Doodle/Outlook-style availability picker: press on a row and slide down (or up) to select a window.
 * Left column = your window, right column = how many group members are free in that row.
 * Saves on release. Pointer state lives in refs so touch/mouse sequences never see stale values.
 */
export function AvailabilityGrid({ groupId, slots, othersTotal, initial, fullOverlapSlots, decisionSlot }: Props) {
  const indexOf = (m: number) => slots.findIndex((s) => s.slotMinutes === m);
  const [sel, setSel] = useState<{ a: number; b: number } | null>(() =>
    initial && indexOf(initial.from) >= 0 && indexOf(initial.to) >= 0 ? { a: indexOf(initial.from), b: indexOf(initial.to) } : null,
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [, start] = useTransition();
  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ start: number; pointerId: number } | null>(null);

  // keep in sync when the server sends a new window (e.g. after switching groups)
  useEffect(() => {
    if (initial && indexOf(initial.from) >= 0 && indexOf(initial.to) >= 0) setSel({ a: indexOf(initial.from), b: indexOf(initial.to) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.from, initial?.to]);

  const lo = sel ? Math.min(sel.a, sel.b) : -1;
  const hi = sel ? Math.max(sel.a, sel.b) : -1;

  function rowAt(clientY: number): number {
    const rect = gridRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(slots.length - 1, Math.floor((clientY - rect.top) / ROW)));
  }
  function persist(a: number, b: number) {
    const from = slots[Math.min(a, b)].slotMinutes;
    const to = slots[Math.max(a, b)].slotMinutes;
    setStatus("saving");
    start(async () => {
      const r = await saveAvailability({ groupId, fromMinutes: from, toMinutes: to });
      setStatus(r.ok ? "saved" : "error");
    });
  }
  function clear() {
    setSel(null);
    setStatus("saving");
    start(async () => {
      const r = await saveAvailability({ groupId, fromMinutes: null, toMinutes: null });
      setStatus(r.ok ? "saved" : "error");
    });
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const i = rowAt(e.clientY);
    dragRef.current = { start: i, pointerId: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
    setSel({ a: i, b: i });
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    setSel({ a: d.start, b: rowAt(e.clientY) });
  }
  function onPointerEnd(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    const end = rowAt(e.clientY);
    setSel({ a: d.start, b: end });
    persist(d.start, end);
  }

  return (
    <div className="card p-0" data-testid="availability-grid">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <p className="text-[12px] text-muted">Press and slide to mark when you can start lunch</p>
        <span className="text-[12px] font-medium text-muted" aria-live="polite" data-testid="grid-status">
          {status === "saving" ? "Saving…" : status === "saved" ? <span className="inline-flex items-center gap-1 text-emerald-700"><Check size={14} /> Saved</span> : status === "error" ? <span className="text-red-600">Not saved</span> : null}
        </span>
      </div>
      <div className="grid grid-cols-[56px_1fr_1fr] border-b border-line bg-stone-50 text-[11px] font-semibold uppercase tracking-wide text-muted">
        <div className="px-3 py-2" />
        <div className="px-3 py-2">You</div>
        <div className="px-3 py-2">Group ({othersTotal})</div>
      </div>
      <div
        ref={gridRef}
        className="relative select-none"
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        {slots.map((s, i) => {
          const mine = i >= lo && i <= hi;
          const share = othersTotal ? s.othersCount / othersTotal : 0;
          const full = fullOverlapSlots.includes(s.slotMinutes);
          const agreed = decisionSlot === s.slotMinutes;
          return (
            <div key={s.slotMinutes} data-row={i} className="grid grid-cols-[56px_1fr_1fr] border-b border-line/70 last:border-b-0" style={{ height: ROW }}>
              <div className="flex items-center px-3 text-[12px] tabular-nums text-muted">{formatSlot(s.slotMinutes)}</div>
              <div className="relative border-l border-line/70">
                {mine ? <div className={`absolute inset-x-1.5 inset-y-0.5 bg-brand-600/90 ${i === lo ? "rounded-t-lg" : ""} ${i === hi ? "rounded-b-lg" : ""}`} data-testid="mine-cell" /> : null}
                {mine && i === lo ? <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-white">{formatSlot(slots[lo].slotMinutes)} – {formatSlot(slots[hi].slotMinutes)}</span> : null}
              </div>
              <div className="relative flex items-center border-l border-line/70 px-2" title={s.names.join(", ") || "nobody yet"}>
                <div className="absolute inset-y-0.5 left-1.5 right-1.5 rounded-md bg-brand-600" style={{ opacity: share * 0.75 }} />
                <span className={`relative text-[12px] font-medium tabular-nums ${share > 0.5 ? "text-white" : "text-ink"}`}>{s.othersCount}/{othersTotal}</span>
                {full ? <span className="chip relative ml-auto bg-emerald-100 text-emerald-800">all free</span> : null}
                {agreed ? <span className="chip relative ml-1 bg-brand-700 text-white">agreed</span> : null}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between px-4 py-2.5">
        <p className="text-[12px] text-muted" data-testid="grid-window">{sel ? `Your window: ${formatSlot(slots[lo].slotMinutes)} – ${formatSlot(slots[hi].slotMinutes)}` : "No window yet"}</p>
        {sel ? <button type="button" onClick={clear} className="btn-ghost px-2 py-1 text-[13px]"><X size={14} /> Clear</button> : null}
      </div>
    </div>
  );
}
