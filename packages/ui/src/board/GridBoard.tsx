import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface CellGeometry {
  x: number;
  y: number;
  size: number;
}

export interface GridBoardProps {
  rows: number;
  cols: number;
  /** Accessible name of the whole board. */
  label: string;
  cellLabel(index: number): string;
  /** Content drawn inside a cell (piece, highlight). Coordinates are in viewBox units. */
  renderCell(index: number, cell: CellGeometry): ReactNode;
  /** Click, tap, Enter or Space on a cell. */
  onActivate(index: number): void;
  onHover?(index: number | null): void;
  /** Extra attributes per cell, e.g. data-state for styling and tests. */
  cellData?(index: number): Record<`data-${string}`, string | undefined>;
  /** Drawn on top of the cells (win lines, arrows). Not interactive. */
  overlay?: ReactNode;
  className?: string;
}

export const CELL = 40;

/**
 * Accessible SVG grid: role="grid" with roving tabindex.
 * Arrow keys move the focus, Home/End jump within a row, Enter/Space activate.
 */
export function GridBoard(props: GridBoardProps) {
  const { rows, cols } = props;
  const [focused, setFocused] = useState(() => Math.floor(rows / 2) * cols + Math.floor(cols / 2));
  const cellRefs = useRef<(SVGGElement | null)[]>([]);

  const moveFocus = (index: number) => {
    setFocused(index);
    cellRefs.current[index]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<SVGGElement>, index: number) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const go: Record<string, number | undefined> = {
      ArrowUp: row > 0 ? index - cols : undefined,
      ArrowDown: row < rows - 1 ? index + cols : undefined,
      ArrowLeft: col > 0 ? index - 1 : undefined,
      ArrowRight: col < cols - 1 ? index + 1 : undefined,
      Home: row * cols,
      End: row * cols + cols - 1,
    };
    if (event.key in go) {
      event.preventDefault();
      const target = go[event.key];
      if (target !== undefined) moveFocus(target);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      props.onActivate(index);
    }
  };

  const width = cols * CELL;
  const height = rows * CELL;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={props.className}
      style={{ width: '100%', height: 'auto', aspectRatio: `${cols} / ${rows}`, touchAction: 'manipulation' }}
      onPointerLeave={() => props.onHover?.(null)}
    >
      <rect className="bg-board" x={0} y={0} width={width} height={height} />
      <g className="bg-grid-lines" aria-hidden="true">
        {Array.from({ length: cols + 1 }, (_, i) => (
          <line key={`v${i}`} x1={i * CELL} y1={0} x2={i * CELL} y2={height} />
        ))}
        {Array.from({ length: rows + 1 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={i * CELL} x2={width} y2={i * CELL} />
        ))}
      </g>
      <g role="grid" aria-label={props.label} aria-rowcount={rows} aria-colcount={cols}>
        {Array.from({ length: rows }, (_, r) => (
          <g role="row" key={r} aria-rowindex={r + 1}>
            {Array.from({ length: cols }, (_, c) => {
              const index = r * cols + c;
              const geom = { x: c * CELL, y: r * CELL, size: CELL };
              return (
                <g
                  key={index}
                  role="gridcell"
                  className="bg-cell"
                  aria-colindex={c + 1}
                  aria-label={props.cellLabel(index)}
                  tabIndex={index === focused ? 0 : -1}
                  ref={(el) => {
                    cellRefs.current[index] = el;
                  }}
                  onClick={() => props.onActivate(index)}
                  onFocus={() => setFocused(index)}
                  onKeyDown={(e) => onKeyDown(e, index)}
                  onPointerEnter={() => props.onHover?.(index)}
                  {...props.cellData?.(index)}
                >
                  <rect
                    className="bg-cell-hit"
                    x={geom.x}
                    y={geom.y}
                    width={CELL}
                    height={CELL}
                    fill="transparent"
                  />
                  {props.renderCell(index, geom)}
                </g>
              );
            })}
          </g>
        ))}
      </g>
      {props.overlay && (
        <g aria-hidden="true" pointerEvents="none">
          {props.overlay}
        </g>
      )}
    </svg>
  );
}
