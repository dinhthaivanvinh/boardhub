import type { CSSProperties } from 'react';
import { shortVnd } from '../money';
import type { LiXiStep } from './timeline';
import { noteColours } from './view';

/**
 * The red envelope and what is inside. Driven by `step` (data-step in CSS): flies in, shakes, the flap
 * opens and the note slides out. `t` (ms into the step) lets a screen that opens mid-step catch up.
 * The note is a stylised drawing (colour, amount, apricot blossom), not a picture of real money.
 */
export function Envelope({
  step,
  t,
  value,
  big = false,
}: {
  step: LiXiStep;
  t: number;
  /** 0 = a wish instead of money. */
  value: number;
  big?: boolean;
}) {
  return (
    <div
      className={big ? 'lixi-envelope lixi-envelope-big' : 'lixi-envelope'}
      data-step={step}
      data-testid="li-xi-envelope"
      style={{ '--t': `${-Math.round(t)}ms` } as CSSProperties}
      aria-hidden="true"
    >
      <div className="lixi-envelope-inner">
        <div className="lixi-note-slot">{value > 0 ? <Note value={value} /> : <WishScroll />}</div>
        <div className="lixi-envelope-body">
          <svg viewBox="0 0 120 160" className="lixi-envelope-svg">
            <defs>
              <linearGradient id="lixi-red" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#ef4444" />
                <stop offset="1" stopColor="#b91c1c" />
              </linearGradient>
            </defs>
            <rect
              x="2"
              y="2"
              width="116"
              height="156"
              rx="10"
              fill="url(#lixi-red)"
              stroke="#facc15"
              strokeWidth="4"
            />
            <rect
              x="10"
              y="10"
              width="100"
              height="140"
              rx="6"
              fill="none"
              stroke="#fde68a"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            <circle cx="60" cy="96" r="24" fill="#fef3c7" stroke="#facc15" strokeWidth="3" />
            <g transform="translate(60 96)">
              {[0, 72, 144, 216, 288].map((a) => (
                <ellipse key={a} cx="0" cy="-9" rx="7" ry="9" fill="#facc15" transform={`rotate(${a})`} />
              ))}
              <circle r="4" fill="#dc2626" />
            </g>
            <path d="M14 132 q46 -16 92 0" stroke="#fde68a" strokeWidth="2" fill="none" />
          </svg>
        </div>
        <div className="lixi-envelope-flap">
          <svg viewBox="0 0 120 60">
            <path
              d="M2 2 H118 L60 56 Z"
              fill="#dc2626"
              stroke="#facc15"
              strokeWidth="4"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

/** A stylised note: its colour, the amount and a blossom. */
export function Note({ value, small = false }: { value: number; small?: boolean }) {
  const c = noteColours(value);
  return (
    <svg viewBox="0 0 200 96" className={small ? 'lixi-note lixi-note-small' : 'lixi-note'}>
      <rect x="2" y="2" width="196" height="92" rx="8" fill={c.paper} stroke={c.edge} strokeWidth="3" />
      <rect
        x="10"
        y="10"
        width="180"
        height="76"
        rx="5"
        fill="none"
        stroke={c.edge}
        strokeWidth="1"
        opacity="0.6"
      />
      <g transform="translate(48 48)" opacity="0.85">
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse
            key={a}
            cx="0"
            cy="-12"
            rx="9"
            ry="12"
            fill={c.edge}
            opacity="0.55"
            transform={`rotate(${a})`}
          />
        ))}
        <circle r="6" fill={c.ink} opacity="0.7" />
      </g>
      <text
        x="186"
        y="60"
        textAnchor="end"
        fontSize="34"
        fontWeight="900"
        fill={c.ink}
        fontFamily="system-ui"
      >
        {shortVnd(value)}
      </text>
      <text
        x="186"
        y="80"
        textAnchor="end"
        fontSize="11"
        fontWeight="700"
        fill={c.ink}
        fontFamily="system-ui"
        opacity="0.7"
      >
        VND
      </text>
    </svg>
  );
}

function WishScroll() {
  return (
    <svg viewBox="0 0 200 96" className="lixi-note">
      <rect x="10" y="6" width="180" height="84" rx="4" fill="#fef3c7" stroke="#ca8a04" strokeWidth="2" />
      <rect x="2" y="2" width="12" height="92" rx="6" fill="#b91c1c" />
      <rect x="186" y="2" width="12" height="92" rx="6" fill="#b91c1c" />
      <g transform="translate(100 48)">
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse key={a} cx="0" cy="-13" rx="9" ry="13" fill="#facc15" transform={`rotate(${a})`} />
        ))}
        <circle r="6" fill="#ea580c" />
      </g>
    </svg>
  );
}

/** Confetti, gold coins and, for the biggest note, fireworks. */
export function Celebration({ fireworks }: { fireworks: boolean }) {
  return (
    <div className="lixi-celebrate" aria-hidden="true">
      {Array.from({ length: 24 }, (_, i) => (
        <span key={`c${i}`} className="lixi-confetti" style={{ '--i': i } as CSSProperties} />
      ))}
      {Array.from({ length: 10 }, (_, i) => (
        <span key={`g${i}`} className="lixi-coin" style={{ '--i': i } as CSSProperties} />
      ))}
      {fireworks &&
        [0, 1, 2].map((b) => (
          <span key={`f${b}`} className="lixi-firework" style={{ '--b': b } as CSSProperties}>
            {Array.from({ length: 12 }, (_, i) => (
              <i key={i} style={{ '--i': i } as CSSProperties} />
            ))}
          </span>
        ))}
    </div>
  );
}
