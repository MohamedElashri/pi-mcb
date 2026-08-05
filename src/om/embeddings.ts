/**
 * Local semantic embeddings generator using Hugging Face Transformers.
 *
 * Lazy-loads the pipeline so that the heavy transformers library (and its
 * ONNX runtime) is only required if semantic search is actually enabled
 * and actively used by the agent.
 */
import { getAgentDir } from "../core/unified-config.js";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

let pipelinePromise: Promise<any> | null = null;
let currentModel = "";

/**
 * Ensures the Hugging Face transformer pipeline is loaded for the specified model.
 */
async function getPipeline(model: string): Promise<any> {
  if (pipelinePromise && currentModel === model) {
    return pipelinePromise;
  }

  pipelinePromise = (async () => {
    // Dynamic import so @huggingface/transformers isn't loaded into memory
    // unless semantic recall is used.
    const { pipeline, env } = await import("@huggingface/transformers");

    // Configure local cache directory to stay within the Pi agent's domain
    const cacheDir = join(getAgentDir(), "pi-mcb", ".cache", "transformers");
    mkdirSync(cacheDir, { recursive: true });

    env.cacheDir = cacheDir;
    // Disable fetching from remote if we want strict local only, but we must
    // allow remote for the initial download. It caches automatically.

    // We use feature-extraction for embeddings
    const extractor = await pipeline("feature-extraction", model, {
      dtype: "fp32", // Force FP32 for standard vector sizes
    });
    return extractor;
  })();

  currentModel = model;
  return pipelinePromise;
}

/**
 * Generate a dense vector embedding for the given text.
 * @param text The string to embed.
 * @param model The hugging face model ID (e.g. "Xenova/bge-small-en-v1.5").
 * @returns An array of floating point numbers representing the embedding.
 */
export async function embedText(
  text: string,
  model: string,
): Promise<number[]> {
  try {
    const extractor = await getPipeline(model);
    const output = await extractor(text, { pooling: "mean", normalize: true });
    // output.data is a Float32Array; convert to standard array for JSON serialization
    return Array.from(output.data);
  } catch (err) {
    console.error(
      `mcb: failed to generate embedding for text: ${(err as Error).message}`,
    );
    // Reset pipeline promise so we can retry later if the user fixes the model or network
    pipelinePromise = null;
    // We throw so the caller knows it failed and doesn't save a corrupt state.
    throw err;
  }
}

/**
 * Compute the cosine similarity between two dense vectors.
 * Returns a value between -1 and 1, where 1 means identical.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const va = a[i];
    const vb = b[i];
    dotProduct += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
