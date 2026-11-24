'use client';

import { useMemo, useState, type ReactNode } from 'react';
import type { Translator } from '@bg/ui';
import { fromFen, makeMove, squareName, squareOf } from '../rules/board';
import { LearnBoard, LessonLayout } from './LearnBoard';
import { DoneCard, LessonHeader } from './LessonChrome';
import { movesFrom, parseMove, targetsFrom } from './logic';
import {
  type MoveRound,
  practiceId,
  type PracticePrompt,
  practicePosition,
  practiceRounds,
  type PracticeRound,
  STARS_PER_PRACTICE,
  type StarRound,
} from './practice';
import { Panel, type RoundProps, Stage, type Tx, useMoveBoard } from './rounds';
import { openingLesson } from './data';
import { useVoice } from './voice';

type StageName = 'practice' | 'done';
const STAGES: StageName[] = ['practice', 'done'];

type Props = {
  lessonId: string;
  /** The display name of the lesson, for the title. */
  lessonName: string;
  t: Translator;
  animate: boolean;
  /** Called once with the id to remember (`practice-<lesson>`) when all rounds are done. */
  onComplete?(id: string): void;
  lang?: string;
  /** Shown on the finished screen: back to the lesson, on to the next one. */
  footer?: ReactNode;
  /** Pause before the next question after a right answer, in ms. */
  advanceDelay?: number;
};

/** Five short rounds on what a lesson taught: find the piece, make the capture, play the next move of the line. */
export function PracticeLesson({
  lessonId,
  lessonName,
  t,
  animate,
  onComplete,
  lang = 'vi',
  footer,
  advanceDelay = 1400,
}: Props) {
  const [stage, setStage] = useState<StageName>('practice');
  const [attempt, setAttempt] = useState(0);
  const voice = useVoice(lang);
  const rounds = useMemo(() => practiceRounds(lessonId) ?? [], [lessonId]);
  const c: Tx = (key, values) => t(`games.chess.learn.practice.${key}`, values);
  const first = rounds[0];
  const finishedBoard = useMemo(() => (first ? practicePosition(first).board : []), [first]);

  return (
    <section className="ch-learn" aria-label={c('title', { lesson: lessonName })}>
      <LessonHeader
        title={c('title', { lesson: lessonName })}
        stages={STAGES}
        stage={stage}
        label={(s) => c(`stage.${s}`)}
        onStage={(s) => setStage(s as StageName)}
        t={t}
      />
      {stage === 'practice' && (
        <Stage
          key={attempt}
          kind="done"
          rounds={rounds}
          render={(p) =>
            p.round.kind === 'star' ? (
              <StarRoundView {...(p as RoundProps<StarRound>)} />
            ) : (
              <MoveRoundView {...(p as RoundProps<MoveRound>)} />
            )
          }
          finishedBoard={finishedBoard}
          t={t}
          c={c}
          animate={animate}
          voice={voice}
          delay={advanceDelay}
          onNext={() => {
            setStage('done');
            onComplete?.(practiceId(lessonId));
          }}
        />
      )}
      {stage === 'done' && (
        <DoneCard
          t={t}
          voice={voice}
          message={c('done', { stars: STARS_PER_PRACTICE })}
          onAgain={() => {
            setAttempt((a) => a + 1);
            setStage('practice');
          }}
          footer={footer}
        />
      )}
    </section>
  );
}

const promptText = (c: Tx, t: Translator, prompt: PracticePrompt) =>
  prompt.key === 'capture'
    ? c('prompt.capture', { piece: t(`games.chess.pieceNames.${prompt.piece}`) })
    : prompt.key === 'opening'
      ? c('prompt.opening')
      : c(`prompt.${prompt.key}`, { to: prompt.to });

/** Which of the white pieces can go to the star? Tap it. */
function StarRoundView(props: RoundProps<StarRound>) {
  const { round, progress, t, c, animate, onSolved } = props;
  const pos = useMemo(() => fromFen(round.fen), [round]);
  const star = squareOf(round.star);
  const answer = squareOf(round.answer);
  const [solved, setSolved] = useState(false);
  const [wrong, setWrong] = useState(0);
  const [hint, setHint] = useState(false);

  const click = (s: number) => {
    if (solved) return;
    if (s === answer) {
      setSolved(true);
      onSolved();
    } else {
      setWrong((w) => w + 1);
    }
  };
  const reach = solved ? targetsFrom(pos, answer) : [];
  return (
    <LessonLayout
      board={
        <LearnBoard
          board={pos.board}
          t={t}
          animate={animate}
          goal={star}
          goalStar
          selected={solved ? answer : null}
          marks={new Set(solved || hint ? [answer] : [])}
          dots={new Set(reach.filter((s) => s === star))}
          shake={wrong}
          onSquare={click}
        />
      }
    >
      <Panel
        nonce={wrong}
        kind="star"
        prompt={c('prompt.star')}
        progress={progress}
        message={
          solved
            ? c('star.right')
            : wrong > 0
              ? c('star.wrong')
              : hint
                ? c('star.hint', { from: round.answer })
                : ''
        }
        extra={
          !solved &&
          !hint && (
            <div className="ch-learn-actions">
              <button type="button" className="btn" onClick={() => setHint(true)}>
                <span aria-hidden="true">💡</span> {t('games.chess.learn.hint')}
              </button>
            </div>
          )
        }
        props={props}
      />
    </LessonLayout>
  );
}

/** Play one given move: a capture, the next move of an opening, or a special move. */
function MoveRoundView(props: RoundProps<MoveRound>) {
  const { round, progress, t, c, animate, onSolved } = props;
  const start = useMemo(() => practicePosition(round), [round]);
  const b = useMoveBoard(start);
  const side = start.turn;
  const from = squareOf(round.from);
  const to = squareOf(round.to);
  const [solved, setSolved] = useState(false);
  const [wrong, setWrong] = useState(0);
  const [hint, setHint] = useState(0);
  const [message, setMessage] = useState('');

  // In an opening, the opponent's last move is shown, so the child sees what just happened.
  const last = useMemo(() => {
    if (!('opening' in round.source) || round.source.ply === 0) return [];
    const line = openingLesson(round.source.opening)!;
    const m = parseMove(line.moves[round.source.ply - 1]!);
    return [m.from, m.to];
  }, [round]);

  const click = (s: number) => {
    if (solved) return;
    const p = b.pos.board[s];
    if (p && p[0] === side) {
      b.setSelected(s);
      setMessage('');
      return;
    }
    if (b.selected === null) return;
    const options = movesFrom(b.pos, b.selected).filter((m) => m.to === s);
    if (options.length === 0) {
      setWrong((w) => w + 1);
      setMessage(c('move.illegal'));
      return;
    }
    if (b.selected !== from || s !== to) {
      setWrong((w) => w + 1);
      setMessage(c('move.notGoal'));
      return;
    }
    const move = options.find((m) => m.promotion === 'Q') ?? options[0]!;
    b.play(makeMove(b.pos, move), move);
    setSolved(true);
    setMessage(c('move.right'));
    onSolved();
  };

  const reach = b.selected === null ? [] : targetsFrom(b.pos, b.selected);
  const hinted = new Set<number>();
  if (!solved && hint >= 1) hinted.add(from);
  if (!solved && hint >= 2) hinted.add(to);
  const marks = new Set<number>(hinted.size > 0 ? hinted : solved ? [] : last);
  return (
    <LessonLayout
      board={
        <LearnBoard
          board={b.board}
          t={t}
          animate={animate}
          selected={b.selected}
          dots={new Set(reach.filter((s) => !b.pos.board[s]))}
          captures={new Set(reach.filter((s) => b.pos.board[s]))}
          marks={marks}
          shake={wrong}
          slide={b.slide}
          onSquare={click}
        />
      }
    >
      <Panel
        nonce={wrong}
        kind={round.prompt.key}
        prompt={promptText(c, t, round.prompt)}
        progress={progress}
        message={
          message ||
          (hint === 1
            ? c('move.hint1', { from: squareName(from) })
            : hint >= 2
              ? c('move.hint2', { from: squareName(from), to: squareName(to) })
              : '')
        }
        extra={
          !solved && (
            <div className="ch-learn-actions">
              <button
                type="button"
                className="btn"
                disabled={hint >= 2}
                onClick={() => setHint((h) => h + 1)}
              >
                <span aria-hidden="true">💡</span> {t('games.chess.learn.hint')}
              </button>
            </div>
          )
        }
        props={props}
      />
    </LessonLayout>
  );
}

export type { PracticeRound };
