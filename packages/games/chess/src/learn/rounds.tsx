'use client';

import { Fragment, useEffect, useState, type ReactNode } from 'react';
import type { Translator } from '@bg/ui';
import type { ChessMove, Piece, Position } from '../rules/types';
import { LearnBoard, LessonLayout } from './LearnBoard';
import { ReadAloud, type VoiceState } from './ReadAloud';
import { Status } from './Status';
import { waitUntilSilent } from './speech';

/** Text lookup inside one lesson's own namespace (games.chess.learn.<lesson>.*). */
export type Tx = (key: string, values?: Record<string, string | number>) => string;

/** What a round of questions gets from its stage. */
export type RoundProps<R> = {
  round: R;
  progress: string;
  t: Translator;
  c: Tx;
  animate: boolean;
  voice: VoiceState;
  delay: number;
  onSolved(): void;
};

/** Runs the rounds of one stage in order: a right answer moves on by itself, the last one shows Continue. */
export function Stage<R>({
  kind,
  rounds,
  render,
  finishedBoard,
  t,
  c,
  animate,
  voice,
  delay,
  onNext,
}: {
  kind: string;
  rounds: R[];
  render(props: RoundProps<R>): ReactNode;
  /** The board shown beside "well done" when the stage is finished. */
  finishedBoard: readonly (Piece | null)[];
  t: Translator;
  c: Tx;
  animate: boolean;
  voice: VoiceState;
  delay: number;
  onNext(): void;
}) {
  const [index, setIndex] = useState(0);
  const [solved, setSolved] = useState(false);
  const finished = index >= rounds.length;

  useEffect(() => {
    if (!solved) return;
    // After the pause, wait until the spoken result has been heard: a child cannot read it instead.
    let cancelled = false;
    const id = setTimeout(() => {
      void waitUntilSilent().then(() => {
        if (cancelled) return;
        setIndex((i) => i + 1);
        setSolved(false);
      });
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [solved, delay]);

  if (finished) {
    return (
      <LessonLayout board={<LearnBoard board={finishedBoard} t={t} animate={animate} />}>
        <p className="ch-learn-text">{c(`intro.${kind}`)}</p>
        <Status voice={voice} text={c('allDone')} />
        <button type="button" className="btn btn-primary" onClick={onNext}>
          {t('games.chess.learn.next')}
        </button>
      </LessonLayout>
    );
  }
  return (
    <Fragment key={index}>
      {render({
        round: rounds[index]!,
        progress: `${index + 1}/${rounds.length}`,
        t,
        c,
        animate,
        voice,
        delay,
        onSolved: () => setSolved(true),
      })}
    </Fragment>
  );
}

/** The side panel every round shares: what to do, the voice, and the message. */
export function Panel({
  kind,
  prompt,
  progress,
  message,
  extra,
  nonce = 0,
  props,
}: {
  kind: string;
  prompt: string;
  progress: string;
  message: string;
  extra?: ReactNode;
  /** Changes with every wrong answer, so the same message is read again. */
  nonce?: number;
  props: Pick<RoundProps<unknown>, 'c' | 't' | 'voice'>;
}) {
  return (
    <>
      <p className="ch-learn-text">{props.c(`intro.${kind}`)}</p>
      <p className="ch-learn-idea" data-testid="mate-prompt">
        <strong>{progress}</strong> {prompt}
      </p>
      <ReadAloud text={prompt} voice={props.voice} t={props.t} />
      {extra}
      <Status voice={props.voice} text={message} nonce={nonce} />
    </>
  );
}

export type Slide = { id: number; from: number; to: number; piece: Piece };

/** Select a piece and a square with the legal moves of a position, and show the result with a slide. */
export function useMoveBoard(start: Position) {
  const [pos, setPos] = useState(start);
  const [selected, setSelected] = useState<number | null>(null);
  const [slide, setSlide] = useState<Slide | null>(null);
  const [count, setCount] = useState(0);
  // The piece that just moved is drawn by the slide, so it leaves the board array.
  const board = slide ? pos.board.map((p, i) => (i === slide.to ? null : p)) : pos.board;
  const play = (next: Position, move: ChessMove) => {
    const id = count + 1;
    setCount(id);
    setSlide({ id, from: move.from, to: move.to, piece: next.board[move.to] as Piece });
    setPos(next);
    setSelected(null);
  };
  const reset = () => {
    setPos(start);
    setSlide(null);
    setSelected(null);
  };
  return { pos, board, selected, setSelected, slide, play, reset };
}

/** Timers kept in a ref so they are cleared when the round goes away. */
export function useTimers() {
  const [ref] = useState(() => ({ current: [] as ReturnType<typeof setTimeout>[] }));
  return ref;
}
