import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';

/**
 * The public, verifiable draw (docs/office/04 §5, ADR-0006). The same code runs on the server and on the
 * verification page. NEVER change this algorithm: old draws must keep verifying.
 */

/** `sha256(seed)` as hex: published before the draw. */
export function commitment(seedHex: string): string {
  return bytesToHex(sha256(hexToBytes(seedHex)));
}

/** Candidates sorted and without duplicates: the pool every draw starts from. */
export const normalizeCandidates = (candidates: readonly string[]) => [...new Set(candidates)].sort();

/**
 * Picks `n` different winners. For pick i: x = first 8 bytes (big-endian) of HMAC-SHA256(seed, `${drawId}:${i}`),
 * index = x mod (people left in the pool).
 */
export function drawWinners(
  seedHex: string,
  drawId: string,
  candidates: readonly string[],
  n: number,
): string[] {
  const pool = normalizeCandidates(candidates);
  if (!Number.isInteger(n) || n < 1 || n > pool.length) throw new Error(`cannot draw ${n} of ${pool.length}`);
  const key = hexToBytes(seedHex);
  const winners: string[] = [];
  for (let i = 0; i < n; i++) {
    const h = hmac(sha256, key, utf8ToBytes(`${drawId}:${i}`));
    let x = 0n;
    for (let b = 0; b < 8; b++) x = (x << 8n) | BigInt(h[b]!);
    const j = Number(x % BigInt(pool.length));
    winners.push(pool.splice(j, 1)[0]!);
  }
  return winners;
}

export interface DrawRecordForCheck {
  drawId: string;
  commitment: string;
  seed: string;
  candidates: readonly string[];
  n: number;
  winners: readonly string[];
}

/** True when the published seed matches the commitment and reproduces exactly the published winners. */
export function verifyDraw(record: DrawRecordForCheck): boolean {
  try {
    if (commitment(record.seed) !== record.commitment) return false;
    const again = drawWinners(record.seed, record.drawId, record.candidates, record.n);
    return again.length === record.winners.length && again.every((w, i) => w === record.winners[i]);
  } catch {
    return false;
  }
}
