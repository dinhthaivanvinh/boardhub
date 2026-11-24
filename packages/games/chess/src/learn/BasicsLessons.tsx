'use client';

import { useMemo, useState, type ReactNode } from 'react';
import type { Translator } from '@bg/ui';
import { fromFen, squareOf, START_FEN } from '../rules/board';
import type { Piece, PieceType } from '../rules/types';
import { PieceGlyph } from '../ui/PieceGlyph';
import {
  DRAW_QUIZ,
  DRAWS_LESSON_ID,
  JUDGE_ROUNDS,
  type JudgeRound,
  OUTCOMES,
  PLACE_OPTIONS,
  PLACE_ROUNDS,
  type PlaceRound,
  type QuizRound,
  SETUP_LESSON_ID,
  SETUP_QUIZ,
} from './basics';
import { LearnBoard, LessonLayout } from './LearnBoard';
import { DoneCard, LessonHeader } from './LessonChrome';
import { ReadAloud } from './ReadAloud';
import { Panel, type RoundProps, Stage, type Tx } from './rounds';
import { useVoice } from './voice';

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

type StageName = 'meet' | 'place' | 'ask' | 'judge' | 'facts' | 'done';

/** The shape both lessons share: read the idea, answer some questions, finish. */
function useLessonFlow(stages: StageName[], id: string, onComplete?: (id: string) => void) {
  const [stage, setStage] = useState<StageName>('meet');
  const next = () => {
    const to = stages[stages.indexOf(stage) + 1]!;
    setStage(to);
    if (to === 'done') onComplete?.(id);
  };
  return { stage, setStage, next };
}

const startBoard = () => fromFen(START_FEN).board;

// ---------------------------------------------------------------------------------------------------------
// "Xếp quân và đi trước"

const SETUP_STAGES: StageName[] = ['meet', 'place', 'ask', 'done'];

/** How a game begins: where the pieces stand, who moves first, how a turn passes, and what the game is for. */
export function SetupLesson({ t, animate, onComplete, lang = 'vi', footer, advanceDelay = 1400 }: Props) {
  const { stage, setStage, next } = useLessonFlow(SETUP_STAGES, SETUP_LESSON_ID, onComplete);
  const voice = useVoice(lang);
  const c: Tx = (key, values) => t(`games.chess.learn.setup.${key}`, values);
  const board = useMemo(startBoard, []);
  const shared = { t, c, animate, voice, delay: advanceDelay, finishedBoard: board, onNext: next };

  return (
    <section className="ch-learn" aria-label={c('name')}>
      <LessonHeader
        title={c('name')}
        stages={SETUP_STAGES}
        stage={stage}
        label={(s) => c(`stage.${s}`)}
        onStage={(s) => setStage(s as StageName)}
        t={t}
      />
      {stage === 'meet' && (
        <LessonLayout board={<LearnBoard board={board} t={t} animate={animate} />}>
          <p className="ch-learn-text">{c('meet')}</p>
          <ReadAloud text={c('meet')} voice={voice} t={t} />
          <button type="button" className="btn btn-primary ch-next" onClick={next}>
            {t('games.chess.learn.next')}
          </button>
        </LessonLayout>
      )}
      {stage === 'place' && (
        <Stage kind="place" rounds={PLACE_ROUNDS} render={(p) => <PlaceRoundView {...p} />} {...shared} />
      )}
      {stage === 'ask' && (
        <Stage
          kind="ask"
          rounds={SETUP_QUIZ}
          render={(p) => <QuizRoundView {...p} kind="ask" board={board} />}
          {...shared}
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

/** One piece is missing from the start position: which piece stands there? */
function PlaceRoundView(props: RoundProps<PlaceRound>) {
  const { round, progress, t, c, animate, onSolved } = props;
  const target = squareOf(round.square);
  const [solved, setSolved] = useState(false);
  const [wrong, setWrong] = useState(0);
  const board = useMemo(
    () => startBoard().map((p, i) => (i === target && !solved ? null : p)),
    [target, solved],
  );
  const name = (type: PieceType) => t(`games.chess.pieceNames.${type}`);

  const answer = (type: PieceType) => {
    if (solved) return;
    if (type === round.piece) {
      setSolved(true);
      onSolved();
    } else {
      setWrong((w) => w + 1);
    }
  };
  const prompt = c('prompt.place', { square: round.square });
  return (
    <LessonLayout
      board={
        <LearnBoard
          board={board}
          t={t}
          animate={animate}
          goal={solved ? null : target}
          marks={new Set(solved ? [target] : [])}
          shake={wrong}
        />
      }
    >
      <Panel
        nonce={wrong}
        kind="place"
        prompt={prompt}
        progress={progress}
        message={
          solved
            ? c('place.right', {
                square: round.square,
                piece: name(round.piece).toLowerCase(),
                color: c(`color.${round.color}`),
              })
            : wrong > 0
              ? c('place.wrong')
              : ''
        }
        extra={
          <div className="ch-learn-actions" role="group" aria-label={prompt}>
            {PLACE_OPTIONS.map((type) => (
              <button
                key={type}
                type="button"
                className="btn btn-lg ch-value-btn"
                aria-label={name(type)}
                disabled={solved}
                onClick={() => answer(type)}
              >
                <PieceGlyph piece={`${round.color}${type}` as Piece} size={48} />
                <span>{name(type)}</span>
              </button>
            ))}
          </div>
        }
        props={props}
      />
    </LessonLayout>
  );
}

/** A question in words with two or three answers to choose from. */
function QuizRoundView(props: RoundProps<QuizRound> & { kind: string; board: readonly (Piece | null)[] }) {
  const { round, progress, t, c, animate, onSolved, kind, board } = props;
  const [solved, setSolved] = useState(false);
  const [wrong, setWrong] = useState(0);
  const prompt = c(`quiz.${round.id}.q`);
  const marks = new Set((round.marks ?? []).map(squareOf));

  const answer = (index: number) => {
    if (solved) return;
    if (index === round.answer) {
      setSolved(true);
      onSolved();
    } else {
      setWrong((w) => w + 1);
    }
  };
  return (
    <LessonLayout board={<LearnBoard board={board} t={t} animate={animate} marks={marks} shake={wrong} />}>
      <Panel
        nonce={wrong}
        kind={kind}
        prompt={prompt}
        progress={progress}
        message={solved ? c(`quiz.${round.id}.right`) : wrong > 0 ? c(`quiz.${round.id}.wrong`) : ''}
        extra={
          <div className="ch-learn-actions" role="group" aria-label={prompt}>
            {Array.from({ length: round.options }, (_, i) => (
              <button
                key={i}
                type="button"
                className="btn btn-lg"
                disabled={solved}
                onClick={() => answer(i)}
              >
                {c(`quiz.${round.id}.o${i}`)}
              </button>
            ))}
          </div>
        }
        props={props}
      />
    </LessonLayout>
  );
}

// ---------------------------------------------------------------------------------------------------------
// "Khi nào hoà?"

const DRAWS_STAGES: StageName[] = ['meet', 'judge', 'facts', 'done'];

/** The ways a game ends with no winner, and how to tell a draw from a win or a game still going. */
export function DrawsLesson({ t, animate, onComplete, lang = 'vi', footer, advanceDelay = 1400 }: Props) {
  const { stage, setStage, next } = useLessonFlow(DRAWS_STAGES, DRAWS_LESSON_ID, onComplete);
  const voice = useVoice(lang);
  const c: Tx = (key, values) => t(`games.chess.learn.draws.${key}`, values);
  const board = useMemo(() => fromFen(JUDGE_ROUNDS[0]!.fen).board, []);
  const shared = { t, c, animate, voice, delay: advanceDelay, finishedBoard: board, onNext: next };

  return (
    <section className="ch-learn" aria-label={c('name')}>
      <LessonHeader
        title={c('name')}
        stages={DRAWS_STAGES}
        stage={stage}
        label={(s) => c(`stage.${s}`)}
        onStage={(s) => setStage(s as StageName)}
        t={t}
      />
      {stage === 'meet' && (
        <LessonLayout board={<LearnBoard board={board} t={t} animate={animate} />}>
          <p className="ch-learn-text">{c('meet')}</p>
          <ReadAloud text={c('meet')} voice={voice} t={t} />
          <button type="button" className="btn btn-primary ch-next" onClick={next}>
            {t('games.chess.learn.next')}
          </button>
        </LessonLayout>
      )}
      {stage === 'judge' && (
        <Stage kind="judge" rounds={JUDGE_ROUNDS} render={(p) => <JudgeRoundView {...p} />} {...shared} />
      )}
      {stage === 'facts' && (
        <Stage
          kind="facts"
          rounds={DRAW_QUIZ}
          render={(p) => <QuizRoundView {...p} kind="facts" board={board} />}
          {...shared}
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

/** A position: someone has won, the game is drawn, or it goes on? */
function JudgeRoundView(props: RoundProps<JudgeRound>) {
  const { round, progress, t, c, animate, onSolved } = props;
  const pos = useMemo(() => fromFen(round.fen), [round]);
  const [solved, setSolved] = useState(false);
  const [wrong, setWrong] = useState(0);
  // The king of the side to move glows red when it is mated.
  const king = round.outcome === 'win' ? pos.board.indexOf(`${pos.turn}K` as Piece) : null;
  const prompt = c('prompt.judge', { side: c(`side.${pos.turn}`) });

  const answer = (outcome: (typeof OUTCOMES)[number]) => {
    if (solved) return;
    if (outcome === round.outcome) {
      setSolved(true);
      onSolved();
    } else {
      setWrong((w) => w + 1);
    }
  };
  return (
    <LessonLayout
      board={<LearnBoard board={pos.board} t={t} animate={animate} danger={king} shake={wrong} />}
    >
      <Panel
        nonce={wrong}
        kind="judge"
        prompt={prompt}
        progress={progress}
        message={solved ? c(`judge.${round.id}.right`) : wrong > 0 ? c('judge.wrong') : ''}
        extra={
          <div className="ch-learn-actions" role="group" aria-label={prompt}>
            {OUTCOMES.map((outcome) => (
              <button
                key={outcome}
                type="button"
                className="btn btn-lg"
                disabled={solved}
                onClick={() => answer(outcome)}
              >
                {c(`judge.${outcome}`)}
              </button>
            ))}
          </div>
        }
        props={props}
      />
    </LessonLayout>
  );
}
