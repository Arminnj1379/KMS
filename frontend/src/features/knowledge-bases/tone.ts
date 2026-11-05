const TONE_COUNT = 6;

/** Stable colour class per knowledge base, so each base keeps its identity across screens. */
export function kbTileClass(seed: string): string {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `tile-${hash % TONE_COUNT}`;
}
