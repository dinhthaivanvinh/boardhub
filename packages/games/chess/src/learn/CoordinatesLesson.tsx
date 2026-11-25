'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Translator } from '@bg/ui';
import { fromFen, squareName, START_FEN } from '../rules/board';
import { COORDINATES_LESSON_ID } from './data';
import { type CoordKind, type CoordRound, coordRounds, fileOf, rankOf } from './coordinates';
import { LearnBoard, LessonLayout } from './LearnBoard';
import { DoneCard, LessonHeader } from './LessonChrome';
import { ReadAloud, type VoiceState } from './ReadAloud';
import { waitUntilSilent } from './speech';
import { Status } from './Status';
import { useVoice } from './voice';

type Stage = 'meet' | CoordKind | 'done';
const STAGES: Stage[] = ['meet', 'rank', 'file', 'cross', 'find', 'treasure', 'done'];
const EMPTY_BOARD = Array.from({ length: 64 }, () => null);
const ROUNDS = 5;

type Props = {
  t: Translator;
  animate: boolean;
  onComplete?(id: string): void;
  /** Language of the read-aloud voice: 'vi' or 'en'. */
  lang?: string;
  /** Shown on the finished screen, e.g. a link to the next lesson. */
  footer?: ReactNode;
  /** Pause before the next question after a right answer, in ms. */
  advanceDelay?: number;
};

/** Reading square names: rows are numbers, columns are letters, a square is where they cross ("ghế rạp chiếu phim"). */
export function CoordinatesLesson({
  t,
  animate,
  onComplete,
  lang = 'vi',
  footer,
  advanceDelay = 1200,
}: Props) {
  const [stage, setStage] = useState<Stage>('meet');
  const voice = useVoice(lang);
  const c = (key: string, values?: Record<string, string | number>) =>
    t(`games.chess.learn.coordinates.${key}`, values);
  const common = (key: string) => t(`games.chess.learn.${key}`);
  const start = useMemo(() => fromFen(START_FEN), []);
  const next = () => {
    const to = STAGES[STAGES.indexOf(stage) + 1]!;
    setStage(to);
    if (to === 'done') onComplete?.(COORDINATES_LESSON_ID);
  };

  return (
    <section className="ch-learn" aria-label={c('name')}>
      <LessonHeader
        title={c('name')}
        stages={STAGES}
        stage={stage}
        label={(s) => c(`stage.${s}`)}
        onStage={(s) => setStage(s as typeof stage)}
        t={t}
      />

      {stage === 'meet' && (
        <LessonLayout
          board={
            <LearnBoard board={start.board} t={t} animate={animate} rankLine={4} fileLine={4} goal={36} />
          }
        >
          <p className="ch-learn-text">{c('meet')}</p>
          <ReadAloud text={c('meet')} voice={voice} t={t} />
          <button type="button" className="btn btn-primary ch-next" onClick={next}>
            {common('next')}
          </button>
        </LessonLayout>
      )}

      {stage !== 'meet' && stage !== 'done' && (
        <Practice
          key={stage}
          kind={stage}
          t={t}
          animate={animate}
          voice={voice}
          advanceDelay={advanceDelay}
          onNext={next}
        />
      )}

      {stage === 'done' && (
        <DoneCard
          t={t}
          voice={voice}
          message={c('done')}
          fun={c('fun')}
          onAgain={() => setStage('meet')}
          footer={footer}
        />
      )}
    </section>
  );
}

type PracticeProps = {
  kind: CoordKind;
  t: Translator;
  animate: boolean;
  voice: VoiceState;
  advanceDelay: number;
  onNext(): void;
};

/** Five questions of one kind. Wrong answers can be retried; a right one moves on by itself. */
function Practice({ kind, t, animate, voice, advanceDelay, onNext }: PracticeProps) {
  const rounds = useMemo<CoordRound[]>(() => coordRounds(kind, ROUNDS), [kind]);
  const [index, setIndex] = useState(0);
  const [solved, setSolved] = useState(false);
  const [wrong, setWrong] = useState(0);
  const [roundWrong, setRoundWrong] = useState(0);
  const [hint, setHint] = useState(false);
  const finished = index >= rounds.length;
  const round = rounds[Math.min(index, rounds.length - 1)]!;
  const target = round.square;

  const c = (key: string, values?: Record<string, string | number>) =>
    t(`games.chess.learn.coordinates.${key}`, values);
  const values = { square: squareName(target), rank: rankOf(target), file: fileOf(target) };
  const intro = c(`intro.${kind}`);
  const prompt = c(`prompt.${kind}`, values);

  useEffect(() => {
    if (!solved) return;
    // After the pause, wait until the spoken result has been heard: a child cannot read it instead.
    let cancelled = false;
    const id = setTimeout(() => {
      void waitUntilSilent().then(() => {
        if (cancelled) return;
        setIndex((i) => i + 1);
        setSolved(false);
        setRoundWrong(0);
        setHint(false);
      });
    }, advanceDelay);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [solved, advanceDelay]);

  const answer = (ok: boolean) => {
    if (solved || finished) return;
    if (ok) {
      setSolved(true);
    } else {
      setWrong((w) => w + 1);
      setRoundWrong((w) => w + 1);
    }
  };
  const clickSquare = (s: number) => {
    if (kind === 'treasure') return;
    answer(
      kind === 'rank'
        ? rankOf(s) === rankOf(target)
        : kind === 'file'
          ? fileOf(s) === fileOf(target)
          : s === target,
    );
  };

  // Two lines cross on the answer: always for "cross", on request (or after three misses) for "find",
  // and for every kind once the answer is right.
  const showLines = solved || kind === 'cross' || (kind === 'find' && (hint || roundWrong >= 3));
  const both = kind !== 'rank' && kind !== 'file' && showLines;
  const rankLine = kind === 'rank' ? (solved ? rankOf(target) : null) : both ? rankOf(target) : null;
  const fileLine = kind === 'file' ? (solved ? target & 7 : null) : both ? target & 7 : null;

  const message = finished
    ? c('allDone')
    : solved
      ? c('right')
      : roundWrong > 0
        ? c(`wrong.${kind}`, values)
        : '';

  return (
    <LessonLayout
      board={
        <LearnBoard
          board={EMPTY_BOARD}
          t={t}
          animate={animate}
          rankLine={rankLine}
          fileLine={fileLine}
          goal={kind === 'treasure' && !finished ? target : null}
          marks={new Set(solved && (kind === 'cross' || kind === 'find') ? [target] : [])}
          shake={wrong}
          onSquare={clickSquare}
        />
      }
    >
      <p className="ch-learn-text">{intro}</p>
      {!finished && (
        <>
          <p className="ch-learn-idea" data-testid="coord-prompt">
            <strong>
              {index + 1}/{rounds.length}
            </strong>{' '}
            {prompt}
          </p>
          <ReadAloud text={prompt} voice={voice} t={t} />
        </>
      )}
      {kind === 'treasure' && !finished && (
        <div className="ch-learn-actions" role="group" aria-label={c('options')}>
          {round.options!.map((option) => (
            <button
              key={option}
              type="button"
              className="btn btn-lg"
              disabled={solved}
              onClick={() => answer(option === target)}
            >
              {squareName(option)}
            </button>
          ))}
        </div>
      )}
      {kind === 'find' && !finished && !solved && !hint && (
        <div className="ch-learn-actions">
          <button type="button" className="btn" onClick={() => setHint(true)}>
            {t('games.chess.learn.hint')}
          </button>
        </div>
      )}
      <Status voice={voice} text={message} nonce={wrong} />
      {finished && (
        <button type="button" className="btn btn-primary ch-next" onClick={onNext}>
          {t('games.chess.learn.next')}
        </button>
      )}
    </LessonLayout>
  );
}
