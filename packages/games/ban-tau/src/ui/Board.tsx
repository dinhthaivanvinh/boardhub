'use client';

import { useState, type KeyboardEvent } from 'react';
import type { Rng } from '@bg/engine';
import { CELL, GridBoard, VisuallyHidden, type BoardProps, type Translator } from '@bg/ui';
import { randomPlacement } from '../bot';
import { colOf, FLEET, rowOf, shipCells, SIZE } from '../rules/fleet';
import type { BanTauMove, BanTauSeat, BanTauView, Placement, Ship, Shot } from '../rules/types';

export type BanTauBoardProps = BoardProps<BanTauView, BanTauMove>;

const HALF = CELL / 2;
const LETTERS = 'ABCDEFGHIJ';
/** "C7": column letter and row number, as players say them. */
export const cellName = (cell: number) => `${LETTERS[colOf(cell)]}${rowOf(cell) + 1}`;
const otherSeat = (s: BanTauSeat): BanTauSeat => (s === 0 ? 1 : 0);

/** UI-only randomness for the "Random" button (the rules never use Math.random). */
const uiRng: Rng = {
  next: () => Math.random(),
  int: (a, b) => a + Math.floor(Math.random() * (b - a)),
  shuffle: (items) => [...items].sort(() => Math.random() - 0.5),
};

export function PieceIcon({ seat, size = 24 }: { seat: number; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        d="M3 14h18l-2.5 5h-13zM7 14V9h4V5h2v4h4v5"
        className={seat === 0 ? 'bt-icon-p0' : 'bt-icon-p1'}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A ship drawn as one rounded hull over its cells. */
function Hull({
  ship,
  kind,
}: {
  ship: Ship | { cells: number[] };
  kind: 'mine' | 'sunk' | 'ghost-ok' | 'ghost-bad';
}) {
  const first = ship.cells[0]!;
  const last = ship.cells[ship.cells.length - 1]!;
  const x = colOf(first) * CELL + 4;
  const y = rowOf(first) * CELL + 4;
  const w = (colOf(last) - colOf(first) + 1) * CELL - 8;
  const h = (rowOf(last) - rowOf(first) + 1) * CELL - 8;
  return (
    <rect className={`bt-hull bt-hull-${kind}`} x={x} y={y} width={w} height={h} rx={Math.min(w, h) / 2} />
  );
}

function ShotMark({ shot, latest, animate }: { shot: Shot; latest: boolean; animate: boolean }) {
  const cx = colOf(shot.cell) * CELL + HALF;
  const cy = rowOf(shot.cell) * CELL + HALF;
  return (
    <g className={`bt-shot ${shot.hit ? 'bt-hit' : 'bt-miss'} ${latest && animate ? 'bt-latest' : ''}`}>
      {latest && animate && <circle className="bt-ripple" cx={cx} cy={cy} r={CELL * 0.45} />}
      {shot.hit ? (
        <>
          <circle cx={cx} cy={cy} r={CELL * 0.3} className="bt-hit-burst" />
          <path
            d={`M${cx - 7} ${cy - 7}L${cx + 7} ${cy + 7}M${cx + 7} ${cy - 7}L${cx - 7} ${cy + 7}`}
            className="bt-hit-x"
          />
        </>
      ) : (
        <circle cx={cx} cy={cy} r={CELL * 0.12} className="bt-miss-dot" />
      )}
    </g>
  );
}

/** One 10 × 10 sea: ships the viewer may see, shots that landed in it. */
function Sea({
  label,
  ships,
  sunk,
  shots,
  latest,
  canFire,
  pending,
  onCell,
  onHover,
  ghost,
  animate,
  t,
  testId,
}: {
  label: string;
  ships: Ship[];
  sunk: number[];
  shots: Shot[];
  latest: number | null;
  canFire: boolean;
  pending?: number | null;
  onCell(cell: number): void;
  onHover?(cell: number | null): void;
  ghost?: { cells: number[]; ok: boolean } | null;
  animate: boolean;
  t: Translator;
  testId: string;
}) {
  const shotAt = new Map(shots.map((s) => [s.cell, s]));
  const shipAt = (cell: number) => ships.find((s) => s.cells.includes(cell));
  const stateOf = (cell: number) => {
    const ship = shipAt(cell);
    const shot = shotAt.get(cell);
    if (ship && sunk.includes(ship.id)) return 'sunk';
    if (shot) return shot.hit ? 'hit' : 'miss';
    return ship ? 'ship' : 'water';
  };
  return (
    <div className="bt-sea" data-testid={testId} data-can-fire={canFire ? 'true' : undefined}>
      <p className="bt-sea-title">{label}</p>
      <div className="bt-sea-frame">
        <span className="bt-coords bt-coords-top" aria-hidden="true">
          {[...LETTERS].map((l) => (
            <span key={l}>{l}</span>
          ))}
        </span>
        <span className="bt-coords bt-coords-left" aria-hidden="true">
          {Array.from({ length: SIZE }, (_, i) => (
            <span key={i}>{i + 1}</span>
          ))}
        </span>
        <GridBoard
          rows={SIZE}
          cols={SIZE}
          label={label}
          className="bt-grid"
          cellLabel={(cell) =>
            t('games.ban-tau.cellLabel', {
              col: LETTERS[colOf(cell)]!,
              row: rowOf(cell) + 1,
              state: t(`games.ban-tau.state.${stateOf(cell)}`),
            })
          }
          onActivate={onCell}
          {...(onHover ? { onHover } : {})}
          cellData={(cell) => ({
            'data-state': stateOf(cell),
            'data-latest': latest === cell ? 'true' : undefined,
            'data-pending': pending === cell ? 'true' : undefined,
          })}
          renderCell={(cell, geom) =>
            canFire && !shotAt.has(cell) ? (
              <rect
                className={`bt-aim ${pending === cell ? 'bt-aim-pending' : ''}`}
                x={geom.x + 2}
                y={geom.y + 2}
                width={CELL - 4}
                height={CELL - 4}
                rx={6}
              />
            ) : null
          }
          overlay={
            <>
              {ships.map((ship) => (
                <Hull key={ship.id} ship={ship} kind={sunk.includes(ship.id) ? 'sunk' : 'mine'} />
              ))}
              {ghost && <Hull ship={ghost} kind={ghost.ok ? 'ghost-ok' : 'ghost-bad'} />}
              {shots.map((shot) => (
                <ShotMark key={shot.cell} shot={shot} latest={latest === shot.cell} animate={animate} />
              ))}
            </>
          }
        />
      </div>
    </div>
  );
}

/** Ship placement: pick a ship, tap the sea, rotate, pick up again, or let chance decide. */
function Placer({
  canSubmit,
  onDone,
  t,
  animate,
}: {
  canSubmit: boolean;
  onDone(ships: Placement[]): void;
  t: Translator;
  animate: boolean;
}) {
  const [draft, setDraft] = useState<(Placement | null)[]>(() => FLEET.map(() => null));
  const [current, setCurrent] = useState<number | null>(0);
  const [horizontal, setHorizontal] = useState(true);
  const [hover, setHover] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const placedShips: Ship[] = draft.flatMap((p, id) => {
    const cells = p ? shipCells(p.cell, FLEET[id]!, p.horizontal) : null;
    return cells ? [{ id, size: FLEET[id]!, cells }] : [];
  });
  const taken = (except: number) =>
    new Set(placedShips.filter((s) => s.id !== except).flatMap((s) => s.cells));
  const fits = (id: number, cell: number, h: boolean) => {
    const cells = shipCells(cell, FLEET[id]!, h);
    const used = taken(id);
    return cells && !cells.some((c) => used.has(c)) ? cells : null;
  };
  const nextFree = (d: (Placement | null)[], after: number) => {
    for (let i = 1; i <= FLEET.length; i++) {
      const id = (after + i) % FLEET.length;
      if (!d[id]) return id;
    }
    return null;
  };

  const activate = (cell: number) => {
    setMessage(null);
    const owner = placedShips.find((s) => s.cells.includes(cell));
    if (owner && current === null) {
      // Pick a placed ship up again.
      setDraft(draft.map((p, i) => (i === owner.id ? null : p)));
      setHorizontal(draft[owner.id]!.horizontal);
      setCurrent(owner.id);
      return;
    }
    if (current === null) return;
    if (!fits(current, cell, horizontal)) {
      setMessage(t('games.ban-tau.place.cannot'));
      return;
    }
    const next = draft.map((p, i) => (i === current ? { cell, horizontal } : p));
    setDraft(next);
    setCurrent(nextFree(next, current));
  };

  const ghostCells =
    current !== null && hover !== null ? shipCells(hover, FLEET[current]!, horizontal) : null;
  const ghost =
    current !== null && hover !== null
      ? {
          cells: ghostCells ?? [hover],
          ok: fits(current, hover, horizontal) !== null,
        }
      : null;
  const complete = draft.every(Boolean);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'r' || e.key === 'R') setHorizontal((h) => !h);
  };

  return (
    <div className="bt-placer" onKeyDown={onKeyDown}>
      <p className="bt-sea-title">{t('games.ban-tau.place.title')}</p>
      <p className="bt-hint">{t('games.ban-tau.place.hint')}</p>
      <div className="bt-placer-body">
        <ul className="bt-ship-list">
          {FLEET.map((size, id) => (
            <li key={id}>
              <button
                type="button"
                className="bt-ship-btn"
                aria-pressed={current === id}
                data-placed={draft[id] ? 'true' : undefined}
                onClick={() => {
                  setMessage(null);
                  if (draft[id]) {
                    setDraft(draft.map((p, i) => (i === id ? null : p)));
                    setHorizontal(draft[id]!.horizontal);
                  }
                  setCurrent(id);
                }}
              >
                <span className="bt-ship-pips" aria-hidden="true">
                  {Array.from({ length: size }, (_, i) => (
                    <span key={i} />
                  ))}
                </span>
                <span>
                  {t(`games.ban-tau.ships.${id}`)} · {t('games.ban-tau.shipSize', { n: size })}
                  {draft[id] && <em> · {t('games.ban-tau.place.placed')}</em>}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <Sea
          label={t('games.ban-tau.mySea')}
          ships={placedShips}
          sunk={[]}
          shots={[]}
          latest={null}
          canFire={false}
          onCell={activate}
          onHover={setHover}
          ghost={ghost}
          animate={animate}
          t={t}
          testId="sea-placement"
        />
      </div>
      {message && (
        <p className="bt-warning" role="alert">
          {message}
        </p>
      )}
      <div className="bt-actions">
        <button type="button" className="btn" onClick={() => setHorizontal((h) => !h)}>
          ⟳ {t('games.ban-tau.place.rotate')} (
          {t(`games.ban-tau.place.${horizontal ? 'horizontal' : 'vertical'}`)})
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setMessage(null);
            setDraft(randomPlacement(uiRng, false));
            setCurrent(null);
          }}
        >
          🎲 {t('games.ban-tau.place.random')}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setDraft(FLEET.map(() => null));
            setCurrent(0);
          }}
        >
          {t('games.ban-tau.place.clear')}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!complete || !canSubmit}
          onClick={() => onDone(draft as Placement[])}
        >
          {t('games.ban-tau.place.done')}
        </button>
      </div>
    </div>
  );
}

export function Board({ view, mySeat, isMyTurn, disabled, onMove, settings, t }: BanTauBoardProps) {
  // Two players on one device: whenever the device changes hands, cover the board until the new player is ready.
  const [shownSeat, setShownSeat] = useState(mySeat);
  const [covered, setCovered] = useState(false);
  if (shownSeat !== mySeat) {
    setShownSeat(mySeat);
    if (shownSeat !== null && mySeat !== null && view.phase !== 'over') setCovered(true);
  }
  const [pending, setPending] = useState<number | null>(null);
  const [seenMoves, setSeenMoves] = useState(view.moveCount);
  if (seenMoves !== view.moveCount) {
    setSeenMoves(view.moveCount);
    setPending(null);
  }

  const me: BanTauSeat | null = mySeat === null ? null : mySeat === 0 ? 0 : 1;
  const pieceName = (s: BanTauSeat) => t(`games.ban-tau.pieces.${s}`);
  const animate = settings.animations;
  const last = view.lastShot;

  if (covered && me !== null) {
    return (
      <div className="bt-board">
        <div className="bt-handoff" role="dialog" aria-labelledby="bt-handoff-title">
          <p id="bt-handoff-title" className="bt-handoff-title">
            {t('games.ban-tau.handoff.title', { player: pieceName(me) })}
          </p>
          <p>{t('games.ban-tau.handoff.text')}</p>
          <button type="button" className="btn btn-primary" onClick={() => setCovered(false)}>
            {t('games.ban-tau.handoff.show', { player: pieceName(me) })}
          </button>
        </div>
      </div>
    );
  }

  const who = (s: BanTauSeat) =>
    me === null ? pieceName(s) : s === me ? t('games.ban-tau.you') : t('games.ban-tau.opponent');
  const lastText = last
    ? last.sunk !== null
      ? t('games.ban-tau.lastSunk', {
          who: who(last.seat),
          cell: cellName(last.cell),
          ship: t(`games.ban-tau.ships.${last.sunk}`),
        })
      : t(last.hit ? 'games.ban-tau.lastHit' : 'games.ban-tau.lastMiss', {
          who: who(last.seat),
          cell: cellName(last.cell),
        })
    : '';

  // Placing ships.
  if (view.phase === 'placing') {
    if (me !== null && !view.placed[me]) {
      return (
        <div className="bt-board">
          <Placer
            canSubmit={isMyTurn && !disabled}
            onDone={(ships) => onMove({ kind: 'place', ships })}
            t={t}
            animate={animate}
          />
          {!isMyTurn && <p className="bt-hint">{t('games.ban-tau.waiting')}</p>}
        </div>
      );
    }
    return (
      <div className="bt-board">
        <p className="bt-banner">{t('games.ban-tau.waiting')}</p>
        {me !== null && (
          <Sea
            label={t('games.ban-tau.mySea')}
            ships={view.fleets[me]}
            sunk={[]}
            shots={[]}
            latest={null}
            canFire={false}
            onCell={() => {}}
            animate={animate}
            t={t}
            testId="sea-mine"
          />
        )}
      </div>
    );
  }

  // Battle (or the end, when every ship is shown).
  const canFire = me !== null && isMyTurn && !disabled && view.phase === 'battle';
  const fire = (cell: number) => {
    if (!canFire || me === null || view.shots[me].some((s) => s.cell === cell)) return;
    if (settings.confirmMove && pending !== cell) {
      setPending(cell);
      return;
    }
    setPending(null);
    onMove({ kind: 'fire', cell });
  };

  const top: BanTauSeat = me === null ? 1 : otherSeat(me);
  const bottom: BanTauSeat = otherSeat(top);
  const seaProps = (owner: BanTauSeat) => ({
    ships: view.fleets[owner],
    sunk: view.sunk[owner],
    shots: view.shots[otherSeat(owner)],
    latest: last && last.seat !== owner ? last.cell : null,
    animate,
    t,
  });

  return (
    <div className="bt-board">
      <p className={`bt-banner ${canFire ? 'bt-banner-go' : ''}`}>
        {view.phase === 'over'
          ? lastText
          : canFire
            ? t('games.ban-tau.yourTurn')
            : me !== null
              ? t('games.ban-tau.theirTurn')
              : lastText}
      </p>
      <div className="bt-seas">
        <Sea
          {...seaProps(top)}
          label={
            me === null ? t('games.ban-tau.seaOf', { player: pieceName(top) }) : t('games.ban-tau.theirSea')
          }
          canFire={canFire}
          pending={pending}
          onCell={fire}
          testId="sea-enemy"
        />
        <Sea
          {...seaProps(bottom)}
          label={
            me === null ? t('games.ban-tau.seaOf', { player: pieceName(bottom) }) : t('games.ban-tau.mySea')
          }
          canFire={false}
          onCell={() => {}}
          testId="sea-mine"
        />
      </div>
      <div className="bt-afloat">
        <span className="font-medium">{t('games.ban-tau.afloat')}:</span>
        {FLEET.map((size, id) => (
          <span
            key={id}
            className="bt-afloat-ship"
            data-sunk={view.sunk[top].includes(id) ? 'true' : undefined}
          >
            {t(`games.ban-tau.ships.${id}`)} ({size})
          </span>
        ))}
      </div>
      {last && <p className="bt-last">{lastText}</p>}
      <VisuallyHidden live>{lastText}</VisuallyHidden>
    </div>
  );
}
