/** Small seeded PRNG (mulberry32) so runs are reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashSeed(...n: number[]): number {
  let h = 2166136261;
  for (const v of n) { h ^= v | 0; h = Math.imul(h, 16777619); h ^= h >>> 13; }
  return h >>> 0;
}
