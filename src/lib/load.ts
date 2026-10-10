/**
 * Mensa "load" indicator for the Today screen (traffic light).
 *
 * Combines: predicted demand of the day's dishes (lib/popularity, from similar past dishes' votes),
 * groups that committed to the mensa today, plans naming it, and a small stable pseudo-random baseline
 * so the demo has variety. TODO: add the queue-length feedback we collect (Feedback.queueBucket by slot).
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
  const [decisions, plans, demand] = await Promise.all([
    prisma.groupDecision.groupBy({ by: ["mensaId", "slotMinutes"], where: { date, mensaId: { in: mensaIds } }, _count: { _all: true } }),
    prisma.plan.groupBy({ by: ["mensaId"], where: { date, mensaId: { in: mensaIds } }, _count: { _all: true } }),
    prisma.dish.groupBy({ by: ["mensaId"], where: { date, mealTime: "LUNCH", mensaId: { in: mensaIds }, predictedScore: { not: null } }, _max: { predictedScore: true }, _avg: { predictedScore: true } }),
  ]);

  const out: Record<string, MensaLoad> = {};
  for (const id of mensaIds) {
    const baseline = 20 + (hash(`${id}:${dateIso}`) % 25); // 20..44 dummy floor
    const mine = decisions.filter((d) => d.mensaId === id);
    const committedGroups = mine.reduce((n, d) => n + d._count._all, 0);
    const planners = plans.find((p) => p.mensaId === id)?._count._all ?? 0;
    const dm = demand.find((d) => d.mensaId === id);
    // predicted demand: the best dish drives the queue; -1..1 → 0..40 points
    const demandPts = dm?._max.predictedScore != null ? Math.round(((dm._max.predictedScore + 1) / 2) * 40) : 0;
    const score = Math.min(100, baseline + demandPts + committedGroups * 15 + planners * 5);
    const peakFromDecisions = mine.sort((a, b) => b._count._all - a._count._all)[0]?.slotMinutes ?? null;
    const dummyPeak = [12 * 60, 12 * 60 + 15, 12 * 60 + 30][hash(`peak:${id}:${dateIso}`) % 3];
    const level = levelFromScore(score);
    const peakSlot = peakFromDecisions ?? dummyPeak;
    out[id] = { level, label: `${LOAD_LABEL[level]} · peak ${formatSlot(peakSlot)}`, peakSlot, committedGroups, score };
  }
  return out;
}
