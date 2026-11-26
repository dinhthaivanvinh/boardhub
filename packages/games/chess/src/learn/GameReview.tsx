'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Translator } from '@bg/ui';
import { kingSquare, legalMoves, makeMove, squareName } from '../rules/board';
import { colorOfSeat, positionOf } from '../rules/rules';
import type { ChessMove, ChessState, Piece } from '../rules/types';
import { judgePlayed, type Moment, pickMoments, putsRight } from '../review';
import { hintParts } from './hint-speech';
import { LearnBoard, LessonLayout } from './LearnBoard';
import { movesFrom, targetsFrom } from './logic';
import { Status } from './Status';
import { useVoice } from './voice';

export type GameReviewProps = {
  /** The position before each move, and one more for the end. */
  states: readonly ChessState[];
  moves: readonly { seat: number; move: ChessMove }[];
  /** The seat the child played. */
  seat: number;
  t: Translator;
  animate: boolean;
  lang?: string;
  onClose(): void;
};

/** The words about a moment, as shown and as read: the sentence, then the piece and square it is about. */
export function momentWords(t: Translator, moment: Moment): { text: string; parts: string[] } {
  const sentence = t(`games.chess.learn.review.kind.${moment.kind}`);
  if (moment.square === undefined) return { text: sentence, parts: [sentence] };
  // The piece left behind stands where it is after the move; a piece to be won, before it.
  const pos = positionOf(moment.state);
  const board = moment.kind === 'hung' ? makeMove(pos, moment.played).board : pos.board;
  const piece = t(`games.chess.pieceNames.${board[moment.square]![1]}`);
  const where = t('games.chess.coach.say.at', { square: squareName(moment.square) });
  return { text: `${sentence} ${piece} ${where}`, parts: [sentence, piece, where] };
}

/**
 * Looks over a finished game one move at a time (without holding up the page), then shows the one or two moments
 * worth a second look, and lets the child play each of them again.
 */
export function GameReview({ states, moves, seat, t, animate, lang = 'vi', onClose }: GameReviewProps) {
  const voice = useVoice(lang);
  const c = (key: string, values?: Record<string, string | number>) =>
    t(`games.chess.learn.review.${key}`, values);
  const mine = useMemo(
    () => moves.map((m, i) => ({ ...m, index: i })).filter((m) => m.seat === seat),
    [moves, seat],
  );
  const [checked, setChecked] = useState(0);
  const [moments, setMoments] = useState<Moment[] | null>(null);
  const found = useRef<Moment[]>([]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    found.current = [];
    const step = (i: number) => {
      if (cancelled) return;
      const turn = mine[i];
      if (!turn) {
        setMoments(pickMoments(found.current));
        return;
      }
      const state = states[turn.index]!;
      const mistake = judgePlayed(state, turn.move);
      if (mistake) found.current.push({ ...mistake, state, moveNumber: Math.floor(turn.index / 2) + 1 });
      setChecked(i + 1);
      // A pause between moves lets the page draw and answer taps.
      timer = setTimeout(() => step(i + 1), 0);
    };
    timer = setTimeout(() => step(0), 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mine, states]);

  const [index, setIndex] = useState(0);
  const flipped = seat === 1;

  return (
    <section className="ch-learn" aria-label={c('title')}>
      <header className="ch-learn-header">
        <h2 className="ch-learn-title">{c('title')}</h2>
        <button type="button" className="btn ch-back" onClick={onClose}>
          <span aria-hidden="true">←</span> {c('close')}
        </button>
      </header>
      {!moments ? (
        <p role="status" className="ch-learn-text" data-testid="review-progress">
          {c('working', { done: checked, total: mine.length })}
        </p>
      ) : moments.length === 0 ? (
        <LessonLayout
          board={
            <LearnBoard board={states[states.length - 1]!.board} flipped={flipped} t={t} animate={false} />
          }
        >
          <Status voice={voice} className="ch-learn-text" text={c('clean')} />
          <p className="text-sm text-[var(--muted)]">{c('limits')}</p>
        </LessonLayout>
      ) : (
        <MomentView
          key={index}
          moment={moments[index]!}
          position={`${index + 1}/${moments.length}`}
          flipped={flipped}
          seat={seat}
          t={t}
          c={c}
          animate={animate}
          voice={voice}
          onNext={index + 1 < moments.length ? () => setIndex(index + 1) : undefined}
          limits={c('limits')}
        />
      )}
    </section>
  );
}

/** One moment: what happened, the move shown, and a new try at it. */
function MomentView({
  moment,
  position,
  flipped,
  seat,
  t,
  c,
  animate,
  voice,
  onNext,
  limits,
}: {
  moment: Moment;
  position: string;
  flipped: boolean;
  seat: number;
  t: Translator;
  c(key: string, values?: Record<string, string | number>): string;
  animate: boolean;
  voice: ReturnType<typeof useVoice>;
  onNext?: (() => void) | undefined;
  limits: string;
}) {
  const start = useMemo(() => positionOf(moment.state), [moment]);
  const words = useMemo(() => momentWords(t, moment), [t, moment]);
  /** 'look': the position with the move marked; 'shown': after it and its answer; 'retry': a new try. */
  const [mode, setMode] = useState<'look' | 'shown' | 'retry' | 'solved'>('look');
  const [selected, setSelected] = useState<number | null>(null);
  const [after, setAfter] = useState<ChessMove | null>(null);
  const [message, setMessage] = useState<{ text: string; parts?: string[] }>(words);
  const [nonce, setNonce] = useState(0);
  const [hint, setHint] = useState(0);
  const say = (next: { text: string; parts?: string[] }) => {
    setMessage(next);
    setNonce((n) => n + 1);
  };

  const mineColor = colorOfSeat(seat);
  const played = makeMove(start, moment.played);
  const board =
    mode === 'shown'
      ? moment.reply
        ? makeMove(played, moment.reply).board
        : played.board
      : after
        ? makeMove(start, after).board
        : start.board;
  const marked = new Set<number>();
  if (mode === 'look') [moment.played.from, moment.played.to].forEach((s) => marked.add(s));
  if (mode === 'shown') {
    const last = moment.reply ?? moment.played;
    [last.from, last.to].forEach((s) => marked.add(s));
  }
  if (mode === 'retry' && hint >= 1) marked.add(moment.better.from);
  if (mode === 'retry' && hint >= 2) marked.add(moment.better.to);

  const click = (s: number) => {
    if (mode !== 'retry') return;
    const piece: Piece | null = start.board[s] ?? null;
    if (piece?.[0] === mineColor) {
      setSelected(s);
      return;
    }
    if (selected === null) return;
    const move = movesFrom(start, selected).find((m) => m.to === s);
    if (!move) {
      say({ text: c('illegal') });
      return;
    }
    setSelected(null);
    if (putsRight(moment.state, moment, move)) {
      setAfter(move);
      setMode('solved');
      say({ text: c('right') });
    } else {
      setHint(0);
      say({ text: c('wrong') });
    }
  };

  const reach = selected === null ? [] : targetsFrom(start, selected);
  const shownMate = mode === 'shown' && moment.kind === 'allowedMate' ? kingSquare(board, mineColor) : null;
  const legal = useMemo(() => legalMoves(start), [start]);

  return (
    <LessonLayout
      board={
        <LearnBoard
          board={board}
          flipped={flipped}
          t={t}
          animate={animate}
          selected={selected}
          dots={new Set(reach.filter((s) => !start.board[s]))}
          captures={new Set(reach.filter((s) => start.board[s]))}
          marks={marked}
          danger={shownMate}
          onSquare={click}
        />
      }
    >
      <p className="ch-learn-idea" data-testid="review-moment">
        <strong>{position}</strong> {c('moveNumber', { n: moment.moveNumber })}
      </p>
      <Status
        voice={voice}
        className="ch-learn-text"
        text={message.text}
        parts={message.parts}
        nonce={nonce}
      />
      <div className="ch-learn-actions">
        {mode === 'look' && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setMode('shown');
              say({ text: c(moment.reply ? 'shownReply' : 'shownMove') });
            }}
          >
            {c('show')}
          </button>
        )}
        {mode !== 'retry' && mode !== 'solved' && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={legal.length === 0}
            onClick={() => {
              setMode('retry');
              setHint(0);
              say({ text: c('retryPrompt') });
            }}
          >
            {c('retry')}
          </button>
        )}
        {mode === 'retry' && (
          <button
            type="button"
            className="btn"
            disabled={hint >= 2}
            onClick={() => {
              const level = hint + 1;
              setHint(level);
              say(hintParts(t, start, moment.better, level));
            }}
          >
            {t('games.chess.learn.hint')}
          </button>
        )}
        {onNext && (
          <button
            type="button"
            className={mode === 'solved' ? 'btn btn-primary ch-next' : 'btn'}
            onClick={onNext}
          >
            {c('next')}
          </button>
        )}
        <button
          type="button"
          className="btn"
          onClick={() => {
            setMode('look');
            setAfter(null);
            setSelected(null);
            setHint(0);
            say(words);
          }}
        >
          <span aria-hidden="true">↻</span> {c('again')}
        </button>
      </div>
      <p className="text-sm text-[var(--muted)]">{limits}</p>
    </LessonLayout>
  );
}
