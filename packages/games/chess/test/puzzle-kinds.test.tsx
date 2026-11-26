// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import vi from '../src/i18n/vi.json';
import { fromFen, inCheck, legalMoves, makeMove, squareName } from '../src/rules/board';
import type { ChessMove } from '../src/rules/types';
import { winsMaterial } from '../src/exchange';
import { isCheckmate, matingMoves } from '../src/learn/checkmate';
import {
  isFairPuzzle,
  judgePuzzle,
  SKILL_KINDS,
  type SkillKind,
  solutions,
  toughestReply,
} from '../src/learn/puzzle-kinds';
import { PuzzleRoundView } from '../src/learn/PuzzleRoundView';
import { MATE_PUZZLES, nextIn, PUZZLES, puzzlesOfKind, SKILL_PUZZLES } from '../src/learn/puzzles';

afterEach(cleanup);

describe('the skill puzzles', () => {
  it('has thirty of each, with ids and positions used only once among all puzzles', () => {
    for (const kind of SKILL_KINDS) expect(puzzlesOfKind(kind)).toHaveLength(30);
    expect(new Set(PUZZLES.map((p) => p.id)).size).toBe(MATE_PUZZLES.length + SKILL_PUZZLES.length);
    expect(new Set(SKILL_PUZZLES.map((p) => p.fen)).size).toBe(SKILL_PUZZLES.length);
    // Ids the saved progress and the server accept.
    for (const p of PUZZLES) expect(p.id).toMatch(/^[a-z0-9-]{1,40}$/);
  });

  it.each(SKILL_KINDS)(
    'every "%s" puzzle is fair, checked with the engine',
    (kind) => {
      for (const p of puzzlesOfKind(kind)) {
        const pos = fromFen(p.fen);
        expect(isFairPuzzle(kind, pos), p.id).toBe(true);
        expect(inCheck(pos.board, 'w'), p.id).toBe(false);
        expect(solutions(kind, pos).length, p.id).toBeGreaterThan(0);
      }
    },
    120_000,
  );

  it('a mate in two really ends in mate, whatever the defender does', () => {
    for (const p of puzzlesOfKind('mate2')) {
      const pos = fromFen(p.fen);
      expect(matingMoves(pos), p.id).toEqual([]);
      const after = makeMove(pos, solutions('mate2', pos)[0]!);
      for (const reply of legalMoves(after)) {
        expect(matingMoves(makeMove(after, reply)).length, p.id).toBeGreaterThan(0);
      }
    }
  }, 120_000);

  it('after a free capture the piece cannot be won back', () => {
    for (const p of puzzlesOfKind('free')) {
      const pos = fromFen(p.fen);
      expect(winsMaterial(makeMove(pos, solutions('free', pos)[0]!)), p.id).toBeNull();
    }
  });

  it('says why a move is not the answer', () => {
    // The knight can take a guarded pawn or a free bishop.
    const pos = fromFen(puzzlesOfKind('free')[0]!.fen);
    const right = solutions('free', pos)[0]!;
    const wrong = legalMoves(pos).filter((m) => m.from !== right.from || m.to !== right.to);
    const verdicts = wrong.map((m) => judgePuzzle('free', pos, m));
    expect(verdicts.every((v) => !v.ok)).toBe(true);
    expect(verdicts.some((v) => !v.ok && v.why === 'guarded')).toBe(true);
    expect(verdicts.some((v) => !v.ok && v.why === 'noCapture')).toBe(true);
    expect(judgePuzzle('free', pos, right)).toEqual({ ok: true });
  });

  it('every reason a move can be turned down for has a text', () => {
    for (const kind of SKILL_KINDS) {
      const reasons = new Set<string>();
      for (const p of puzzlesOfKind(kind).slice(0, 8)) {
        const pos = fromFen(p.fen);
        for (const m of legalMoves(pos)) {
          const v = judgePuzzle(kind, pos, m);
          if (!v.ok) reasons.add(v.why);
        }
      }
      const texts = vi.learn.puzzles.kinds[kind].why as Record<string, string>;
      for (const why of reasons) expect(texts[why], `${kind}.${why}`).toBeTypeOf('string');
    }
  }, 120_000);

  it('goes on to the next unsolved one of its list', () => {
    const list = puzzlesOfKind('fork');
    expect(nextIn(list, new Set([list[0]!.id]))!.id).toBe(list[1]!.id);
    expect(nextIn(list, new Set(list.map((p) => p.id)))).toBeNull();
  });
});

const get = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);
const tr = (key: string, values?: Record<string, string | number>) => {
  const text = get(vi, key.replace(/^games\.chess\./, ''));
  if (typeof text !== 'string') return key;
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(values?.[k] ?? ''));
};
const c = (key: string, values?: Record<string, string | number>) =>
  tr(`games.chess.learn.puzzles.kinds.${key}`, values);
const at = (s: number) => document.querySelector(`[data-square="${squareName(s)}"]`)!;
const play = (m: ChessMove) => {
  fireEvent.click(at(m.from));
  fireEvent.click(at(m.to));
};
const status = () => screen.getByRole('status').textContent;
const voice = { lang: 'vi', auto: true, onAuto: () => {}, results: true, onResults: () => {} };

const view = (kind: SkillKind, fen: string, onSolved: () => void) =>
  render(
    <PuzzleRoundView
      round={{ kind, fen }}
      progress="1/30"
      t={tr}
      c={c}
      animate={false}
      voice={voice}
      delay={0}
      onSolved={onSolved}
    />,
  );

describe('PuzzleRoundView', () => {
  it.each(SKILL_KINDS)(
    '%s: a wrong move is explained and taken back, then the answer solves it',
    async (kind) => {
      const puzzle = puzzlesOfKind(kind)[0]!;
      const pos = fromFen(puzzle.fen);
      let solved = 0;
      view(kind, puzzle.fen, () => solved++);

      const right = solutions(kind, pos);
      const wrong = legalMoves(pos).find((m) => !right.some((r) => r.from === m.from && r.to === m.to))!;
      const verdict = judgePuzzle(kind, pos, wrong);
      if (verdict.ok) throw new Error('expected a wrong move');
      play(wrong);
      expect(status()).toBe(c(`${kind}.why.${verdict.why}`));
      await waitFor(() => expect(at(wrong.from).getAttribute('data-piece')).toBe(pos.board[wrong.from]));
      expect(solved).toBe(0);

      // The hint names the piece, then the square, of a right move.
      const hint = screen.getByRole('button', { name: tr('games.chess.learn.hint') });
      await waitFor(() => expect((hint as HTMLButtonElement).disabled).toBe(false));
      fireEvent.click(hint);
      expect(status()).toContain(squareName(right[0]!.from));
      fireEvent.click(hint);
      expect(status()).toContain(squareName(right[0]!.to));
      play(right[0]!);

      if (kind === 'mate2') {
        expect(status()).toBe(c('mate2.goOn'));
        const after = makeMove(pos, right[0]!);
        const reply = toughestReply(after)!;
        await waitFor(() =>
          expect(screen.getByTestId('mate-prompt').textContent).toContain(c('mate2.second')),
        );
        const then = makeMove(after, reply);
        const mate = matingMoves(then)[0]!;
        play(mate);
        expect(isCheckmate(makeMove(then, mate))).toBe(true);
      }
      expect(status()).toBe(c(`${kind}.right`));
      expect(solved).toBe(1);
    },
  );
});
