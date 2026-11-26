'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { axisTicks } from '../range';

/** Series colours in a fixed order, checked for colour-blind viewers (a number table is always there too). */
export const SERIES = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)'] as const;

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  /** One value per day; null where nothing was recorded (not the same as zero). */
  values: (number | null)[];
}

const HEIGHT = 220;
const PAD = { top: 12, right: 12, bottom: 24, left: 40 };
const BAR_MAX = 24;
const GAP = 2;

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry!.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

/** A bar segment: square where it stands, rounded at the end that carries the value. */
const bar = (x: number, y: number, w: number, h: number, rounded: boolean) => {
  const r = rounded ? Math.min(4, h, w / 2) : 0;
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
};

/** Days across, one axis: lines, or bars stacked in the order of the series. */
export function TimeChart({
  title,
  days,
  series,
  kind,
  extra,
}: {
  title: string;
  days: string[];
  series: ChartSeries[];
  kind: 'line' | 'stack';
  /** Columns shown in the number table only (a different measure must not share the axis). */
  extra?: { label: string; values: (number | null)[] }[];
}) {
  const t = useTranslations('admin.chart');
  const format = useFormatter();
  const { ref, width } = useWidth();
  const [active, setActive] = useState<number | null>(null);

  const dayText = (day: string, long = false) =>
    format.dateTime(new Date(`${day}T12:00:00+07:00`), {
      day: 'numeric',
      month: 'numeric',
      ...(long && { year: 'numeric' }),
    });
  const value = (v: number | null) => (v === null ? '—' : format.number(v));

  const known = series.some((s) => s.values.some((v) => v !== null));
  const totals = days.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0));
  const max =
    kind === 'stack'
      ? Math.max(0, ...totals)
      : Math.max(0, ...series.flatMap((s) => s.values.map((v) => v ?? 0)));
  const ticks = axisTicks(max);
  const top = ticks[ticks.length - 1]!;

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const band = plotW / Math.max(1, days.length);
  const x = (i: number) => PAD.left + band * (i + 0.5);
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  // As many day labels as fit side by side.
  const every = Math.max(1, Math.ceil(days.length / Math.max(1, Math.floor(plotW / 52))));

  const point = (e: PointerEvent<SVGSVGElement>) => {
    const i = Math.floor((e.clientX - e.currentTarget.getBoundingClientRect().left - PAD.left) / band);
    setActive(i >= 0 && i < days.length ? i : null);
  };
  const key = (e: KeyboardEvent) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return e.key === 'Escape' ? setActive(null) : undefined;
    e.preventDefault();
    setActive((i) => Math.min(days.length - 1, Math.max(0, i === null ? days.length - 1 : i + step)));
  };

  return (
    <div className="admin-chart">
      {series.length > 1 && (
        <ul className="admin-legend">
          {series.map((s) => (
            <li key={s.key}>
              <span
                className={kind === 'line' ? 'admin-key-line' : 'admin-key-bar'}
                style={{ background: s.color }}
              />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <div ref={ref} className="admin-plot">
        {!known ? (
          <p className="admin-empty">{t('noData')}</p>
        ) : (
          width > 0 && (
            <svg
              width={width}
              height={HEIGHT}
              role="img"
              aria-label={t('label', { title })}
              tabIndex={0}
              onPointerMove={point}
              onPointerDown={point}
              onPointerLeave={() => setActive(null)}
              onKeyDown={key}
              onBlur={() => setActive(null)}
            >
              {ticks.map((tick) => (
                <g key={tick}>
                  <line
                    className="admin-gridline"
                    x1={PAD.left}
                    x2={width - PAD.right}
                    y1={y(tick)}
                    y2={y(tick)}
                  />
                  <text className="admin-axis" x={PAD.left - 6} y={y(tick) + 4} textAnchor="end">
                    {format.number(tick, { notation: top >= 10_000 ? 'compact' : 'standard' })}
                  </text>
                </g>
              ))}
              {days.map((day, i) =>
                (days.length - 1 - i) % every === 0 ? (
                  <text key={day} className="admin-axis" x={x(i)} y={HEIGHT - 6} textAnchor="middle">
                    {dayText(day)}
                  </text>
                ) : null,
              )}
              {active !== null &&
                (kind === 'line' ? (
                  <line
                    className="admin-crosshair"
                    x1={x(active)}
                    x2={x(active)}
                    y1={PAD.top}
                    y2={PAD.top + plotH}
                  />
                ) : (
                  <rect
                    className="admin-band"
                    x={PAD.left + band * active}
                    y={PAD.top}
                    width={band}
                    height={plotH}
                  />
                ))}
              {kind === 'stack'
                ? days.map((day, i) => {
                    const w = Math.max(1, Math.min(BAR_MAX, band - GAP));
                    let base = 0;
                    const parts = series.filter((s) => (s.values[i] ?? 0) > 0);
                    return parts.map((s, n) => {
                      const from = y(base);
                      base += s.values[i]!;
                      // A gap of the card colour separates the parts of a stack.
                      const height = Math.max(1, from - y(base) - (n > 0 ? GAP : 0));
                      return (
                        <path
                          key={`${day}-${s.key}`}
                          d={bar(x(i) - w / 2, y(base), w, height, n === parts.length - 1)}
                          fill={s.color}
                        />
                      );
                    });
                  })
                : series.map((s) => {
                    // The line breaks where nothing was recorded.
                    const path = s.values
                      .map((v, i) =>
                        v === null ? '' : `${i > 0 && s.values[i - 1] !== null ? 'L' : 'M'}${x(i)},${y(v)}`,
                      )
                      .join('');
                    return (
                      <g key={s.key}>
                        <path
                          d={path}
                          fill="none"
                          stroke={s.color}
                          strokeWidth={2}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                        {s.values.map((v, i) =>
                          v !== null && (i === active || i === days.length - 1 || days.length === 1) ? (
                            <circle
                              key={days[i]}
                              className="admin-dot"
                              cx={x(i)}
                              cy={y(v)}
                              r={4}
                              fill={s.color}
                            />
                          ) : null,
                        )}
                      </g>
                    );
                  })}
            </svg>
          )
        )}
        {known && active !== null && (
          <div
            className="admin-tooltip"
            role="status"
            style={x(active) > width / 2 ? { right: width - x(active) + 10 } : { left: x(active) + 10 }}
          >
            <p>{dayText(days[active]!, true)}</p>
            <ul>
              {series.map((s) => (
                <li key={s.key}>
                  <span className="admin-key-line" style={{ background: s.color }} />
                  <strong>{value(s.values[active] ?? null)}</strong> {s.label}
                </li>
              ))}
              {extra?.map((column) => (
                <li key={column.label}>
                  <strong>{value(column.values[active] ?? null)}</strong> {column.label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <details className="admin-chart-table">
        <summary>{t('table')}</summary>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">{t('day')}</th>
                {[...series, ...(extra ?? [])].map((s) => (
                  <th key={s.label} scope="col" className="num">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days
                .map((day, i) => (
                  <tr key={day}>
                    <th scope="row">{dayText(day, true)}</th>
                    {[...series, ...(extra ?? [])].map((s) => (
                      <td key={s.label} className="num">
                        {value(s.values[i] ?? null)}
                      </td>
                    ))}
                  </tr>
                ))
                .reverse()}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/** Named things compared by one number, longest first. Every value is printed, so no hover is needed. */
export function RankBars({
  rows,
  unit,
}: {
  rows: { key: string; label: string; value: number }[];
  unit: string;
}) {
  const format = useFormatter();
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ol className="admin-rank">
      {rows.map((r) => (
        <li key={r.key}>
          <span className="admin-rank-label">{r.label}</span>
          <span className="admin-rank-track" aria-hidden="true">
            <span style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="admin-rank-value">
            {format.number(r.value)} <span className="sr-only">{unit}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
