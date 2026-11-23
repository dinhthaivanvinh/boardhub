'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Translator } from '@bg/ui';
import { makeMove, squareOf } from '../rules/board';
import type { Piece } from '../rules/types';
import type { PieceLessonData } from './data';
import { LearnBoard, LessonLayout } from './LearnBoard';
import { challengePosition, demoPosition, demoSquares, movesFrom, squaresToFind, targetsFrom } from './logic';

type Stage = 'meet' | 'watch' | 'try' | 'challenge' | 'done';
const STAGES: Stage[] = ['meet', 'watch', 'try', 'challenge', 'done'];
// Slow on purpose: a child needs time to see where the piece goes.
const STEP_MS = 2800;

type Props = { lesson: PieceLessonData; t: Translator; animate: boolean; onComplete?(id: string): void };
type StageProps = { lesson: PieceLessonData; t: Translator; animate: boolean; text: string; onNext(): void };

/** Meet the piece, watch how it moves, find its squares, then one small challenge. */
export function PieceLesson({ lesson, t, animate, onComplete }: Props) {
  const [stage, setStage] = useState<Stage>('meet');
  const text = (key: string) => t(`games.chess.learn.pieces.${lesson.id}.${key}`);
  const common = (key: string, values?: Record<string, string | number>) =>
    t(`games.chess.learn.${key}`, values);
  const demo = useMemo(() => demoPosition(lesson), [lesson]);
  const name = t(`games.chess.pieceNames.${lesson.piece}`);

  return (
    <section className="ch-learn" aria-label={name}>
      <header className="ch-learn-header">
        <h2 className="ch-learn-title">{name}</h2>
        <ol className="ch-learn-steps" aria-label={common('steps')}>
          {STAGES.map((s) => (
            <li
              key={s}
              aria-current={s === stage ? 'step' : undefined}
              data-done={STAGES.indexOf(s) < STAGES.indexOf(stage)}
            >
              {common(`stage.${s}`)}
            </li>
          ))}
        </ol>
      </header>

      {stage === 'meet' && (
        <LessonLayout
          board={
            <LearnBoard board={demo.board} t={t} animate={animate} marks={new Set([squareOf(lesson.from)])} />
          }
        >
          <p className="ch-learn-text">{text('meet')}</p>

          <button type="button" className="btn" onClick={() => setStage('watch')}>
            {common('next')}
          </button>
        </LessonLayout>
      )}
      {stage === 'watch' && (
        <Watch lesson={lesson} t={t} animate={animate} text={text('move')} onNext={() => setStage('try')} />
      )}
      {stage === 'try' && (
        <Try
          lesson={lesson}
          t={t}
          animate={animate}
          text={text('try')}
          onNext={() => setStage('challenge')}
        />
      )}
      {stage === 'challenge' && (
        <Challenge
          lesson={lesson}
          t={t}
          animate={animate}
          text={text('challenge')}
          onNext={() => {
            setStage('done');
            onComplete?.(lesson.id);
          }}
        />
      )}
      {stage === 'done' && (
        <>
          <p className="ch-learn-text" role="status">
            {common('pieceDone', { piece: name })}
          </p>
          <p className="ch-learn-text">{text('fun')}</p>
          <button type="button" className="btn" onClick={() => setStage('meet')}>
            {common('again')}
          </button>
        </>
      )}
    </section>
  );
}

function Watch({ lesson, t, animate, text, onNext }: StageProps) {
  const pos = useMemo(() => demoPosition(lesson), [lesson]);
  const from = squareOf(lesson.from);
  const piece = pos.board[from] as Piece;
  const all = useMemo(() => targetsFrom(pos, from), [pos, from]);
  const steps = useMemo(() => demoSquares(all), [all]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const moving = animate && !paused;

  useEffect(() => {
    if (!moving) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % steps.length), STEP_MS);
    return () => clearInterval(id);
  }, [moving, steps.length]);

  // Reduced motion or paused: a still picture, the piece at home and every square it reaches.
  const board = moving ? pos.board.map((p, s) => (s === from ? null : p)) : pos.board;
  const dots = moving ? new Set(steps.slice(0, index + 1)) : new Set(all);
  return (
    <LessonLayout
      board={
        <LearnBoard
          board={board}
          t={t}
          animate={animate}
          dots={dots}
          slide={moving ? { id: index, from, to: steps[index]!, piece } : null}
        />
      }
    >
      <p className="ch-learn-text">{text}</p>

      <div className="ch-learn-actions">
        {animate && (
          <button type="button" className="btn" onClick={() => setPaused((p) => !p)}>
            {t(paused ? 'games.chess.learn.play' : 'games.chess.learn.pause')}
          </button>
        )}
        <button type="button" className="btn" onClick={onNext}>
          {t('games.chess.learn.next')}
        </button>
      </div>
    </LessonLayout>
  );
}

function Try({ lesson, t, animate, text, onNext }: StageProps) {
  const pos = useMemo(() => demoPosition(lesson), [lesson]);
  const from = squareOf(lesson.from);
  const targets = useMemo(() => new Set(targetsFrom(pos, from)), [pos, from]);
  const need = squaresToFind(targets.size);
  const [found, setFound] = useState<ReadonlySet<number>>(new Set());
  const [wrong, setWrong] = useState(0);
  const done = found.size >= need;

  const click = (s: number) => {
    if (done || s === from) return;
    if (targets.has(s)) setFound((f) => new Set(f).add(s));
    else setWrong((w) => w + 1);
  };
  return (
    <LessonLayout
      board={
        <LearnBoard
          board={pos.board}
          t={t}
          animate={animate}
          selected={from}
          dots={found}
          shake={wrong}
          onSquare={click}
        />
      }
    >
      <p className="ch-learn-text">{text}</p>

      <p className="ch-learn-status" role="status" aria-live="polite">
        {done
          ? t('games.chess.learn.tryDone')
          : wrong > 0 && found.size === 0
            ? t('games.chess.learn.tryWrong')
            : t('games.chess.learn.found', { n: found.size, total: need })}
      </p>
      {done && (
        <button type="button" className="btn" onClick={onNext}>
          {t('games.chess.learn.next')}
        </button>
      )}
    </LessonLayout>
  );
}

function Challenge({ lesson, t, animate, text, onNext }: StageProps) {
  const start = useMemo(() => challengePosition(lesson), [lesson]);
  const goal = squareOf(lesson.challenge.goal);
  const [pos, setPos] = useState(start);
  const [selected, setSelected] = useState<number | null>(null);
  const [wrong, setWrong] = useState(0);
  const [message, setMessage] = useState<'idle' | 'notGoal' | 'illegal' | 'won'>('idle');
  const [slide, setSlide] = useState<{ id: number; from: number; to: number; piece: Piece } | null>(null);
  const won = message === 'won';

  const fail = (m: 'notGoal' | 'illegal') => {
    setWrong((w) => w + 1);
    setMessage(m);
  };
  const click = (s: number) => {
    if (won) return;
    const p = pos.board[s];
    if (p && p[0] === 'w') {
      setSelected(s);
      setMessage('idle');
      return;
    }
    if (selected === null) return fail('illegal');
    const move = movesFrom(pos, selected).find((m) => m.to === s);
    if (!move) return fail('illegal');
    if (s !== goal) return fail('notGoal');
    const next = makeMove(pos, move);
    setSlide({ id: 1, from: selected, to: s, piece: pos.board[selected] as Piece });
    // The gliding piece is drawn at the goal, so it is taken off the board array.
    setPos({ ...next, board: next.board.map((x, i) => (i === s ? null : x)) });
    setSelected(null);
    setMessage('won');
  };

  const reach = selected === null ? [] : targetsFrom(pos, selected);
  return (
    <LessonLayout
      board={
        <LearnBoard
          board={pos.board}
          t={t}
          animate={animate}
          selected={selected}
          dots={new Set(reach.filter((s) => !pos.board[s]))}
          captures={new Set(reach.filter((s) => pos.board[s]))}
          goal={won ? null : goal}
          shake={wrong}
          slide={slide}
          onSquare={click}
        />
      }
    >
      <p className="ch-learn-text">{text}</p>

      <p className="ch-learn-status" role="status" aria-live="polite">
        {message === 'won'
          ? t('games.chess.learn.challengeWon')
          : message === 'notGoal'
            ? t('games.chess.learn.challengeNotGoal')
            : message === 'illegal'
              ? t('games.chess.learn.challengeIllegal')
              : t('games.chess.learn.challengeStart', { square: lesson.challenge.goal })}
      </p>
      {won && (
        <button type="button" className="btn" onClick={onNext}>
          {t('games.chess.learn.next')}
        </button>
      )}
    </LessonLayout>
  );
}
