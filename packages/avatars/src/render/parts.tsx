import type { Accessory, Eyes, Mouth, Pattern } from '../catalog';
import { INK } from './color';
import type { Anchors } from './species';

/** Pattern marks in the head area (the caller clips them to the head). */
export function PatternMarks({ pattern, color }: { pattern: Pattern; color: string }) {
  switch (pattern) {
    case 'stripes':
      return (
        <g stroke={color} strokeWidth={3.2} strokeLinecap="round" fill="none">
          <path d="M50 22v9M41 23q2 5 0 9M59 23q-2 5 0 9M20 45h9M21 53h8M80 45h-9M79 53h-8" />
        </g>
      );
    case 'spots':
      return (
        <g fill={color}>
          <circle cx={36} cy={33} r={4} />
          <circle cx={64} cy={30} r={3} />
          <circle cx={71} cy={53} r={4} />
          <circle cx={29} cy={57} r={3} />
          <circle cx={55} cy={25} r={2.5} />
        </g>
      );
    case 'patch':
      return <ellipse cx={63} cy={44} rx={13} ry={12} fill={color} opacity={0.55} />;
    default:
      return null;
  }
}

const star = (cx: number, cy: number, r: number) => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(2)},${(cy + Math.sin(a) * rr).toFixed(2)}`);
  }
  return pts.join(' ');
};

export function EyePair({ eyes, a, ink, detail }: { eyes: Eyes; a: Anchors; ink: string; detail: boolean }) {
  const shine = ink === INK ? '#ffffff' : INK;
  const one = (x: number, kind: Eyes) => {
    const y = a.eyesY;
    switch (kind) {
      case 'happy':
        return (
          <path
            d={`M${x - 4} ${y + 1}Q${x} ${y - 4.5} ${x + 4} ${y + 1}`}
            stroke={ink}
            strokeWidth={2.4}
            fill="none"
            strokeLinecap="round"
          />
        );
      case 'sleepy':
        return (
          <path
            d={`M${x - 4} ${y}Q${x} ${y + 3.5} ${x + 4} ${y}`}
            stroke={ink}
            strokeWidth={2.4}
            fill="none"
            strokeLinecap="round"
          />
        );
      case 'star':
        return (
          <polygon
            points={star(x, y, 5)}
            fill="#facc15"
            stroke={ink}
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
        );
      case 'surprised':
        return (
          <>
            <circle cx={x} cy={y} r={5} fill="#ffffff" stroke={ink} strokeWidth={1.4} />
            <circle cx={x} cy={y} r={2.2} fill={INK} />
          </>
        );
      default:
        return (
          <>
            <circle cx={x} cy={y} r={3.6} fill={ink} />
            {detail && <circle cx={x + 1.2} cy={y - 1.3} r={1.1} fill={shine} />}
          </>
        );
    }
  };
  return (
    <g data-part="eyes">
      {one(50 - a.eyeGap, eyes === 'wink' ? 'round' : eyes)}
      {one(50 + a.eyeGap, eyes === 'wink' ? 'happy' : eyes)}
    </g>
  );
}

export function MouthShape({ mouth, a, ink }: { mouth: Mouth; a: Anchors; ink: string }) {
  const y = a.mouthY;
  const line = { stroke: ink, strokeWidth: 2, fill: 'none', strokeLinecap: 'round' as const };
  switch (mouth) {
    case 'grin':
      return (
        <g data-part="mouth">
          <path d={`M44 ${y - 1}Q50 ${y + 8} 56 ${y - 1}Z`} fill={ink} />
          <path d={`M47 ${y + 3}Q50 ${y + 6.5} 53 ${y + 3}Z`} fill="#fb7185" />
        </g>
      );
    case 'tongue':
      return (
        <g data-part="mouth">
          <path d={`M47.5 ${y + 1}q2.5 7 5 0z`} fill="#fb7185" />
          <path d={`M45 ${y}Q50 ${y + 4.5} 55 ${y}`} {...line} />
        </g>
      );
    case 'o':
      return <circle data-part="mouth" cx={50} cy={y + 1} r={2.4} fill={ink} />;
    case 'cat':
      return <path data-part="mouth" d={`M44 ${y}q3 3.5 6 0q3 3.5 6 0`} {...line} />;
    default:
      return <path data-part="mouth" d={`M45 ${y}Q50 ${y + 5} 55 ${y}`} {...line} />;
  }
}

/** Accessories are placed by the species' anchors, so one drawing fits every animal. */
export function AccessoryShape({ accessory, a, color }: { accessory: Accessory; a: Anchors; color: string }) {
  const { top, halfWidth: w, eyesY: ey, eyeGap: g, neckY } = a;
  const outline = { stroke: 'rgb(0 0 0 / 0.25)', strokeWidth: 1 };
  switch (accessory) {
    case 'cap':
      return (
        <g data-part="accessory">
          <path
            d={`M${50 - w + 3} ${top + 9}Q50 ${top - 14} ${50 + w - 3} ${top + 9}Z`}
            fill={color}
            {...outline}
          />
          <rect x={50} y={top + 6} width={w + 10} height={5} rx={2.5} fill={color} {...outline} />
          <circle cx={50} cy={top - 2.5} r={1.8} fill="#ffffff" opacity={0.8} />
        </g>
      );
    case 'beanie':
      return (
        <g data-part="accessory">
          <path
            d={`M${50 - w} ${top + 10}Q50 ${top - 18} ${50 + w} ${top + 10}Z`}
            fill={color}
            {...outline}
          />
          <rect x={50 - w - 1} y={top + 5} width={2 * w + 2} height={7} rx={3.5} fill={color} {...outline} />
          <circle cx={50} cy={top - 9} r={4.5} fill="#f8fafc" {...outline} />
        </g>
      );
    case 'crown':
      return (
        <path
          data-part="accessory"
          d={`M${50 - 13} ${top + 5}l1 -12l6 7l6 -10l6 10l6 -7l1 12z`}
          fill={color}
          stroke="rgb(0 0 0 / 0.3)"
          strokeWidth={1}
          strokeLinejoin="round"
        />
      );
    case 'glasses':
      return (
        <g data-part="accessory" fill="none" stroke={color} strokeWidth={2.2}>
          <circle cx={50 - g} cy={ey} r={6.5} fill="rgb(255 255 255 / 0.25)" />
          <circle cx={50 + g} cy={ey} r={6.5} fill="rgb(255 255 255 / 0.25)" />
          <path d={`M${50 - g + 6.5} ${ey}h${2 * g - 13}`} />
        </g>
      );
    case 'sunglasses':
      return (
        <g data-part="accessory">
          <rect
            x={50 - g - 7}
            y={ey - 5}
            width={14}
            height={9}
            rx={4}
            fill="#111827"
            stroke={color}
            strokeWidth={1.6}
          />
          <rect
            x={50 + g - 7}
            y={ey - 5}
            width={14}
            height={9}
            rx={4}
            fill="#111827"
            stroke={color}
            strokeWidth={1.6}
          />
          <path d={`M${50 - g + 7} ${ey - 2}h${2 * g - 14}`} stroke={color} strokeWidth={2} />
          <path d={`M${50 - g - 4} ${ey - 3}l3 0`} stroke="#ffffff" strokeWidth={1.2} opacity={0.7} />
        </g>
      );
    case 'bow': {
      const x = 50 + w * 0.62;
      const y = top + 4;
      return (
        <g data-part="accessory" fill={color} {...outline}>
          <path d={`M${x} ${y}l-9 -6v12z`} />
          <path d={`M${x} ${y}l9 -6v12z`} />
          <circle cx={x} cy={y} r={2.8} />
        </g>
      );
    }
    case 'scarf':
      return (
        <g data-part="accessory" fill={color} {...outline}>
          <rect x={25} y={neckY - 5} width={50} height={9} rx={4.5} />
          <rect x={55} y={neckY} width={8} height={14} rx={3} transform={`rotate(-12 59 ${neckY})`} />
        </g>
      );
    case 'headphones':
      return (
        <g data-part="accessory">
          <path
            d={`M${50 - w - 2} ${ey}Q50 ${top - 22} ${50 + w + 2} ${ey}`}
            fill="none"
            stroke={color}
            strokeWidth={4}
            strokeLinecap="round"
          />
          <rect x={50 - w - 6} y={ey - 6} width={8} height={15} rx={3.5} fill={color} {...outline} />
          <rect x={50 + w - 2} y={ey - 6} width={8} height={15} rx={3.5} fill={color} {...outline} />
        </g>
      );
    case 'flower': {
      const x = 50 - w * 0.62;
      const y = top + 3;
      return (
        <g data-part="accessory">
          {[0, 72, 144, 216, 288].map((deg) => (
            <circle
              key={deg}
              cx={x + Math.cos((deg * Math.PI) / 180) * 4}
              cy={y + Math.sin((deg * Math.PI) / 180) * 4}
              r={3.4}
              fill={color}
              {...outline}
            />
          ))}
          <circle cx={x} cy={y} r={2.6} fill="#facc15" />
        </g>
      );
    }
    default:
      return null;
  }
}
