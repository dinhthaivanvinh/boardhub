'use client';

import { useState } from 'react';
import { VisuallyHidden, type BoardProps } from '@bg/ui';
import { ownSquares, quanIndex, scores } from '../rules/rules';
import type { OAnQuanMove, OAnQuanSeat, OAnQuanState } from '../rules/types';
import { SPEEDS, usePlayback } from './use-playback';

export type OAnQuanBoardProps = BoardProps<OAnQuanState, OAnQuanMove>;

const otherSeat = (s: OAnQuanSeat): OAnQuanSeat => (s === 0 ? 1 : 0);

/** Small stones, drawn as dots up to a dozen; the number is always shown too. */
function Stones({ count, max = 12 }: { count: number; max?: number }) {
  return (
    <span className="oaq-stones" aria-hidden="true">
      {Array.from({ length: Math.min(count, max) }, (_, i) => (
        <span key={i} className="oaq-dot" />
      ))}
    </span>
  );
}

export function PieceIcon({ seat, size = 24 }: { seat: number; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <circle cx="12" cy="12" r="10" className={seat === 0 ? 'oaq-icon-p0' : 'oaq-icon-p1'} />
      <circle cx="9" cy="10" r="2" fill="#fff" opacity="0.8" />
      <circle cx="15" cy="10" r="2" fill="#fff" opacity="0.8" />
      <circle cx="12" cy="15" r="2" fill="#fff" opacity="0.8" />
    </svg>
  );
}

export function Board({
  view: incoming,
  mySeat,
  isMyTurn,
  disabled,
  onMove,
  orientation,
  settings,
  t,
}: OAnQuanBoardProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [seenMoveCount, setSeenMoveCount] = useState(incoming.moveCount);
  if (seenMoveCount !== incoming.moveCount) {
    setSeenMoveCount(incoming.moveCount);
    setSelected(null);
  }

  // Moves are played out stone by stone; while that runs the board shows a frame of it.
  const { shown, frame, playing, skip, speed, setSpeed, replay, canReplay } = usePlayback(
    incoming,
    settings.animations,
  );
  const view: OAnQuanState = frame
    ? {
        ...shown,
        cells: frame.cells,
        quan: frame.quan,
        stash: frame.stash,
        taken: frame.taken,
        sown: [],
        refill: null,
        lastMove: { cell: frame.start, dir: 1 },
      }
    : shown;

  const viewer: OAnQuanSeat = (orientation ?? mySeat ?? 0) === 1 ? 1 : 0;
  const bottom = ownSquares(viewer); // left to right
  const top = [...ownSquares(otherSeat(viewer))].reverse(); // left to right on screen
  const leftQuan = viewer === 0 ? 0 : 6;
  const rightQuan = viewer === 0 ? 6 : 0;

  const canPlay = isMyTurn && !disabled && !incoming.ended && !playing && mySeat !== null;
  // Hot-seat keeps one orientation, so the player to move may be on the top row.
  const myRow = mySeat === null ? [] : ownSquares(mySeat === 1 ? 1 : 0);
  const playable = (i: number) => canPlay && myRow.includes(i) && view.cells[i]! > 0;
  /** +1 runs right along the bottom row but left along the top row, as seen on screen. */
  const screenDir = (cell: number, dir: 1 | -1): 1 | -1 => (bottom.includes(cell) ? dir : dir === 1 ? -1 : 1);
  const taken = new Set(view.taken);
  const sownCount = new Map<number, number>();
  for (const i of view.sown) sownCount.set(i, (sownCount.get(i) ?? 0) + 1);

  const numberOn = (i: number) => {
    const row = bottom.includes(i) ? bottom : top;
    return row.indexOf(i) + 1;
  };
  const [pBottom, pTop] = (() => {
    const s = scores(view);
    return [s[viewer], s[otherSeat(viewer)]];
  })();
  const who = (seat: OAnQuanSeat) => t(`games.o-an-quan.pieces.${seat}`);

  const squareClass = (i: number) =>
    [
      'oaq-square',
      selected === i && 'oaq-selected',
      view.lastMove?.cell === i && 'oaq-start',
      taken.has(i) && 'oaq-taken',
      !playing && settings.animations && sownCount.has(i) && 'oaq-sown',
      frame?.active === i && `oaq-active oaq-active-${frame.event}`,
    ]
      .filter(Boolean)
      .join(' ');

  const dataFor = (i: number) => ({
    'data-cell': i,
    'data-count': view.cells[i],
    'data-start': view.lastMove?.cell === i ? 'true' : undefined,
    'data-taken': taken.has(i) ? 'true' : undefined,
    'data-selected': selected === i ? 'true' : undefined,
  });

  /** The stones still in hand, shown over the square being sown into. */
  const hand = (i: number) =>
    frame?.active === i && frame.hand > 0 ? (
      <span className="oaq-hand" data-testid="sowing-hand" aria-hidden="true">
        ✋ {frame.hand}
      </span>
    ) : null;

  const square = (i: number) => {
    const owner = myRow.includes(i) ? 'mine' : 'theirs';
    const label = t('games.o-an-quan.square', {
      n: numberOn(i),
      owner: mySeat === null ? '' : t(`games.o-an-quan.${owner}`),
      count: view.cells[i]!,
    });
    const can = playable(i);
    return (
      <button
        key={i}
        type="button"
        className={squareClass(i)}
        aria-label={label}
        aria-pressed={selected === i}
        aria-disabled={!can}
        onClick={() => {
          if (!can) return;
          setSelected(selected === i ? null : i);
        }}
        {...dataFor(i)}
      >
        <Stones count={view.cells[i]!} />
        <span className="oaq-count">{view.cells[i]}</span>
        {hand(i)}
      </button>
    );
  };

  const quanSquare = (i: number, side: 'left' | 'right') => {
    const hasQuan = view.quan[quanIndex(i)];
    return (
      <div
        key={i}
        role="img"
        className={`${squareClass(i)} oaq-quan oaq-quan-${side}`}
        aria-label={t('games.o-an-quan.quanSquare', {
          side: t(`games.o-an-quan.${side === 'left' ? 'quanLeft' : 'quanRight'}`),
          quan: t(`games.o-an-quan.${hasQuan ? 'hasQuan' : 'noQuan'}`),
          count: view.cells[i]!,
        })}
        {...dataFor(i)}
        data-quan={hasQuan ? 'true' : undefined}
      >
        {hasQuan && <span className="oaq-quan-piece" aria-hidden="true" />}
        <Stones count={view.cells[i]!} max={8} />
        <span className="oaq-count">{view.cells[i]}</span>
        {hand(i)}
      </div>
    );
  };

  const stashBox = (seat: OAnQuanSeat, points: number, testId: string) => (
    <div className={`oaq-stash oaq-stash-p${seat}`} data-testid={testId}>
      <span className="oaq-stash-who">
        <PieceIcon seat={seat} size={18} /> {who(seat)} · {t('games.o-an-quan.stash')}
      </span>
      <span>
        {t('games.o-an-quan.stashLine', { dan: view.stash[seat]!.dan, quan: view.stash[seat]!.quan })}
        {view.debt[seat] > 0 && ` · ${t('games.o-an-quan.debt', { n: view.debt[seat] })}`}
      </span>
      <strong>{t('games.o-an-quan.points', { n: points })}</strong>
    </div>
  );

  const last = view.lastMove;
  const mover = last ? (last.cell <= 5 ? 0 : 1) : null;

  return (
    <div className="oaq-board" data-animating={playing ? 'true' : undefined}>
      {stashBox(otherSeat(viewer), pTop, 'stash-top')}
      <div className="oaq-table" role="group" aria-label={t('games.o-an-quan.boardLabel')}>
        {quanSquare(leftQuan, 'left')}
        <div className="oaq-rows">
          <div className="oaq-row">{top.map(square)}</div>
          <div className="oaq-row">{bottom.map(square)}</div>
        </div>
        {quanSquare(rightQuan, 'right')}
      </div>
      {stashBox(viewer, pBottom, 'stash-bottom')}

      {playing && (
        <div className="oaq-direction oaq-playback" role="group" aria-label={t('games.o-an-quan.speed')}>
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              className="oaq-dir-cancel oaq-speed"
              aria-pressed={speed === s}
              onClick={() => setSpeed(s)}
              data-testid={`oaq-speed-${s}`}
            >
              {t(`games.o-an-quan.speeds.${s === 0.5 ? 'slow' : s === 1 ? 'normal' : 'fast'}`)}
            </button>
          ))}
          <button type="button" className="oaq-dir-cancel" onClick={skip} data-testid="oaq-skip">
            {t('games.o-an-quan.skip')} ⏭
          </button>
        </div>
      )}

      {canReplay && selected === null && (
        <div className="oaq-direction">
          <button type="button" className="oaq-dir-cancel" onClick={replay} data-testid="oaq-replay-move">
            ↺ {t('games.o-an-quan.replayMove')}
          </button>
        </div>
      )}

      {selected !== null && canPlay && (
        <div
          className="oaq-direction"
          role="group"
          aria-label={t('games.o-an-quan.pickDirection', { n: numberOn(selected) })}
        >
          <button
            type="button"
            className="oaq-dir-btn"
            onClick={() => onMove({ cell: selected, dir: screenDir(selected, -1) })}
          >
            ◀ {t('games.o-an-quan.left')}
          </button>
          <button type="button" className="oaq-dir-cancel" onClick={() => setSelected(null)}>
            {t('games.o-an-quan.cancel')}
          </button>
          <button
            type="button"
            className="oaq-dir-btn"
            onClick={() => onMove({ cell: selected, dir: screenDir(selected, 1) })}
          >
            {t('games.o-an-quan.right')} ▶
          </button>
        </div>
      )}

      <VisuallyHidden live>
        {!playing && last && mover !== null
          ? [
              t('games.o-an-quan.lastMove', {
                who: who(mover),
                n: numberOn(last.cell),
                dir: t(`games.o-an-quan.dirs.${screenDir(last.cell, last.dir)}`),
              }),
              view.taken.length > 0 ? t('games.o-an-quan.took', { n: view.taken.length }) : '',
              view.refill
                ? view.refill.borrowed > 0
                  ? t('games.o-an-quan.refillBorrowed', {
                      who: who(view.refill.seat),
                      n: view.refill.borrowed,
                    })
                  : t('games.o-an-quan.refill', { who: who(view.refill.seat) })
                : '',
            ]
              .filter(Boolean)
              .join(' ')
          : ''}
      </VisuallyHidden>
      {view.refill && (
        <p className="oaq-note">
          {view.refill.borrowed > 0
            ? t('games.o-an-quan.refillBorrowed', { who: who(view.refill.seat), n: view.refill.borrowed })
            : t('games.o-an-quan.refill', { who: who(view.refill.seat) })}
        </p>
      )}
    </div>
  );
}
