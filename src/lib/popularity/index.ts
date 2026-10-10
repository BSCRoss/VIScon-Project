/**
 * Popularity prediction ("smart demand estimate"):
 *   1. every dish is embedded once (name + line + description) and cached in Postgres;
 *   2. dishes that have real votes (swipes / ratings) are indexed in the vector store with their score;
 *   3. for a dish of the day we take the 10 most similar voted dishes and average their scores,
 *      weighted by similarity → predictedScore in -1..1, predictedN = how many neighbours.
 * No queues needed: it estimates which meals will be in high demand from what people liked before.
 */
import { prisma } from "@/lib/db";
import { dateOnly, mondayOf, addDays } from "@/lib/time";
import { dishText, embedTexts, EMBEDDING_MODEL } from "./embed";
import { dishSignals } from "./signal";
import { backendName, invalidateMemory, nearest, upsertHistory } from "./store";

const K = 10;
const MIN_SIMILARITY = 0.35;

export type PopularityLabel = "popular" | "average" | "unpopular";
export function popularityLabel(score: number | null, n: number | null): PopularityLabel | null {
  if (score === null || n === null || n < 3) return null;
  if (score > 0.3) return "popular";
  if (score < -0.25) return "unpopular";
  return "average";
}

/** Make sure every given dish has a cached embedding; returns dishId → vector. */
export async function ensureEmbeddings(dishIds: string[]): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>();
  if (dishIds.length === 0) return out;
  const cached = await prisma.dishEmbedding.findMany({ where: { dishId: { in: dishIds }, model: EMBEDDING_MODEL } });
  for (const c of cached) out.set(c.dishId, c.vector);
  const missing = await prisma.dish.findMany({ where: { id: { in: dishIds.filter((id) => !out.has(id)) } }, select: { id: true, name: true, lineName: true, description: true } });
  if (missing.length) {
    const texts = missing.map(dishText);
    const vectors = await embedTexts(texts);
    for (const [i, d] of missing.entries()) {
      await prisma.dishEmbedding.upsert({
        where: { dishId: d.id },
        update: { model: EMBEDDING_MODEL, text: texts[i], vector: vectors[i] },
        create: { dishId: d.id, model: EMBEDDING_MODEL, text: texts[i], vector: vectors[i] },
      });
      out.set(d.id, vectors[i]);
    }
  }
  return out;
}

/** Index every dish that has votes into the vector store. */
export async function indexHistory(): Promise<{ indexed: number; backend: string }> {
  const signals = await dishSignals();
  const ids = [...signals.keys()];
  const vectors = await ensureEmbeddings(ids);
  const dishes = await prisma.dish.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, date: true, mensaId: true } });
  await upsertHistory(
    dishes.map((d) => ({ dishId: d.id, vector: vectors.get(d.id)!, score: signals.get(d.id)!.score, n: signals.get(d.id)!.n, name: d.name, date: d.date.toISOString().slice(0, 10), mensaId: d.mensaId })),
  );
  invalidateMemory();
  return { indexed: dishes.length, backend: backendName() };
}

/** Predict and store popularity for the given dishes. */
export async function predictDishes(dishIds: string[]): Promise<{ predicted: number; backend: string }> {
  const vectors = await ensureEmbeddings(dishIds);
  let predicted = 0;
  for (const id of dishIds) {
    const v = vectors.get(id);
    if (!v) continue;
    const nb = (await nearest(v, id, K)).filter((n) => n.similarity >= MIN_SIMILARITY && n.n > 0);
    if (nb.length === 0) {
      await prisma.dish.update({ where: { id }, data: { predictedScore: null, predictedN: 0, predictedAt: new Date() } });
      continue;
    }
    const wsum = nb.reduce((s, n) => s + n.similarity, 0);
    const score = nb.reduce((s, n) => s + n.similarity * n.score, 0) / wsum;
    await prisma.dish.update({ where: { id }, data: { predictedScore: Math.max(-1, Math.min(1, score)), predictedN: nb.length, predictedAt: new Date() } });
    predicted++;
  }
  return { predicted, backend: backendName() };
}

/** Convenience: index history, then predict the whole week containing `anyDayIso`. */
export async function refreshPopularity(anyDayIso: string) {
  const monday = mondayOf(anyDayIso);
  const idx = await indexHistory();
  const week = await prisma.dish.findMany({ where: { date: { gte: dateOnly(monday), lte: dateOnly(addDays(monday, 6)) } }, select: { id: true } });
  const pred = await predictDishes(week.map((d) => d.id));
  return { ...idx, ...pred, week: monday };
}

/** Explain a prediction: the neighbours behind it (for the dev panel / pitch). */
export async function explain(dishId: string) {
  const vectors = await ensureEmbeddings([dishId]);
  const v = vectors.get(dishId);
  if (!v) return [];
  return (await nearest(v, dishId, K)).filter((n) => n.similarity >= MIN_SIMILARITY);
}
