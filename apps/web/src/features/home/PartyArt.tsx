/** A Tết room: lanterns, an apricot blossom branch and an opened red envelope with a note. Decorative. */

const PETALS = [
  { x: 92, y: 96 },
  { x: 128, y: 70 },
  { x: 170, y: 112 },
  { x: 58, y: 140 },
  { x: 214, y: 82 },
];

function Blossom({ x, y, r = 11 }: { x: number; y: number; r?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse
          key={a}
          cx="0"
          cy={-r * 0.62}
          rx={r * 0.48}
          ry={r * 0.62}
          fill="#facc15"
          transform={`rotate(${a})`}
        />
      ))}
      <circle r={r * 0.3} fill="#ea580c" />
    </g>
  );
}

function Lantern({ x, len, delay }: { x: number; len: number; delay: string }) {
  return (
    <g className="party-art-lantern" style={{ transformOrigin: `${x}px 0px`, animationDelay: delay }}>
      <line x1={x} y1="0" x2={x} y2={len} stroke="#7c2d12" strokeWidth="2" />
      <rect x={x - 12} y={len - 4} width="24" height="8" rx="2" fill="#eab308" />
      <ellipse cx={x} cy={len + 30} rx="30" ry="28" fill="#dc2626" />
      <path
        d={`M${x - 15} ${len + 5} Q${x - 26} ${len + 30} ${x - 15} ${len + 55} M${x + 15} ${len + 5} Q${x + 26} ${len + 30} ${x + 15} ${len + 55} M${x} ${len + 3} V${len + 57}`}
        stroke="#b91c1c"
        strokeWidth="2"
        fill="none"
      />
      <rect x={x - 12} y={len + 54} width="24" height="8" rx="2" fill="#eab308" />
      <path d={`M${x - 6} ${len + 62} h12 l-2 22 h-8 z`} fill="#f59e0b" />
    </g>
  );
}

export function PartyArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 640 400" className={className} role="presentation">
      <defs>
        <radialGradient id="party-art-bg" cx="50%" cy="40%" r="75%">
          <stop offset="0%" stopColor="#b91c1c" />
          <stop offset="100%" stopColor="#7f1d1d" />
        </radialGradient>
        <linearGradient id="party-art-note" x1="0" x2="1">
          <stop offset="0%" stopColor="#bbf7d0" />
          <stop offset="100%" stopColor="#86efac" />
        </linearGradient>
      </defs>
      <rect width="640" height="400" fill="url(#party-art-bg)" />
      {/* Gold pattern on the wall. */}
      <g opacity="0.12" stroke="#fde68a" strokeWidth="2" fill="none">
        {Array.from({ length: 8 }, (_, i) => (
          <circle key={i} cx={40 + i * 80} cy="360" r="46" />
        ))}
      </g>
      {/* Apricot blossom branch. */}
      <path d="M0 150 C60 120 110 120 160 96 S240 70 270 52" stroke="#78350f" strokeWidth="7" fill="none" />
      <path d="M120 112 C130 140 150 150 176 156" stroke="#78350f" strokeWidth="4" fill="none" />
      {PETALS.map((p) => (
        <Blossom key={`${p.x}-${p.y}`} x={p.x} y={p.y} />
      ))}
      <Blossom x={176} y={156} r={9} />
      <Lantern x={420} len={40} delay="0s" />
      <Lantern x={520} len={70} delay="-1.2s" />
      <Lantern x={600} len={30} delay="-0.6s" />
      {/* The opened envelope with the note fanned out. */}
      <g transform="translate(250 170) rotate(-6)">
        <g className="party-art-note">
          <rect
            x="34"
            y="-40"
            width="150"
            height="74"
            rx="6"
            fill="url(#party-art-note)"
            stroke="#15803d"
            strokeWidth="2"
          />
          <circle cx="70" cy="-12" r="14" fill="none" stroke="#15803d" strokeWidth="2" />
          <text
            x="150"
            y="8"
            textAnchor="end"
            fontSize="26"
            fontWeight="800"
            fill="#14532d"
            fontFamily="system-ui"
          >
            500K
          </text>
        </g>
        <rect x="20" y="0" width="180" height="150" rx="10" fill="#dc2626" stroke="#facc15" strokeWidth="4" />
        <path d="M20 10 L110 64 L200 10" fill="#b91c1c" stroke="#facc15" strokeWidth="3" />
        <circle cx="110" cy="96" r="26" fill="#fef3c7" stroke="#facc15" strokeWidth="3" />
        <Blossom x={110} y={96} r={16} />
      </g>
      {/* Gold coins. */}
      {[
        [210, 330],
        [470, 300],
        [520, 350],
      ].map(([cx, cy]) => (
        <g key={`${cx}`}>
          <circle cx={cx} cy={cy} r="15" fill="#facc15" stroke="#ca8a04" strokeWidth="3" />
          <rect x={cx! - 4} y={cy! - 4} width="8" height="8" fill="#ca8a04" />
        </g>
      ))}
    </svg>
  );
}
