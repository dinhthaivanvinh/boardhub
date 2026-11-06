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
  return pick(seedHex, (i) => `${drawId}:${i}`, candidates, n);
}

/**
 * Prizes for the winners of the same draw (e.g. which envelope each person gets, Lì xì): the same
 * algorithm on the prize pool, with HMAC messages `${drawId}:prize:${i}`, so it cannot collide with the
 * winners' picks. Prize i goes to winner i. Added after the first draws; drawWinners is unchanged.
 */
export function drawPrizes(seedHex: string, drawId: string, prizes: readonly string[], n: number): string[] {
  return pick(seedHex, (i) => `${drawId}:prize:${i}`, prizes, n);
}

function pick(
  seedHex: string,
  message: (i: number) => string,
  items: readonly string[],
  n: number,
): string[] {
  const pool = normalizeCandidates(items);
  if (!Number.isInteger(n) || n < 1 || n > pool.length) throw new Error(`cannot draw ${n} of ${pool.length}`);
  const key = hexToBytes(seedHex);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const h = hmac(sha256, key, utf8ToBytes(message(i)));
    let x = 0n;
    for (let b = 0; b < 8; b++) x = (x << 8n) | BigInt(h[b]!);
    const j = Number(x % BigInt(pool.length));
    out.push(pool.splice(j, 1)[0]!);
  }
  return out;
}

export interface DrawRecordForCheck {
  drawId: string;
  commitment: string;
  seed: string;
  candidates: readonly string[];
  n: number;
  winners: readonly string[];
  /** Present when the draw also handed out prizes: the pool, and the prize of each winner. */
  prizes?: readonly string[] | undefined;
  awarded?: readonly string[] | undefined;
}

/** True when the published seed matches the commitment and reproduces exactly the published winners. */
export function verifyDraw(record: DrawRecordForCheck): boolean {
  try {
    if (commitment(record.seed) !== record.commitment) return false;
    const again = drawWinners(record.seed, record.drawId, record.candidates, record.n);
    const same = (a: readonly string[], b: readonly string[]) =>
      a.length === b.length && a.every((x, i) => x === b[i]);
    if (!same(again, record.winners)) return false;
    if (record.prizes === undefined && record.awarded === undefined) return true;
    if (!record.prizes || !record.awarded) return false;
    return same(drawPrizes(record.seed, record.drawId, record.prizes, record.n), record.awarded);
  } catch {
    return false;
  }
}
