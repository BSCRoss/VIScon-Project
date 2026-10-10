import { formatSlot, SLOT_STEP } from "./time";

/** "11:00–12:00, 13:00–14:00" from selected start slots. */
export function formatSlotRanges(slots: number[]): string {
  const s = [...new Set(slots)].sort((a, b) => a - b);
  const out: string[] = [];
  let start = -1, prev = -1;
  for (const m of s) {
    if (start < 0) { start = m; prev = m; continue; }
    if (m === prev + SLOT_STEP) { prev = m; continue; }
    out.push(`${formatSlot(start)}–${formatSlot(prev)}`);
    start = m; prev = m;
  }
  if (start >= 0) out.push(`${formatSlot(start)}–${formatSlot(prev)}`);
  return out.join(", ");
}
