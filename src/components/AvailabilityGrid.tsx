"use client";

import { useRef, useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { saveAvailability } from "@/lib/actions/plans";
import { formatSlot } from "@/lib/time";

export type GridSlot = { slotMinutes: number; othersCount: number; names: string[] };

type Props = {
  groupId: string | null;
  slots: GridSlot[];
  othersTotal: number;
  /** selected start slots (minutes) */
  initial: number[];
  fullOverlapSlots: number[];
  decisionSlot: number | null;
};

const ROW = 40; // px, also used to map pointer position → row

/** Group consecutive selected indices into [from,to] index ranges. */
function ranges(selected: Set<number>, count: number): [number, number][] {
  const out: [number, number][] = [];
  let start = -1;
  for (let i = 0; i <= count; i++) {
    const on = i < count && selected.has(i);
    if (on && start < 0) start = i;
    if (!on && start >= 0) { out.push([start, i - 1]); start = -1; }
  }
  return out;
}

/**
 * Doodle/When2meet-style availability picker. Press on a row and slide to paint a window; start on an
 * already-selected row to erase. Several windows are fine (11:00–12:00 and 13:00–14:00). Saves on release.
 */
export function AvailabilityGrid({ groupId, slots, othersTotal, initial, fullOverlapSlots, decisionSlot }: Props) {
  const toIndex = (mins: number[]) => new Set(mins.map((m) => slots.findIndex((s) => s.slotMinutes === m)).filter((i) => i >= 0));
  const [selected, setSelected] = useState<Set<number>>(() => toIndex(initial));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [, start] = useTransition();
  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ start: number; mode: "paint" | "erase"; base: Set<number>; pointerId: number } | null>(null);

  // The user's own gestures are the only source of change for this selection; the component is keyed by group,
  // so we deliberately do NOT re-sync from server props (a stale refresh could wipe a newer local selection).

  function rowAt(clientY: number): number {
    const rect = gridRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(slots.length - 1, Math.floor((clientY - rect.top) / ROW)));
  }
  function applyDrag(end: number): Set<number> {
    const d = dragRef.current!;
    const next = new Set(d.base);
    const [lo, hi] = [Math.min(d.start, end), Math.max(d.start, end)];
    for (let i = lo; i <= hi; i++) { if (d.mode === "paint") next.add(i); else next.delete(i); }
    return next;
  }
  function persist(sel: Set<number>) {
    const mins = [...sel].sort((a, b) => a - b).map((i) => slots[i].slotMinutes);
    setStatus("saving");
    start(async () => {
      const r = await saveAvailability({ groupId, slots: mins });
      setStatus(r.ok ? "saved" : "error");
    });
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const i = rowAt(e.clientY);
    dragRef.current = { start: i, mode: selected.has(i) ? "erase" : "paint", base: new Set(selected), pointerId: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelected(applyDrag(i));
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    setSelected(applyDrag(rowAt(e.clientY)));
  }
  function onPointerEnd(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const next = applyDrag(rowAt(e.clientY));
    dragRef.current = null;
    setSelected(next);
    persist(next);
  }
  function clear() {
    const next = new Set<number>();
    setSelected(next);
    persist(next);
  }

  const rs = ranges(selected, slots.length);
  const starts = new Set(rs.map((r) => r[0]));
  const ends = new Set(rs.map((r) => r[1]));
  const label = rs.map(([a, b]) => `${formatSlot(slots[a].slotMinutes)}–${formatSlot(slots[b].slotMinutes)}`).join(", ");

  return (
    <div className="card p-0" data-testid="availability-grid" style={{ overflowAnchor: "none" }}>
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <p className="text-[12px] text-muted">Press and slide to mark when you can start · slide over a selection to erase</p>
        <span className="text-[12px] font-medium text-muted" aria-live="polite" data-testid="grid-status">
          {status === "saving" ? "Saving…" : status === "saved" ? <span className="inline-flex items-center gap-1 text-emerald-700"><Check size={14} /> Saved</span> : status === "error" ? <span className="text-red-600">Not saved</span> : null}
        </span>
      </div>
      <div className="grid grid-cols-[56px_1fr_1fr] border-b border-line bg-stone-50 text-[11px] font-semibold uppercase tracking-wide text-muted">
        <div className="px-3 py-2" />
        <div className="px-3 py-2">You</div>
        <div className="px-3 py-2">Group ({othersTotal})</div>
      </div>
      <div ref={gridRef} className="relative select-none" style={{ touchAction: "none", overflowAnchor: "none" }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}>
        {slots.map((s, i) => {
          const mine = selected.has(i);
          const share = othersTotal ? s.othersCount / othersTotal : 0;
          const full = fullOverlapSlots.includes(s.slotMinutes);
          const agreed = decisionSlot === s.slotMinutes;
          return (
            <div key={s.slotMinutes} data-row={i} className="grid grid-cols-[56px_1fr_1fr] border-b border-line/70 last:border-b-0" style={{ height: ROW }}>
              <div className="flex items-center px-3 text-[12px] tabular-nums text-muted">{formatSlot(s.slotMinutes)}</div>
              <div className="relative border-l border-line/70">
                {mine ? <div className={`absolute inset-x-1.5 inset-y-0.5 bg-brand-600/90 ${starts.has(i) ? "rounded-t-lg" : ""} ${ends.has(i) ? "rounded-b-lg" : ""}`} data-testid="mine-cell" /> : null}
                {mine && starts.has(i) ? (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-white">
                    {formatSlot(s.slotMinutes)} – {formatSlot(slots[rs.find((r) => r[0] === i)![1]].slotMinutes)}
                  </span>
                ) : null}
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
      {/* fixed height: this bar must not change size while a gesture is in progress, or the page shifts under the finger */}
      <div className="flex h-12 items-center justify-between px-4">
        <p className="text-[12px] text-muted" data-testid="grid-window">{rs.length ? `Your windows: ${label}` : "No window yet"}</p>
        <button type="button" onClick={clear} disabled={!rs.length} className={`btn-ghost px-2 py-1 text-[13px] ${rs.length ? "" : "invisible"}`}><X size={14} /> Clear</button>
      </div>
    </div>
  );
}
