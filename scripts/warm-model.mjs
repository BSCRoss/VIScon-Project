// Download + cache the embedding model at image build time (same settings as src/lib/popularity/embed.ts).
import { pipeline, env } from "@huggingface/transformers";
env.cacheDir = process.env.TRANSFORMERS_CACHE ?? ".cache/transformers";
env.allowLocalModels = false;
const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q8" });
const out = await extractor(["warm up"], { pooling: "mean", normalize: true });
console.log("model cached, dims:", out.tolist()[0].length);
