import type { ReactNode } from 'react';
import type { Species } from '../catalog';
import { shade } from './color';

export interface Paint {
  body: string;
  accent: string;
  /** Darker (or lighter on dark fur) shade of the body colour. */
  dark: string;
}

/** Where shared parts go, in the 100 × 100 box. Accessories are placed by these, never per species. */
export interface Anchors {
  /** Top of the head, and half its width there. */
  top: number;
  halfWidth: number;
  eyesY: number;
  /** Distance from the centre line to each eye. */
  eyeGap: number;
  noseY: number;
  mouthY: number;
  neckY: number;
}

export interface SpeciesArt {
  anchors: Anchors;
  /** Outline of the head; patterns are clipped to it. */
  head: string;
  /** Drawn behind the head (ears, tufts, eye bumps). */
  back?: (p: Paint) => ReactNode;
  /** Drawn over the head and pattern (muzzle, cheeks, eye patches). */
  front?: (p: Paint) => ReactNode;
  nose: (p: Paint, a: Anchors) => ReactNode;
  /** What is under the eyes and the mouth, to pick a readable ink. */
  eyeGround: (p: Paint) => string;
  mouthGround: (p: Paint) => string;
  /** Belly patch on the shoulders. */
  belly?: number;
}

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;

const BASE: Anchors = { top: 22, halfWidth: 26, eyesY: 47, eyeGap: 10, noseY: 56, mouthY: 61, neckY: 78 };
const PINK = '#f472b6';

const triangleNose = (y: number) => <path d={`M46.5 ${y - 1.5}h7l-3.5 4z`} fill={PINK} />;
const ovalNose = (y: number, color = '#1f2937') => <ellipse cx={50} cy={y} rx={4} ry={2.8} fill={color} />;
const roundEars = (p: Paint, y: number, r: number) => (
  <>
    <circle cx={50 - 22} cy={y} r={r} fill={p.body} />
    <circle cx={50 + 22} cy={y} r={r} fill={p.body} />
    <circle cx={50 - 22} cy={y} r={r * 0.5} fill={p.accent} />
    <circle cx={50 + 22} cy={y} r={r * 0.5} fill={p.accent} />
  </>
);
const whiskers = (p: Paint, y: number) => (
  <g stroke={p.dark} strokeWidth={1} strokeLinecap="round" opacity={0.8}>
    <path d={`M38 ${y}h-12M38 ${y + 3}l-11 2M62 ${y}h12M62 ${y + 3}l11 2`} />
  </g>
);

export const SPECIES_ART: Record<Species, SpeciesArt> = {
  cat: {
    anchors: { ...BASE, noseY: 57, mouthY: 62 },
    head: circle(50, 50, 28),
    back: (p) => (
      <>
        <path d="M24 38L28 12L46 26Z" fill={p.body} />
        <path d="M76 38L72 12L54 26Z" fill={p.body} />
        <path d="M28.5 31L30 18L39 26Z" fill={p.accent} />
        <path d="M71.5 31L70 18L61 26Z" fill={p.accent} />
      </>
    ),
    front: (p) => (
      <>
        <ellipse cx={50} cy={61} rx={10} ry={7} fill={p.accent} />
        {whiskers(p, 59)}
      </>
    ),
    nose: (_p, a) => triangleNose(a.noseY),
    eyeGround: (p) => p.body,
    mouthGround: (p) => p.accent,
  },
  dog: {
    anchors: { ...BASE, noseY: 57, mouthY: 64 },
    head: circle(50, 50, 28),
    front: (p) => (
      <>
        <ellipse cx={24} cy={48} rx={8} ry={16} transform="rotate(18 24 48)" fill={p.dark} />
        <ellipse cx={76} cy={48} rx={8} ry={16} transform="rotate(-18 76 48)" fill={p.dark} />
        <ellipse cx={50} cy={62} rx={13} ry={10} fill={p.accent} />
      </>
    ),
    nose: (_p, a) => ovalNose(a.noseY),
    eyeGround: (p) => p.body,
    mouthGround: (p) => p.accent,
  },
  fox: {
    anchors: { ...BASE, top: 22, eyesY: 45, eyeGap: 11, noseY: 66, mouthY: 70 },
    head: 'M22 46Q22 22 50 22Q78 22 78 46Q78 62 50 78Q22 62 22 46Z',
    back: (p) => (
      <>
        <path d="M23 38L26 6L46 25Z" fill={p.body} />
        <path d="M77 38L74 6L54 25Z" fill={p.body} />
        <path d="M28 30L29 14L39 25Z" fill={p.dark} />
        <path d="M72 30L71 14L61 25Z" fill={p.dark} />
      </>
    ),
    front: (p) => (
      <>
        <path d="M22 48Q36 50 50 78Q30 68 22 48Z" fill={p.accent} />
        <path d="M78 48Q64 50 50 78Q70 68 78 48Z" fill={p.accent} />
        <path d="M40 58Q50 54 60 58Q56 72 50 77Q44 72 40 58Z" fill={p.accent} />
      </>
    ),
    nose: (_p, a) => ovalNose(a.noseY),
    eyeGround: (p) => p.body,
    mouthGround: (p) => p.accent,
  },
  panda: {
    anchors: { ...BASE, eyeGap: 12, noseY: 58, mouthY: 63 },
    head: circle(50, 50, 28),
    back: (p) => (
      <>
        <circle cx={28} cy={27} r={9.5} fill={p.accent} />
        <circle cx={72} cy={27} r={9.5} fill={p.accent} />
      </>
    ),
    front: (p) => (
      <>
        <ellipse cx={38} cy={48} rx={7.5} ry={9.5} transform="rotate(-25 38 48)" fill={p.accent} />
        <ellipse cx={62} cy={48} rx={7.5} ry={9.5} transform="rotate(25 62 48)" fill={p.accent} />
      </>
    ),
    nose: (p, a) => ovalNose(a.noseY, p.accent),
    eyeGround: (p) => p.accent,
    mouthGround: (p) => p.body,
  },
  rabbit: {
    anchors: { ...BASE, top: 25, eyesY: 50, noseY: 58, mouthY: 63, neckY: 79 },
    head: circle(50, 52, 27),
    back: (p) => (
      <>
        <rect x={30} y={-6} width={13} height={38} rx={6.5} transform="rotate(-10 36 26)" fill={p.body} />
        <rect x={57} y={-6} width={13} height={38} rx={6.5} transform="rotate(10 64 26)" fill={p.body} />
        <rect x={33} y={-1} width={7} height={28} rx={3.5} transform="rotate(-10 36 26)" fill={p.accent} />
        <rect x={60} y={-1} width={7} height={28} rx={3.5} transform="rotate(10 64 26)" fill={p.accent} />
      </>
    ),
    front: (p) => (
      <>
        <ellipse cx={36} cy={60} rx={5} ry={3} fill={p.accent} opacity={0.8} />
        <ellipse cx={64} cy={60} rx={5} ry={3} fill={p.accent} opacity={0.8} />
      </>
    ),
    nose: (_p, a) => <ellipse cx={50} cy={a.noseY} rx={2.8} ry={2} fill={PINK} />,
    eyeGround: (p) => p.body,
    mouthGround: (p) => p.body,
  },
  bear: {
    anchors: { ...BASE, eyesY: 46, noseY: 57, mouthY: 63 },
    head: circle(50, 50, 28),
    back: (p) => roundEars(p, 27, 10),
    front: (p) => <ellipse cx={50} cy={61} rx={12} ry={9} fill={p.accent} />,
    nose: (_p, a) => ovalNose(a.noseY),
    eyeGround: (p) => p.body,
    mouthGround: (p) => p.accent,
  },
  penguin: {
    anchors: { ...BASE, eyesY: 45, eyeGap: 9, noseY: 56, mouthY: 66 },
    head: ellipse(50, 50, 29, 28),
    front: (p) => (
      <path
        d="M50 33Q60 27 68 35Q77 47 67 62Q59 72 50 72Q41 72 33 62Q23 47 32 35Q40 27 50 33Z"
        fill={p.accent}
      />
    ),
    nose: (_p, a) => <path d={`M44.5 ${a.noseY - 2}h11l-5.5 8z`} fill="#f59e0b" />,
    eyeGround: (p) => p.accent,
    mouthGround: (p) => p.accent,
    belly: 20,
  },
  frog: {
    anchors: { ...BASE, top: 27, halfWidth: 24, eyesY: 30, eyeGap: 15, noseY: 50, mouthY: 60, neckY: 77 },
    head: ellipse(50, 54, 32, 23),
    back: (p) => (
      <>
        <circle cx={35} cy={31} r={11} fill={p.body} />
        <circle cx={65} cy={31} r={11} fill={p.body} />
        <circle cx={35} cy={30} r={7.5} fill="#f8fafc" />
        <circle cx={65} cy={30} r={7.5} fill="#f8fafc" />
      </>
    ),
    front: (p) => (
      <>
        <ellipse cx={30} cy={60} rx={5} ry={3} fill={p.accent} opacity={0.85} />
        <ellipse cx={70} cy={60} rx={5} ry={3} fill={p.accent} opacity={0.85} />
      </>
    ),
    nose: (p, a) => (
      <g fill={shade(p.body)}>
        <circle cx={46.5} cy={a.noseY} r={1.3} />
        <circle cx={53.5} cy={a.noseY} r={1.3} />
      </g>
    ),
    eyeGround: () => '#f8fafc',
    mouthGround: (p) => p.body,
  },
  owl: {
    anchors: { ...BASE, top: 21, eyeGap: 12, eyesY: 46, noseY: 56, mouthY: 64 },
    head: circle(50, 50, 29),
    back: (p) => (
      <>
        <path d="M23 32L19 10L38 24Z" fill={p.body} />
        <path d="M77 32L81 10L62 24Z" fill={p.body} />
      </>
    ),
    front: (p) => (
      <>
        <circle cx={38} cy={46} r={11} fill={p.accent} />
        <circle cx={62} cy={46} r={11} fill={p.accent} />
      </>
    ),
    nose: (_p, a) => <path d={`M46 ${a.noseY - 3}h8l-4 8z`} fill="#f59e0b" />,
    eyeGround: (p) => p.accent,
    mouthGround: (p) => p.body,
  },
  tiger: {
    anchors: { ...BASE, noseY: 57, mouthY: 62 },
    head: circle(50, 50, 28),
    back: (p) => roundEars(p, 27, 8.5),
    front: (p) => (
      <>
        <ellipse cx={44} cy={61} rx={8} ry={6.5} fill={p.accent} />
        <ellipse cx={56} cy={61} rx={8} ry={6.5} fill={p.accent} />
        {whiskers(p, 59)}
      </>
    ),
    nose: (_p, a) => triangleNose(a.noseY),
    eyeGround: (p) => p.body,
    mouthGround: (p) => p.accent,
  },
};
