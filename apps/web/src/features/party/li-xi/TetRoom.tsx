import type { CSSProperties } from 'react';

/** Decor of the Tết room behind the Lì xì stage: lanterns, apricot and peach branches, firecrackers, petals. */
export function TetRoom() {
  return (
    <div className="tet-room" aria-hidden="true">
      <div className="tet-lanterns">
        {[8, 24, 76, 92].map((x, i) => (
          <Lantern key={x} x={x} drop={i % 2 ? 70 : 30} delay={-i * 0.7} />
        ))}
      </div>
      <Branch side="left" flower="mai" />
      <Branch side="right" flower="dao" />
      <Firecrackers side="left" />
      <Firecrackers side="right" />
      <div className="tet-petals">
        {Array.from({ length: 18 }, (_, i) => (
          <span
            key={i}
            className={i % 3 === 0 ? 'tet-petal tet-petal-pink' : 'tet-petal'}
            style={
              {
                '--x': `${(i * 37) % 100}%`,
                '--d': `${9 + (i % 5) * 1.7}s`,
                '--delay': `${-((i * 1.9) % 11)}s`,
                '--drift': `${(i % 2 ? 1 : -1) * (20 + (i % 4) * 15)}px`,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}

function Lantern({ x, drop, delay }: { x: number; drop: number; delay: number }) {
  return (
    <svg
      className="tet-lantern"
      viewBox="0 0 60 200"
      style={{ left: `${x}%`, animationDelay: `${delay}s`, height: drop + 130 } as CSSProperties}
      preserveAspectRatio="xMidYMin meet"
    >
      <line x1="30" y1="0" x2="30" y2={drop} stroke="#78350f" strokeWidth="2" />
      <rect x="18" y={drop - 4} width="24" height="8" rx="2" fill="#eab308" />
      <ellipse cx="30" cy={drop + 34} rx="28" ry="32" fill="#dc2626" />
      <ellipse cx="30" cy={drop + 34} rx="16" ry="32" fill="none" stroke="#991b1b" strokeWidth="2" />
      <line x1="30" y1={drop + 2} x2="30" y2={drop + 66} stroke="#991b1b" strokeWidth="2" />
      <rect x="18" y={drop + 63} width="24" height="8" rx="2" fill="#eab308" />
      <path d={`M24 ${drop + 71} h12 l-2 26 h-8 z`} fill="#f59e0b" />
    </svg>
  );
}

const BLOSSOMS = [
  [62, 38],
  [104, 22],
  [140, 58],
  [186, 34],
  [96, 82],
  [214, 76],
  [40, 92],
  [164, 104],
];

function Branch({ side, flower }: { side: 'left' | 'right'; flower: 'mai' | 'dao' }) {
  const petal = flower === 'mai' ? '#facc15' : '#f9a8d4';
  const heart = flower === 'mai' ? '#ea580c' : '#be185d';
  return (
    <svg className={`tet-branch tet-branch-${side}`} viewBox="0 0 260 160">
      <path d="M0 20 C50 40 90 40 130 52 S210 70 250 86" stroke="#57290f" strokeWidth="7" fill="none" />
      <path d="M70 40 C80 66 70 86 44 98" stroke="#57290f" strokeWidth="4" fill="none" />
      <path d="M150 58 C160 80 170 92 166 110" stroke="#57290f" strokeWidth="3.5" fill="none" />
      {BLOSSOMS.map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${i * 23})`}>
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx="0" cy="-7" rx="5.5" ry="7" fill={petal} transform={`rotate(${a})`} />
          ))}
          <circle r="3" fill={heart} />
        </g>
      ))}
    </svg>
  );
}

function Firecrackers({ side }: { side: 'left' | 'right' }) {
  return (
    <svg className={`tet-crackers tet-crackers-${side}`} viewBox="0 0 40 300">
      <line x1="20" y1="0" x2="20" y2="300" stroke="#78350f" strokeWidth="2" />
      {Array.from({ length: 12 }, (_, i) => (
        <g key={i} transform={`translate(${i % 2 ? 22 : 6} ${14 + i * 23}) rotate(${i % 2 ? 20 : -20})`}>
          <rect width="12" height="22" rx="2" fill="#dc2626" />
          <rect y="8" width="12" height="4" fill="#facc15" />
        </g>
      ))}
    </svg>
  );
}
