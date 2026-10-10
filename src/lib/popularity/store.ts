/**
 * Vector store: Qdrant when reachable (QDRANT_URL, optional QDRANT_API_KEY), otherwise an in-process
 * cosine search over the embeddings cached in Postgres. Same interface either way, so the demo never breaks.
 */
import { QdrantClient } from "@qdrant/js-client-rest";
import { prisma } from "@/lib/db";
import { cosine, EMBEDDING_DIM } from "./embed";

export const COLLECTION = "dishes";
export type HistoryPoint = { dishId: string; vector: number[]; score: number; n: number; name: string; date: string; mensaId: string };
export type Neighbour = { dishId: string; similarity: number; score: number; n: number; name: string };

let client: QdrantClient | null | undefined;
let healthy: boolean | undefined;

export async function qdrant(): Promise<QdrantClient | null> {
  if (client !== undefined && healthy !== undefined) return healthy ? client : null;
  const url = process.env.QDRANT_URL ?? "http://127.0.0.1:6333";
  client = new QdrantClient({ url, apiKey: process.env.QDRANT_API_KEY || undefined, checkCompatibility: false });
  try {
    await client.getCollections();
    const have = (await client.getCollections()).collections.some((c) => c.name === COLLECTION);
    if (!have) await client.createCollection(COLLECTION, { vectors: { size: EMBEDDING_DIM, distance: "Cosine" } });
    healthy = true;
  } catch {
    healthy = false;
  }
  return healthy ? client : null;
}

export function backendName(): "qdrant" | "memory" {
  return healthy ? "qdrant" : "memory";
}

/** Qdrant point ids must be integers or UUIDs; derive a stable UUID from the cuid. */
function pointId(dishId: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < dishId.length; i++) { h1 = Math.imul(h1 ^ dishId.charCodeAt(i), 16777619) >>> 0; h2 = Math.imul(h2 ^ dishId.charCodeAt(i), 2246822519) >>> 0; }
  const hex = (h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")).repeat(2);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export async function upsertHistory(points: HistoryPoint[]): Promise<void> {
  const q = await qdrant();
  if (!q || points.length === 0) return;
  for (let i = 0; i < points.length; i += 100) {
    await q.upsert(COLLECTION, {
      wait: true,
      points: points.slice(i, i + 100).map((p) => ({ id: pointId(p.dishId), vector: p.vector, payload: { dishId: p.dishId, score: p.score, n: p.n, name: p.name, date: p.date, mensaId: p.mensaId } })),
    });
  }
}

/** Nearest history dishes (with real votes) to a vector, excluding the dish itself. */
export async function nearest(vector: number[], excludeDishId: string, k = 10): Promise<Neighbour[]> {
  const q = await qdrant();
  if (q) {
    const res = await q.query(COLLECTION, { query: vector, limit: k + 1, with_payload: true });
    return res.points
      .filter((r) => r.payload?.dishId !== excludeDishId)
      .slice(0, k)
      .map((r) => ({ dishId: String(r.payload?.dishId), similarity: r.score, score: Number(r.payload?.score ?? 0), n: Number(r.payload?.n ?? 0), name: String(r.payload?.name ?? "") }));
  }
  // fallback: brute force over cached embeddings of dishes that have votes
  const history = await memoryHistory();
  return history
    .filter((h) => h.dishId !== excludeDishId)
    .map((h) => ({ dishId: h.dishId, similarity: cosine(vector, h.vector), score: h.score, n: h.n, name: h.name }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);
}

let memoryCache: { at: number; rows: HistoryPoint[] } | null = null;
export function invalidateMemory() { memoryCache = null; }

async function memoryHistory(): Promise<HistoryPoint[]> {
  if (memoryCache && Date.now() - memoryCache.at < 60_000) return memoryCache.rows;
  const { dishSignals } = await import("./signal");
  const signals = await dishSignals();
  const ids = [...signals.keys()];
  const rows = ids.length
    ? await prisma.dishEmbedding.findMany({ where: { dishId: { in: ids } }, include: { dish: { select: { name: true, date: true, mensaId: true } } } })
    : [];
  const out = rows.map((r) => ({ dishId: r.dishId, vector: r.vector, score: signals.get(r.dishId)!.score, n: signals.get(r.dishId)!.n, name: r.dish.name, date: r.dish.date.toISOString().slice(0, 10), mensaId: r.dish.mensaId }));
  memoryCache = { at: Date.now(), rows: out };
  return out;
}
