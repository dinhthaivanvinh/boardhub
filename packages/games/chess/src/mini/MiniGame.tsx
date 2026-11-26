'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Translator } from '@bg/ui';
import { createRng } from '@bg/engine';
import { squareOf } from '../rules/board';
import type { ChessMove, Piece } from '../rules/types';
import { hintParts } from '../learn/hint-speech';
import { LearnBoard, LessonLayout } from '../learn/LearnBoard';
import { ReadAloud } from '../learn/ReadAloud';
import { waitUntilSilent } from '../learn/speech';
import { Status } from '../learn/Status';
import { useVoice } from '../learn/voice';
import { apply, type MiniBoard, type MiniGameId, pawnMoves } from './common';
import {
  KNIGHT_LEVELS,
  knightBoard,
  knightPar,
  knightSolution,
  knightTargets,
  watched,
} from './knight-stars';
import {
  allMoves,
  bestPawnMove,
  computerPawnMove,
  PAWN_LEVELS,
  pawnResult,
  pawnStart,
  type PawnState,
  playPawn,
} from './pawn-race';
import { starsForMoves } from './progress';
import { ROOK_LEVELS, rookBoard, rookSolution, rookTargets, rookTurn } from './rook-wall';

/** One moment of a game: everything a move changes, so that taking it back is going to the one before. */
export type MiniState = {
  pawns: PawnState;
  /** Stars still to collect (knight). */
  stars: number[];
  moves: number;
};

export type MiniEnd = { stars: number; text: string };

export function miniStart(game: MiniGameId, level: number): MiniState {
  const only = (board: MiniBoard): PawnState => ({ board, turn: 'w', enPassant: null });
  if (game === 'knight-stars') {
    const l = KNIGHT_LEVELS[level - 1]!;
    return { pawns: only(knightBoard(l)), stars: l.stars.map(squareOf), moves: 0 };
  }
  if (game === 'rook-wall') return { pawns: only(rookBoard(ROOK_LEVELS[level - 1]!)), stars: [], moves: 0 };
  return { pawns: pawnStart(PAWN_LEVELS[level - 1]!), stars: [], moves: 0 };
}

/** The squares the piece on `from` may go to. */
export function miniTargets(game: MiniGameId, state: MiniState, from: number): number[] {
  const { board } = state.pawns;
  if (board[from]?.[0] !== 'w') return [];
  if (game === 'knight-stars') return knightTargets(board);
  if (game === 'rook-wall') return rookTargets(board);
  return pawnMoves(board, from, state.pawns.enPassant).map((m) => m.to);
}

/** A move that helps, for the hint button; null when none is known. */
export function miniHint(game: MiniGameId, state: MiniState): ChessMove | null {
  if (game === 'knight-stars') return knightSolution(state.pawns.board, state.stars)?.[0] ?? null;
  if (game === 'rook-wall') return rookSolution(state.pawns.board)?.[0] ?? null;
  return bestPawnMove(state.pawns, 5);
}

const parOf = (game: MiniGameId, level: number): number =>
  game === 'knight-stars'
    ? knightPar(KNIGHT_LEVELS[level - 1]!)
    : rookSolution(rookBoard(ROOK_LEVELS[level - 1]!), 400_000)!.length;

type Props = {
  game: MiniGameId;
  /** From 1. */
  level: number;
  t: Translator;
  animate: boolean;
  lang?: string;
  /** Called once when the level is passed, with the stars earned (1–3). */
  onWon?(stars: number): void;
  /** Shown after the game is over, e.g. the next level. */
  footer?: ReactNode;
  /** Pause before the computer moves, in ms. */
  delay?: number;
  /** The computer's dice; a new one every game unless given. */
  seed?: string;
};

export function MiniGame({ game, level, t, animate, lang = 'vi', onWon, footer, delay = 900, seed }: Props) {
  const voice = useVoice(lang);
  const key = `games.chess.learn.mini.${game}`;
  const c = (k: string, values?: Record<string, string | number>) => t(`${key}.${k}`, values);
  const shared = (k: string, values?: Record<string, string | number>) =>
    t(`games.chess.learn.mini.${k}`, values);

  const par = useMemo(() => (game === 'pawn-race' ? 0 : parOf(game, level)), [game, level]);
  const [history, setHistory] = useState<MiniState[]>([]);
  const [state, setState] = useState(() => miniStart(game, level));
  const [selected, setSelected] = useState<number | null>(null);
  const [slide, setSlide] = useState<{ id: number; from: number; to: number; piece: Piece } | null>(null);
  const [busy, setBusy] = useState(false);
  const [end, setEnd] = useState<MiniEnd | null>(null);
  const [message, setMessage] = useState('');
  const [nonce, setNonce] = useState(0);
  const [hint, setHint] = useState<{ move: ChessMove; level: number } | null>(null);
  const [dice, setDice] = useState(() => seed ?? String(Date.now()));
  const counter = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Changes when the game is set up again or left, so a computer move that is waiting is dropped. */
  const run = useRef(0);
  useEffect(
    () => () => {
      run.current++;
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const say = (text: string) => {
    setMessage(text);
    setNonce((n) => n + 1);
  };
  const slideTo = (piece: Piece, move: ChessMove) => {
    counter.current += 1;
    setSlide({ id: counter.current, from: move.from, to: move.to, piece });
  };
  const finish = (stars: number, text: string) => {
    setEnd({ stars, text });
    say(text);
    setBusy(false);
    if (stars > 0) onWon?.(stars);
  };
  /** The computer's turn: after a pause, and after what was said has been heard. */
  const later = (action: () => void) => {
    const mine = run.current;
    timer.current = setTimeout(() => {
      void waitUntilSilent().then(() => {
        if (run.current === mine) action();
      });
    }, delay);
  };

  const playKnight = (move: ChessMove) => {
    const board = apply(state.pawns.board, move);
    const found = state.stars.includes(move.to);
    const stars = state.stars.filter((s) => s !== move.to);
    const moves = state.moves + 1;
    slideTo('wN', move);
    setState({ pawns: { ...state.pawns, board }, stars, moves });
    if (stars.length === 0) {
      const earned = starsForMoves(moves, par);
      finish(earned, c(`won${earned}`));
    } else {
      say(found ? c('collected') : '');
    }
  };

  const playRook = (move: ChessMove) => {
    const turn = rookTurn(state.pawns.board, move);
    const moves = state.moves + 1;
    const took = state.pawns.board[move.to] === 'bP';
    slideTo('wR', move);
    setState({ ...state, pawns: { ...state.pawns, board: turn.mine }, moves });
    if (turn.outcome === 'won') {
      const earned = starsForMoves(moves, par);
      finish(earned, c(`won${earned}`));
      return;
    }
    say(took ? c('took') : '');
    const { reply } = turn;
    if (!reply) return;
    setBusy(true);
    later(() => {
      slideTo('bP', reply);
      setState({ ...state, pawns: { ...state.pawns, board: turn.board }, moves });
      if (turn.outcome) finish(0, c(turn.outcome));
      else setBusy(false);
    });
  };

  const endPawns = (next: PawnState): boolean => {
    const result = pawnResult(next);
    if (!result) return false;
    if (result.winner === 'w') finish(3, c(result.why === 'reached' ? 'wonReached' : 'wonAll'));
    else if (result.winner === 'b') finish(0, c(result.why === 'reached' ? 'lostReached' : 'lostAll'));
    else finish(1, c('draw'));
    return true;
  };

  const playRace = (move: ChessMove) => {
    const mine = playPawn(state.pawns, move);
    const moves = state.moves + 1;
    slideTo('wP', move);
    setState({ ...state, pawns: mine, moves });
    say('');
    if (endPawns(mine)) return;
    setBusy(true);
    later(() => {
      const reply = computerPawnMove(mine, PAWN_LEVELS[level - 1]!, createRng(`pawns:${dice}`, moves))!;
      const after = playPawn(mine, reply);
      slideTo('bP', reply);
      setState({ ...state, pawns: after, moves });
      if (!endPawns(after)) setBusy(false);
    });
  };

  const click = (s: number) => {
    if (end || busy) return;
    if (state.pawns.board[s]?.[0] === 'w') {
      setSelected(s);
      return;
    }
    if (selected === null) return;
    if (!miniTargets(game, state, selected).includes(s)) {
      const guarded = game === 'knight-stars' && watched(state.pawns.board).has(s);
      say(guarded ? c('guarded') : shared('illegal'));
      return;
    }
    const move = { from: selected, to: s };
    setHistory((h) => [...h, state]);
    setSelected(null);
    setHint(null);
    if (game === 'knight-stars') playKnight(move);
    else if (game === 'rook-wall') playRook(move);
    else playRace(move);
  };

  const reset = (to: MiniState, rest: MiniState[]) => {
    run.current++;
    if (timer.current) clearTimeout(timer.current);
    setState(to);
    setHistory(rest);
    setSelected(null);
    setSlide(null);
    setBusy(false);
    setEnd(null);
    setHint(null);
    setMessage('');
  };
  const restart = () => {
    setDice(seed ?? String(Date.now()));
    reset(miniStart(game, level), []);
  };
  const undo = () => {
    const before = history[history.length - 1];
    if (before) reset(before, history.slice(0, -1));
  };
  const askHint = () => {
    if (hint) {
      setHint({ ...hint, level: 2 });
    } else {
      const move = miniHint(game, state);
      if (!move) {
        say(shared('noWay'));
        return;
      }
      setHint({ move, level: 1 });
    }
    setMessage('');
  };

  const targets = selected === null ? [] : miniTargets(game, state, selected);
  const hinted = new Set<number>(
    hint ? (hint.level > 1 ? [hint.move.from, hint.move.to] : [hint.move.from]) : [],
  );
  const shownHint = hint && !message ? hintParts(t, state.pawns, hint.move, hint.level) : null;
  const board = slide ? state.pawns.board.map((p, i) => (i === slide.to ? null : p)) : state.pawns.board;
  const knightNote =
    game === 'knight-stars' && state.stars.length > 0
      ? shared('starsLeft', { count: state.stars.length })
      : '';

  return (
    <section className="ch-learn" aria-label={c('name')}>
      <LessonLayout
        board={
          <LearnBoard
            board={board}
            t={t}
            animate={animate}
            selected={selected}
            dots={new Set(targets.filter((s) => !state.pawns.board[s]))}
            captures={new Set(targets.filter((s) => state.pawns.board[s]))}
            marks={hinted}
            stars={new Set(state.stars)}
            slide={slide}
            onSquare={click}
          />
        }
      >
        <p className="ch-learn-text">{c('intro')}</p>
        <p className="ch-learn-idea" data-testid="mini-prompt">
          {c('prompt')}
        </p>
        <ReadAloud text={c('intro')} voice={voice} t={t} />
        <p className="text-sm" data-testid="mini-moves">
          {shared('moves', { count: state.moves })}
          {knightNote && <> · {knightNote}</>}
        </p>
        <Status
          voice={voice}
          nonce={nonce}
          text={message || (shownHint ? shownHint.text : '')}
          parts={!message && shownHint ? shownHint.parts : undefined}
        />
        {end && (
          <p className="puzzle-reward" data-testid="mini-end" data-stars={end.stars}>
            <span aria-hidden="true">{'⭐'.repeat(end.stars) || '🙂'}</span>
            <span className="sr-only">{shared('starsEarned', { count: end.stars })}</span>
          </p>
        )}
        <div className="ch-learn-actions">
          {!end && (
            <button
              type="button"
              className="btn"
              onClick={askHint}
              disabled={
                busy ||
                (hint?.level ?? 0) >= 2 ||
                (game === 'pawn-race' && allMoves(state.pawns).length === 0)
              }
            >
              {t('games.chess.learn.hint')}
            </button>
          )}
          <button type="button" className="btn" onClick={undo} disabled={history.length === 0 || busy}>
            <span aria-hidden="true">↶</span> {shared('undo')}
          </button>
          <button type="button" className="btn" onClick={restart}>
            <span aria-hidden="true">↻</span> {shared('restart')}
          </button>
          {end && footer}
        </div>
      </LessonLayout>
    </section>
  );
}
