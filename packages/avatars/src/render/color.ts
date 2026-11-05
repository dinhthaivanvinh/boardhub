/** Small colour helpers for drawing (pure). */

const parse = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (rgb: number[]) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** Relative brightness 0..1 (simple, good enough to choose ink colours). */
export function luminance(hex: string): number {
  const [r, g, b] = parse(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export const isDark = (hex: string) => luminance(hex) < 0.35;

export function mix(hex: string, with_: string, amount: number): string {
  const a = parse(hex);
  const b = parse(with_);
  return toHex(a.map((v, i) => v + (b[i]! - v) * amount));
}

/** A darker shade for outlines and patterns; on very dark fur, a lighter one so it stays visible. */
export const shade = (hex: string) => (isDark(hex) ? mix(hex, '#ffffff', 0.3) : mix(hex, '#000000', 0.28));

export const INK = '#1f2937';
export const LIGHT_INK = '#f8fafc';
export const inkOn = (background: string) => (isDark(background) ? LIGHT_INK : INK);
