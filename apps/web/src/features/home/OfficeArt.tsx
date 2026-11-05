/** Animal faces on a stage, one picked out by the spotlight: the picture for the office area. Decorative. */

type Face = {
  x: number;
  y: number;
  r: number;
  fur: string;
  inner: string;
  ears: 'cat' | 'round' | 'fox' | 'none';
};

const FACES: Face[] = [
  { x: 120, y: 300, r: 42, fur: '#f59e0b', inner: '#fde68a', ears: 'cat' },
  { x: 230, y: 318, r: 38, fur: '#f97316', inner: '#fff7ed', ears: 'fox' },
  { x: 410, y: 318, r: 38, fur: '#e5e7eb', inner: '#1f2937', ears: 'round' },
  { x: 520, y: 300, r: 42, fur: '#84cc16', inner: '#ecfccb', ears: 'none' },
];
const STAR: Face = { x: 320, y: 238, r: 58, fur: '#a16207', inner: '#fde68a', ears: 'round' };

function AnimalFace({ f, happy = false }: { f: Face; happy?: boolean }) {
  const { x, y, r } = f;
  const ear = (side: -1 | 1) => {
    const ex = x + side * r * 0.62;
    const ey = y - r * 0.72;
    if (f.ears === 'cat' || f.ears === 'fox')
      return (
        <path
          d={`M${ex - r * 0.32} ${ey + r * 0.2} L${ex + side * r * 0.05} ${ey - r * (f.ears === 'fox' ? 0.6 : 0.45)} L${ex + r * 0.32} ${ey + r * 0.2} Z`}
          fill={f.fur}
        />
      );
    if (f.ears === 'round')
      return (
        <circle cx={ex} cy={ey + r * 0.05} r={r * 0.3} fill={f.inner === '#1f2937' ? '#1f2937' : f.fur} />
      );
    return <circle cx={x + side * r * 0.45} cy={y - r * 0.78} r={r * 0.24} fill={f.fur} />;
  };
  return (
    <g>
      <ellipse cx={x} cy={y + r * 0.95} rx={r * 0.9} ry={r * 0.16} fill="#000" opacity="0.25" />
      {ear(-1)}
      {ear(1)}
      <circle cx={x} cy={y} r={r} fill={f.fur} />
      <ellipse
        cx={x}
        cy={y + r * 0.32}
        rx={r * 0.55}
        ry={r * 0.4}
        fill={f.inner === '#1f2937' ? '#f8fafc' : f.inner}
      />
      {f.inner === '#1f2937' && (
        <>
          <ellipse cx={x - r * 0.38} cy={y - r * 0.1} rx={r * 0.24} ry={r * 0.3} fill="#1f2937" />
          <ellipse cx={x + r * 0.38} cy={y - r * 0.1} rx={r * 0.24} ry={r * 0.3} fill="#1f2937" />
        </>
      )}
      {happy ? (
        <>
          <path
            d={`M${x - r * 0.48} ${y - r * 0.08} q${r * 0.12} -${r * 0.16} ${r * 0.24} 0`}
            stroke="#1f2937"
            strokeWidth={r * 0.08}
            fill="none"
            strokeLinecap="round"
          />
          <path
            d={`M${x + r * 0.24} ${y - r * 0.08} q${r * 0.12} -${r * 0.16} ${r * 0.24} 0`}
            stroke="#1f2937"
            strokeWidth={r * 0.08}
            fill="none"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <circle
            cx={x - r * 0.36}
            cy={y - r * 0.1}
            r={r * 0.1}
            fill={f.inner === '#1f2937' ? '#fff' : '#1f2937'}
          />
          <circle
            cx={x + r * 0.36}
            cy={y - r * 0.1}
            r={r * 0.1}
            fill={f.inner === '#1f2937' ? '#fff' : '#1f2937'}
          />
        </>
      )}
      <ellipse cx={x} cy={y + r * 0.2} rx={r * 0.12} ry={r * 0.08} fill="#1f2937" />
      <path
        d={`M${x - r * 0.18} ${y + r * 0.36} q${r * 0.18} ${r * (happy ? 0.28 : 0.14)} ${r * 0.36} 0`}
        stroke="#1f2937"
        strokeWidth={r * 0.06}
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}

export function OfficeArt({ className }: { className?: string }) {
  const { x, y, r } = STAR;
  return (
    <svg viewBox="0 0 640 400" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="office-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4c1d95" />
          <stop offset="1" stopColor="#1e1b4b" />
        </linearGradient>
        <linearGradient id="office-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fef08a" stopOpacity="0.85" />
          <stop offset="1" stopColor="#fef08a" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <rect width="640" height="400" fill="url(#office-bg)" />
      <ellipse cx="320" cy="372" rx="300" ry="40" fill="#312e81" />
      <path d="M290 0 L350 0 L440 330 L200 330 Z" fill="url(#office-beam)" />
      {FACES.map((f) => (
        <AnimalFace key={f.x} f={f} />
      ))}
      <AnimalFace f={STAR} happy />
      <path
        d={`M${x - r * 0.5} ${y - r * 0.95} l${r * 0.18} ${r * 0.32} l${r * 0.32} -${r * 0.42} l${r * 0.32} ${r * 0.42} l${r * 0.18} -${r * 0.32} l-${r * 0.12} ${r * 0.62} h-${r * 0.76} z`}
        fill="#facc15"
        stroke="#a16207"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {[
        [170, 120, '#f472b6'],
        [470, 110, '#38bdf8'],
        [215, 70, '#facc15'],
        [430, 60, '#4ade80'],
        [520, 170, '#fb923c'],
        [120, 190, '#a78bfa'],
      ].map(([cx, cy, fill]) => (
        <rect
          key={`${cx}`}
          x={cx as number}
          y={cy as number}
          width="12"
          height="7"
          rx="2"
          fill={fill as string}
          transform={`rotate(${((cx as number) % 60) - 30} ${cx} ${cy})`}
        />
      ))}
    </svg>
  );
}
