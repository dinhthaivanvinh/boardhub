'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { fromFen, kingSquare, makeMove, squareName } from '../rules/board';
import type { ChessMove, Piece } from '../rules/types';
import { threatenedSquares } from '../exchange';
import { isCheckmate } from './checkmate';
import { hintParts } from './hint-speech';
import { LearnBoard, LessonLayout } from './LearnBoard';
import { movesFrom, targetsFrom } from './logic';
import { judgePuzzle, solutions, type SkillKind } from './puzzle-kinds';
import { ReadAloud } from './ReadAloud';
import { type RoundProps, type Slide, useTimers } from './rounds';
import { waitUntilSilent } from './speech';
import { Status } from './Status';

export type SkillRound = { kind: SkillKind; fen: string };

/**
 * One puzzle other than "mate in one". A wrong move is shown, with the answer that explains it when there is
 * one, and taken back. A mate in two goes on after the first right move. `after` replaces the hint once solved.
 */
export function PuzzleRoundView(props: RoundProps<SkillRound> & { after?: ReactNode }) {
  const { round, progress, t, c, animate, delay, voice, onSolved } = props;
  const { kind } = round;
  const start = useMemo(() => fromFen(round.fen), [round]);
  const [pos, setPos] = useState(start);
  const [step, setStep] = useState(0);
  const [slide, setSlide] = useState<(Slide & { count: number }) | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [solved, setSolved] = useState(false);
  const [wrong, setWrong] = useState(0);
  const [hint, setHint] = useState(0);
  const [message, setMessage] = useState('');
  const timers = useTimers();
  const [alive] = useState(() => ({ current: true }));
  useEffect(() => {
    alive.current = true;
    const pending = timers.current;
    return () => {
      alive.current = false;
      pending.forEach(clearTimeout);
    };
  }, [alive, timers]);

  const answers = useMemo(() => solutions(kind, pos, step), [kind, pos, step]);
  const suggest = answers[0];
  /** The piece in danger is marked from the start: finding it is not the question. */
  const danger = useMemo(
    () => (kind === 'save' ? (threatenedSquares(start, 'w')[0] ?? null) : null),
    [kind, start],
  );
  const prompt = kind === 'mate2' && step === 1 ? c('mate2.second') : c(`${kind}.prompt`);

  const show = (from: typeof pos, move: ChessMove) => {
    const next = makeMove(from, move);
    setPos(next);
    setSlide((s) => {
      const count = (s?.count ?? 0) + 1;
      return { id: count, count, from: move.from, to: move.to, piece: next.board[move.to] as Piece };
    });
    return next;
  };
  const later = (ms: number, run: () => void) => timers.current.push(setTimeout(run, ms));
  /** After the message has been heard: a child cannot read it instead. */
  const whenHeard = (ms: number, run: () => void) =>
    later(ms, () => void waitUntilSilent().then(() => alive.current && run()));

  const click = (s: number) => {
    if (solved || busy) return;
    if (pos.board[s]?.[0] === 'w') {
      setSelected(s);
      setMessage('');
      return;
    }
    if (selected === null) return;
    const move = movesFrom(pos, selected).find((m) => m.to === s);
    if (!move) {
      setWrong((w) => w + 1);
      setMessage(c('illegal'));
      return;
    }
    const verdict = judgePuzzle(kind, pos, move, step);
    const before = pos;
    setSelected(null);
    setHint(0);
    const next = show(before, move);
    setBusy(true);
    if (verdict.ok) {
      const { reply } = verdict;
      if (!reply) {
        setSolved(true);
        setMessage(c(`${kind}.right`));
        onSolved();
        return;
      }
      setMessage(c('mate2.goOn'));
      whenHeard(delay, () => {
        show(next, reply);
        setStep(1);
        setBusy(false);
        setMessage('');
      });
      return;
    }
    setWrong((w) => w + 1);
    setMessage(c(`${kind}.why.${verdict.why}`));
    const { reply } = verdict;
    if (reply) later(delay / 2, () => show(next, reply));
    whenHeard(delay * 2, () => {
      setPos(before);
      setSlide(null);
      setBusy(false);
    });
  };

  const reach = selected === null ? [] : targetsFrom(pos, selected);
  const hinted = new Set<number>();
  if (!solved && !busy && suggest && hint >= 1) hinted.add(suggest.from);
  if (!solved && !busy && suggest && hint >= 2) hinted.add(suggest.to);
  const hintShown = !message && hint > 0 && suggest && !busy;
  const shownHint = hintShown ? hintParts(t, suggest, hint) : null;
  const mated = solved && isCheckmate(pos) ? kingSquare(pos.board, 'b') : null;
  const board = slide ? pos.board.map((p, i) => (i === slide.to ? null : p)) : pos.board;

  return (
    <LessonLayout
      board={
        <LearnBoard
          board={board}
          t={t}
          animate={animate}
          selected={selected}
          dots={new Set(reach.filter((s) => !pos.board[s]))}
          captures={new Set(reach.filter((s) => pos.board[s]))}
          marks={hinted}
          danger={mated}
          goal={!solved && !busy && step === 0 ? danger : null}
          shake={wrong}
          slide={slide}
          onSquare={click}
        />
      }
    >
      <p className="ch-learn-idea" data-testid="mate-prompt">
        <strong>{progress}</strong> {prompt}
      </p>
      <ReadAloud text={prompt} voice={voice} t={t} />
      <Status
        voice={voice}
        nonce={wrong}
        text={message || (shownHint ? shownHint.text : '')}
        parts={!message && shownHint ? shownHint.parts : undefined}
      />
      {solved ? (
        props.after
      ) : (
        <div className="ch-learn-actions">
          <button
            type="button"
            className="btn"
            disabled={busy || hint >= 2}
            onClick={() => {
              setHint((h) => h + 1);
              setMessage('');
            }}
          >
            {t('games.chess.learn.hint')}
          </button>
        </div>
      )}
      {/* For screen readers and tests: where the marked piece in danger stands. */}
      {danger !== null && step === 0 && !solved && (
        <p className="sr-only">
          {t('games.chess.learn.puzzles.kinds.save.marked', { square: squareName(danger) })}
        </p>
      )}
    </LessonLayout>
  );
}
