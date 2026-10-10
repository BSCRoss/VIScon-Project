/**
 * Sentence embeddings for dish texts. Local open-source model via transformers.js (no API key, works offline).
 * Model: all-MiniLM-L6-v2 (384 dims, quantized ~23 MB, downloaded on first use into .cache/transformers).
 */
import path from "node:path";

export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIM = 384;

type Extractor = (texts: string[], opts: { pooling: "mean"; normalize: boolean }) => Promise<{ tolist(): number[][] }>;
let extractorPromise: Promise<Extractor> | null = null;

async function getExtractor(): Promise<Extractor> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const tf = await import("@huggingface/transformers");
      tf.env.cacheDir = process.env.TRANSFORMERS_CACHE ?? path.join(process.cwd(), ".cache", "transformers");
      tf.env.allowLocalModels = false;
      const pipe = await tf.pipeline("feature-extraction", EMBEDDING_MODEL, { dtype: "q8" });
      return pipe as unknown as Extractor;
    })();
  }
  return extractorPromise;
}

/** Text we embed for a dish: name + line + description, lower-cased, whitespace-normalised. */
export function dishText(d: { name: string; lineName?: string | null; description?: string | null }): string {
  return [d.name, d.lineName, d.description].filter(Boolean).join(". ").replace(/\s+/g, " ").trim().toLowerCase();
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const extractor = await getExtractor();
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 32) {
    const res = await extractor(texts.slice(i, i + 32), { pooling: "mean", normalize: true });
    out.push(...res.tolist());
  }
  return out;
}

export function cosine(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s; // vectors are normalised
}
