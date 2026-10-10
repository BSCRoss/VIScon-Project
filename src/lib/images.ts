/**
 * Dish photo cache. ETH serves 300–650 KB originals; a list shows twenty of them. We download each photo once,
 * resize to two WebP sizes with sharp, and store them in Postgres so /api/img/[dishId] can serve them in ~15 KB
 * with immutable cache headers (works on Vercel: no disk needed, the CDN caches the route response).
 */
import { prisma } from "@/lib/db";
import { userAgent } from "@/lib/importers/types";

export const THUMB_W = 192;  // 72px thumbnails @ up to 2.7x DPR
export const MEDIUM_W = 720; // full-width cards on phones

export async function resizeBoth(buf: Buffer) {
  const sharp = (await import("sharp")).default;
  const img = sharp(buf, { failOn: "none" }).rotate();
  const meta = await img.metadata();
  const [thumb, medium] = await Promise.all([
    img.clone().resize({ width: THUMB_W, height: THUMB_W, fit: "cover", position: "attention" }).webp({ quality: 72 }).toBuffer(),
    img.clone().resize({ width: MEDIUM_W, withoutEnlargement: true }).webp({ quality: 74 }).toBuffer(),
  ]);
  return { thumb, medium, width: meta.width ?? 0, height: meta.height ?? 0 };
}

async function fetchWithTimeout(url: string, ms = 12000): Promise<Buffer | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { headers: { "User-Agent": userAgent() }, signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Cache photos for the given dishes (skips ones already cached). Concurrency 6. */
export async function cacheDishImages(dishIds: string[]): Promise<{ cached: number; failed: number; skipped: number }> {
  const dishes = await prisma.dish.findMany({
    where: { id: { in: dishIds }, imageUrl: { not: null }, image: null },
    select: { id: true, imageUrl: true },
  });
  let cached = 0, failed = 0;
  const queue = [...dishes];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let d = queue.shift(); d; d = queue.shift()) {
        const buf = await fetchWithTimeout(d.imageUrl!);
        if (!buf) { failed++; continue; }
        try {
          const r = await resizeBoth(buf);
          await prisma.dishImage.upsert({ where: { dishId: d.id }, update: r, create: { dishId: d.id, ...r } });
          cached++;
        } catch {
          failed++;
        }
      }
    }),
  );
  return { cached, failed, skipped: dishIds.length - dishes.length };
}

/** URL helpers used by the DTOs. */
export const thumbUrl = (dishId: string) => `/api/img/${dishId}?s=thumb`;
export const mediumUrl = (dishId: string) => `/api/img/${dishId}?s=medium`;
