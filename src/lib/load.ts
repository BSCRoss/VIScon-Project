/**
 * Mensa "load" indicator for the Today screen (traffic light).
 *
 * DUMMY DATA, by design for the first demo: a stable pseudo-random baseline per mensa and date,
 * raised by real signals we already have (groups that committed to that mensa today, plans naming it).
 * TODO: replace the baseline with the queue-length feedback we collect (Feedback.queueBucket by slot).
 */
import { prisma } from "@/lib/db";
import { formatSlot } from "@/lib/time";

export type LoadLevel = "low" | "medium" | "high";
export type MensaLoad = { level: LoadLevel; label: string; peakSlot: number | null; committedGroups: number; score: number };

export const LOAD_LABEL: Record<LoadLevel, string> = { low: "Quiet", medium: "Moderate", high: "Busy" };

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) % 1000;
}

export function levelFromScore(score: number): LoadLevel {
  if (score < 40) return "low";
  if (score < 75) return "medium";
  return "high";
}

export async function getMensaLoads(mensaIds: string[], date: Date): Promise<Record<string, MensaLoad>> {
  if (mensaIds.length === 0) return {};
  const dateIso = date.toISOString().slice(0, 10);
  const [decisions, plans] = await Promise.all([
    prisma.groupDecision.groupBy({ by: ["mensaId", "slotMinutes"], where: { date, mensaId: { in: mensaIds } }, _count: { _all: true } }),
    prisma.plan.groupBy({ by: ["mensaId"], where: { date, mensaId: { in: mensaIds } }, _count: { _all: true } }),
  ]);

  const out: Record<string, MensaLoad> = {};
  for (const id of mensaIds) {
    const baseline = hash(`${id}:${dateIso}`) % 70; // 0..69 dummy
    const mine = decisions.filter((d) => d.mensaId === id);
    const committedGroups = mine.reduce((n, d) => n + d._count._all, 0);
    const planners = plans.find((p) => p.mensaId === id)?._count._all ?? 0;
    const score = Math.min(100, baseline + committedGroups * 15 + planners * 5);
    const peakFromDecisions = mine.sort((a, b) => b._count._all - a._count._all)[0]?.slotMinutes ?? null;
    const dummyPeak = [12 * 60, 12 * 60 + 15, 12 * 60 + 30][hash(`peak:${id}:${dateIso}`) % 3];
    const level = levelFromScore(score);
    const peakSlot = peakFromDecisions ?? dummyPeak;
    out[id] = { level, label: `${LOAD_LABEL[level]} · peak ${formatSlot(peakSlot)}`, peakSlot, committedGroups, score };
  }
  return out;
}
