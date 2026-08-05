import { describe, it, expect } from "vitest";
import { cosineSimilarity } from "../src/om/embeddings.js";

describe("cosineSimilarity", () => {
  it("computes exact match as 1", () => {
    const a = [1, 2, 3];
    expect(cosineSimilarity(a, a)).toBeCloseTo(1);
  });

  it("computes orthogonal vectors as 0", () => {
    const a = [1, 0];
    const b = [0, 1];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0);
  });

  it("computes opposite vectors as -1", () => {
    const a = [1, 2, 3];
    const b = [-1, -2, -3];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1);
  });

  it("handles empty arrays or mismatched lengths safely", () => {
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([1], [1, 2])).toBe(0);
  });
});
