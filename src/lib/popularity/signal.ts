/**
 * The "ground truth" popularity of a dish from what users actually did:
 * swipes (±1/±2 → mean/2) and post-meal ratings ((rating-3)/2), combined by count. Range -1..1.
 */
import { prisma } from "@/lib/db";

export type Signal = { dishId: string; score: number; n: number };

export async function dishSignals(where: { dishIds?: string[] } = {}): Promise<Map<string, Signal>> {
  const dishFilter = where.dishIds ? { dishId: { in: where.dishIds } } : {};
  const [swipes, feedback] = await Promise.all([
    prisma.swipe.groupBy({ by: ["dishId"], where: dishFilter, _avg: { value: true }, _count: { _all: true } }),
    prisma.feedback.groupBy({ by: ["dishId"], where: { dishId: { not: null }, ...(where.dishIds ? { dishId: { in: where.dishIds } } : {}) }, _avg: { rating: true }, _count: { _all: true } }),
  ]);
  const out = new Map<string, Signal>();
  for (const s of swipes) {
    out.set(s.dishId, { dishId: s.dishId, score: (s._avg.value ?? 0) / 2, n: s._count._all });
  }
  for (const f of feedback) {
    if (!f.dishId) continue;
    const r = ((f._avg.rating ?? 3) - 3) / 2;
    const prev = out.get(f.dishId);
    if (!prev) out.set(f.dishId, { dishId: f.dishId, score: r, n: f._count._all });
    else {
      const n = prev.n + f._count._all;
      out.set(f.dishId, { dishId: f.dishId, score: (prev.score * prev.n + r * f._count._all) / n, n });
    }
  }
  return out;
}
