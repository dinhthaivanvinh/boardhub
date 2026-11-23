'use client';

import { useEffect, useMemo, useState } from 'react';
import { CELL, type Translator } from '@bg/ui';
import { fromFen, makeMove, squareOf } from '../rules/board';
import type { ChessMove, Piece, Promotion } from '../rules/types';
import { PieceShape } from '../ui/pieces';
import type { SpecialLessonData } from './data';
import { LearnBoard, LessonLayout } from './LearnBoard';
import { movesFrom, parseMove, specialFrames, targetsFrom } from './logic';
import { ReadAloud, type VoiceState } from './ReadAloud';
import { Status } from './Status';
import { useVoice } from './voice';

type Stage = 'meet' | 'watch' | 'try' | 'done';
const STAGES: Stage[] = ['meet', 'watch', 'try', 'done'];
const STEP_MS = 2800;
const PROMOTIONS: Promotion[] = ['Q', 'R', 'B', 'N'];

type Props = {
  lesson: SpecialLessonData;
  t: Translator;
  animate: boolean;
  onComplete?(id: string): void;
  /** Language of the read-aloud voice: 'vi' or 'en'. */
  lang?: string;
};

/** A special move: what it is, a demo, then the child plays it. */
export function SpecialLesson({ lesson, t, animate, onComplete, lang = 'vi' }: Props) {
  const [stage, setStage] = useState<Stage>('meet');
  const voice = useVoice(lang);
  const text = (key: string) => t(`games.chess.learn.specials.${lesson.id}.${key}`);
  const common = (key: string, values?: Record<string, string | number>) =>
    t(`games.chess.learn.${key}`, values);
  const name = text('name');
  const start = useMemo(() => fromFen(lesson.fen), [lesson]);

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
              {common(`stage.${s === 'try' ? 'challenge' : s}`)}
            </li>
          ))}
        </ol>
      </header>

      {stage === 'meet' && (
        <LessonLayout board={<LearnBoard board={start.board} t={t} animate={animate} />}>
          <p className="ch-learn-text">{text('meet')}</p>
          <ReadAloud text={text('meet')} voice={voice} t={t} />
          <button type="button" className="btn" onClick={() => setStage('watch')}>
            {common('next')}
          </button>
        </LessonLayout>
      )}
      {stage === 'watch' && (
        <Watch
          lesson={lesson}
          t={t}
          animate={animate}
          text={text('move')}
          voice={voice}
          onNext={() => setStage('try')}
        />
      )}
      {stage === 'try' && (
        <Try
          lesson={lesson}
          t={t}
          animate={animate}
          text={text('try')}
          voice={voice}
          onNext={() => {
            setStage('done');
            onComplete?.(lesson.id);
          }}
        />
      )}
      {stage === 'done' && (
        <LessonLayout board={<LearnBoard board={start.board} t={t} animate={animate} />}>
          <Status voice={voice} className="ch-learn-text" text={common('specialDone', { name })} />
          <p className="ch-learn-text">{text('fun')}</p>
          <ReadAloud text={text('fun')} voice={voice} t={t} />
          <button type="button" className="btn" onClick={() => setStage('meet')}>
            {common('again')}
          </button>
        </LessonLayout>
      )}
    </section>
  );
}

type StageProps = {
  lesson: SpecialLessonData;
  t: Translator;
  animate: boolean;
  text: string;
  voice: VoiceState;
  onNext(): void;
};

function Watch({ lesson, t, animate, text, voice, onNext }: StageProps) {
  const frames = useMemo(() => specialFrames(lesson), [lesson]);
  const moves = useMemo(() => lesson.demo.map(parseMove), [lesson]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const moving = animate && !paused;

  useEffect(() => {
    if (!moving) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % frames.length), STEP_MS);
    return () => clearInterval(id);
  }, [moving, frames.length]);

  // Reduced motion or paused: a still picture of the result with the move marked.
  const shown = moving ? index : frames.length - 1;
  const move = shown > 0 ? moves[shown - 1]! : null;
  const board = frames[shown]!.board;
  const slidePiece = move ? (board[move.to] as Piece) : null;
  return (
    <LessonLayout
      board={
        <LearnBoard
          board={moving && move ? board.map((p, s) => (s === move.to ? null : p)) : board}
          t={t}
          animate={animate}
          marks={new Set(!moving && move ? [move.from, move.to] : [])}
          slide={
            moving && move && slidePiece
              ? { id: shown, from: move.from, to: move.to, piece: slidePiece }
              : null
          }
        />
      }
    >
      <p className="ch-learn-text">{text}</p>
      <ReadAloud text={text} voice={voice} t={t} />
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

function Try({ lesson, t, animate, text, voice, onNext }: StageProps) {
  const start = useMemo(() => fromFen(lesson.challenge.fen), [lesson]);
  const from = squareOf(lesson.challenge.from);
  const to = squareOf(lesson.challenge.to);
  const [pos, setPos] = useState(start);
  const [selected, setSelected] = useState<number | null>(null);
  const [wrong, setWrong] = useState(0);
  const [message, setMessage] = useState<'idle' | 'notGoal' | 'illegal' | 'won'>('idle');
  const [choosing, setChoosing] = useState(false);
  const [slide, setSlide] = useState<{ id: number; from: number; to: number; piece: Piece } | null>(null);
  const won = message === 'won';

  const fail = (m: 'notGoal' | 'illegal') => {
    setWrong((w) => w + 1);
    setMessage(m);
  };
  const finish = (move: ChessMove) => {
    const next = makeMove(pos, move);
    setSlide({ id: 1, from: move.from, to: move.to, piece: next.board[move.to] as Piece });
    // The gliding piece is drawn at its new square, so it is taken off the board array.
    setPos({ ...next, board: next.board.map((x, i) => (i === move.to ? null : x)) });
    setSelected(null);
    setChoosing(false);
    setMessage('won');
  };
  const click = (s: number) => {
    if (won || choosing) return;
    const p = pos.board[s];
    if (p && p[0] === 'w') {
      setSelected(s);
      setMessage('idle');
      return;
    }
    if (selected === null) return fail('illegal');
    const options = movesFrom(pos, selected).filter((m) => m.to === s);
    if (options.length === 0) return fail('illegal');
    if (selected !== from || s !== to) return fail('notGoal');
    if (options.some((m) => m.promotion)) {
      setChoosing(true);
      return;
    }
    finish(options[0]!);
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
          goal={won ? null : to}
          shake={wrong}
          slide={slide}
          onSquare={click}
        />
      }
    >
      <p className="ch-learn-text">{text}</p>
      <ReadAloud text={text} voice={voice} t={t} />
      {choosing && (
        <div className="ch-promotion-options" role="group" aria-label={t('games.chess.promoteTo')}>
          {PROMOTIONS.map((type) => (
            <button
              key={type}
              type="button"
              className="ch-promotion-btn"
              aria-label={t(`games.chess.pieceNames.${type}`)}
              onClick={() => finish({ from, to, promotion: type })}
            >
              <svg viewBox={`0 0 ${CELL} ${CELL}`} width="48" height="48" aria-hidden="true">
                <PieceShape piece={`w${type}`} cx={CELL / 2} cy={CELL / 2 + 1} />
              </svg>
            </button>
          ))}
        </div>
      )}
      <Status
        voice={voice}
        text={
          won
            ? t('games.chess.learn.challengeWon')
            : message === 'notGoal'
              ? t('games.chess.learn.challengeNotGoal')
              : message === 'illegal'
                ? t('games.chess.learn.challengeIllegal')
                : choosing
                  ? t('games.chess.promoteTo')
                  : t('games.chess.learn.challengeStart', { square: lesson.challenge.to })
        }
        nonce={wrong}
        speakIt={message !== 'idle'}
      />
      {won && (
        <button type="button" className="btn" onClick={onNext}>
          {t('games.chess.learn.next')}
        </button>
      )}
    </LessonLayout>
  );
}
