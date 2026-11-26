// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createRng } from '@bg/engine';
import vi from '../src/i18n/vi.json';
import { squareName, squareOf } from '../src/rules/board';
import type { ChessMove } from '../src/rules/types';
import { apply, boardWith, MINI_GAME_IDS, pawnMoves } from '../src/mini/common';
import {
  KNIGHT_LEVELS,
  knightBoard,
  knightPar,
  knightSolution,
  knightTargets,
  watched,
} from '../src/mini/knight-stars';
import { MiniGame, miniHint, miniStart, miniTargets } from '../src/mini/MiniGame';
import {
  allMoves,
  bestPawnMove,
  computerPawnMove,
  PAWN_LEVELS,
  pawnResult,
  pawnStart,
  playPawn,
} from '../src/mini/pawn-race';
import { MINI_LEVELS, readMiniProgress, saveMiniStars, starsForMoves } from '../src/mini/progress';
import { pawnsReply, ROOK_LEVELS, rookBoard, rookSolution, rookTurn } from '../src/mini/rook-wall';

afterEach(cleanup);

const names = (squares: Iterable<number>) => [...squares].map(squareName).sort();

describe('star knight', () => {
  it('every level can be done, and no star lies on a pawn or a watched square', () => {
    for (const [i, level] of KNIGHT_LEVELS.entries()) {
      const board = knightBoard(level);
      const stars = level.stars.map(squareOf);
      for (const s of stars) {
        expect(watched(board).has(s), `level ${i + 1} ${squareName(s)}`).toBe(false);
        expect(board[s], `level ${i + 1}`).toBeNull();
      }
      expect(knightSolution(board, stars), `level ${i + 1}`).not.toBeNull();
    }
  });

  it('gets longer towards the end, starting with a single jump', () => {
    const pars = KNIGHT_LEVELS.map(knightPar);
    expect(pars[0]).toBe(1);
    expect(pars.at(-1)).toBe(Math.max(...pars));
  });

  it('may not stop where a black pawn watches', () => {
    // A pawn on c4 watches b3 and d3.
    const board = boardWith({ wN: ['c1'], bP: ['c4'] });
    expect(names(watched(board))).toEqual(['b3', 'd3']);
    expect(names(knightTargets(board))).toEqual(['a2', 'e2']);
  });
});

describe('rook against pawns', () => {
  it('every level can be won against the pawns, step by step', () => {
    for (const [i, level] of ROOK_LEVELS.entries()) {
      let board = rookBoard(level);
      const way = rookSolution(board, 400_000);
      expect(way, `level ${i + 1}`).not.toBeNull();
      const outcomes = way!.map((move) => {
        const turn = rookTurn(board, move);
        board = turn.board;
        return turn.outcome;
      });
      expect(outcomes.at(-1)).toBe('won');
      expect(outcomes.slice(0, -1).every((o) => o === null)).toBe(true);
    }
  }, 120_000);

  it('a pawn takes the rook when it can, and a pawn that gets to the last row ends it', () => {
    const board = boardWith({ wR: ['c4'], bP: ['d5', 'a7'] });
    expect(pawnsReply(board)).toEqual({ from: squareOf('d5'), to: squareOf('c4') });
    expect(
      rookTurn(boardWith({ wR: ['h8'], bP: ['a2'] }), { from: squareOf('h8'), to: squareOf('g8') }).outcome,
    ).toBe('queened');
    expect(
      rookTurn(boardWith({ wR: ['h5'], bP: ['d5'] }), { from: squareOf('h5'), to: squareOf('d5') }).outcome,
    ).toBe('won');
  });

  it('pawns that cannot move leave the turn to the rook', () => {
    expect(pawnsReply(boardWith({ wR: ['a2'], bP: ['a3'] }))).toBeNull();
  });
});

describe('pawn race', () => {
  it('takes en passant, and ends when a pawn gets across or nobody can move', () => {
    let s = { board: boardWith({ wP: ['e5'], bP: ['d7'] }), turn: 'b' as const, enPassant: null };
    const after = playPawn(s, { from: squareOf('d7'), to: squareOf('d5') });
    expect(after.enPassant).toBe(squareOf('d6'));
    const taken = playPawn(after, { from: squareOf('e5'), to: squareOf('d6') });
    expect(taken.board[squareOf('d5')]).toBeNull();
    expect(pawnResult(taken)).toEqual({ winner: 'w', why: 'noPawns' });
    expect(pawnResult({ board: boardWith({ wP: ['a8'], bP: ['h7'] }), turn: 'b', enPassant: null })).toEqual({
      winner: 'w',
      why: 'reached',
    });
    s = { board: boardWith({ wP: ['a4'], bP: ['a5'] }), turn: 'b', enPassant: null };
    expect(pawnResult(s)).toEqual({ winner: null, why: 'stuck' });
    expect(pawnMoves(s.board, squareOf('a5'))).toEqual([]);
  });

  it('sees a pawn that can get across at once', () => {
    const s = { board: boardWith({ wP: ['b7'], bP: ['g3'] }), turn: 'w' as const, enPassant: null };
    expect(bestPawnMove(s, 4)).toEqual({ from: squareOf('b7'), to: squareOf('b8') });
  });

  it.each([1, 2, 3])(
    'level %i can be beaten by good play, and the computer only plays legal moves',
    (number) => {
      const level = PAWN_LEVELS[number - 1]!;
      let wins = 0;
      for (let game = 0; game < 8 && wins === 0; game++) {
        let s = pawnStart(level);
        for (let ply = 0; ply < 80 && !pawnResult(s); ply++) {
          const move =
            s.turn === 'w'
              ? bestPawnMove(s, 6, createRng(`w${game}`, ply))!
              : computerPawnMove(s, level, createRng(`b${game}`, ply))!;
          expect(allMoves(s)).toContainEqual(move);
          s = playPawn(s, move);
        }
        if (pawnResult(s)?.winner === 'w') wins++;
      }
      expect(wins).toBeGreaterThan(0);
    },
    180_000,
  );
});

describe('stars of the little games', () => {
  const memory = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };

  it('keeps the best of each level and survives broken storage', () => {
    const store = memory();
    saveMiniStars(store, 'knight-stars', 1, 2);
    saveMiniStars(store, 'knight-stars', 1, 1);
    saveMiniStars(store, 'rook-wall', 2, 3);
    saveMiniStars(store, 'pawn-race', 1, 0);
    expect(readMiniProgress(store)).toEqual({ 'knight-stars:1': 2, 'rook-wall:2': 3 });
    store.setItem('learn.chess.mini.v1', '{nope');
    expect(readMiniProgress(store)).toEqual({});
    expect(readMiniProgress(null)).toEqual({});
  });

  it('gives three stars for the shortest way', () => {
    expect([starsForMoves(4, 4), starsForMoves(6, 4), starsForMoves(9, 4)]).toEqual([3, 2, 1]);
  });

  it('every level of every game has a start and a hint', () => {
    for (const game of MINI_GAME_IDS) {
      for (let level = 1; level <= MINI_LEVELS[game]; level++) {
        const state = miniStart(game, level);
        const hint = miniHint(game, state)!;
        expect(miniTargets(game, state, hint.from), `${game} ${level}`).toContain(hint.to);
      }
    }
  }, 120_000);
});

const get = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);
const tr = (key: string, values?: Record<string, string | number>) => {
  const text = get(vi, key.replace(/^games\.chess\./, ''));
  if (typeof text !== 'string') return key;
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(values?.[k] ?? ''));
};
const c = (key: string, values?: Record<string, string | number>) =>
  tr(`games.chess.learn.mini.${key}`, values);
const at = (name: string) => document.querySelector(`[data-square="${name}"]`)!;
const play = (m: ChessMove) => {
  fireEvent.click(at(squareName(m.from)));
  fireEvent.click(at(squareName(m.to)));
};
const status = () => screen.getByRole('status').textContent;
const button = (name: RegExp | string) => screen.getByRole('button', { name }) as HTMLButtonElement;

describe('MiniGame', () => {
  it('the knight collects the stars; a watched square is explained; moves can be taken back', async () => {
    const won: number[] = [];
    render(
      <MiniGame game="knight-stars" level={5} t={tr} animate={false} delay={0} onWon={(s) => won.push(s)} />,
    );
    expect(document.querySelectorAll('[data-star="true"]')).toHaveLength(2);
    fireEvent.click(at('b1'));
    fireEvent.click(at('d3')); // watched by the pawn on c4
    expect(status()).toBe(c('knight-stars.guarded'));

    const level = KNIGHT_LEVELS[4]!;
    const way = knightSolution(knightBoard(level), level.stars.map(squareOf))!;
    play(way[0]!);
    fireEvent.click(button(new RegExp(c('undo'))));
    expect(at('b1').getAttribute('data-piece')).toBe('wN');

    for (const move of way) play(move);
    expect(status()).toBe(c('knight-stars.won3'));
    expect(screen.getByTestId('mini-end').dataset.stars).toBe('3');
    expect(won).toEqual([3]);
    fireEvent.click(button(new RegExp(c('restart'))));
    expect(document.querySelectorAll('[data-star="true"]')).toHaveLength(2);
  });

  it('the rook wins level 1 with the pawns answering', async () => {
    const won: number[] = [];
    render(
      <MiniGame game="rook-wall" level={1} t={tr} animate={false} delay={0} onWon={(s) => won.push(s)} />,
    );
    let board = rookBoard(ROOK_LEVELS[0]!);
    /**
     * The squares where the screen differs from `expected`. The piece that has just moved is drawn by the slide
     * above the board, so its square reads as empty: that one is allowed.
     */
    const off = (expected: readonly (string | null)[]) =>
      expected.filter((piece, i) => {
        const shown = at(squareName(i)).getAttribute('data-piece');
        return shown !== piece;
      });
    for (const move of rookSolution(board)!) {
      const turn = rookTurn(board, move);
      // The pawns have answered: every black pawn stands where the rules put it.
      await waitFor(() => expect(off(board).length).toBeLessThanOrEqual(1));
      play(move);
      board = turn.board;
    }
    await waitFor(() => expect(status()).toBe(c('rook-wall.won3')));
    expect(won).toEqual([3]);
  });

  it('the pawn race: the computer answers, the hint is a legal move, and a game can be restarted', async () => {
    render(<MiniGame game="pawn-race" level={2} t={tr} animate={false} delay={0} seed="test" />);
    const start = pawnStart(PAWN_LEVELS[1]!);
    const hint = bestPawnMove(start, 5)!;
    fireEvent.click(button(tr('games.chess.learn.hint')));
    expect(status()).toContain(squareName(hint.from));
    fireEvent.click(button(tr('games.chess.learn.hint')));
    expect(status()).toContain(squareName(hint.to));
    play(hint);
    const mine = apply(start.board, hint);
    // Black has moved: its pawns are not where they were.
    await waitFor(() => {
      const now = Array.from({ length: 64 }, (_, s) => at(squareName(s)).getAttribute('data-piece'));
      expect(now).not.toEqual(mine);
    });
    fireEvent.click(button(new RegExp(c('restart'))));
    expect(screen.getByTestId('mini-moves').textContent).toBe(c('moves', { count: 0 }));
  });
});
