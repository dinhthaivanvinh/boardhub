'use client';

import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Translator } from '@bg/ui';
import { fromFen, inCheck, kingSquare, makeMove, squareName, squareOf } from '../rules/board';
import type { ChessMove, Piece, Position } from '../rules/types';
import {
  CHECK_ROUNDS,
  CHECKMATE_LESSON_ID,
  type CheckRound,
  ESCAPE_ROUNDS,
  type EscapeRound,
  escapeReply,
  isCheckmate,
  isStalemate,
  JUDGE_ROUNDS,
  type JudgeRound,
  MATE_ROUNDS,
  type MateRound,
  matingMoves,
  rescueKind,
} from './checkmate';
import { LearnBoard, LessonLayout } from './LearnBoard';
import { movesFrom, targetsFrom } from './logic';
import { ReadAloud, type VoiceState } from './ReadAloud';

type Stage = 'meet' | 'check' | 'escape' | 'judge' | 'mate' | 'done';
const STAGES: Stage[] = ['meet', 'check', 'escape', 'judge', 'mate', 'done'];

type Props = {
  t: Translator;
  animate: boolean;
  onComplete?(id: string): void;
  /** Language of the read-aloud voice: 'vi' or 'en'. */
  lang?: string;
  /** Pause before the next question after a right answer, and before a wrong try is shown undone, in ms. */
  advanceDelay?: number;
};

type Tx = (key: string, values?: Record<string, string | number>) => string;
type RoundProps<R> = {
  round: R;
  progress: string;
  t: Translator;
  c: Tx;
  animate: boolean;
  voice: VoiceState;
  delay: number;
  onSolved(): void;
};

/** Check, how to save the king, mate or not, and finding mate in one: "Bắt vua". */
export function CheckmateLesson({ t, animate, onComplete, lang = 'vi', advanceDelay = 1400 }: Props) {
  const [stage, setStage] = useState<Stage>('meet');
  const [auto, setAuto] = useState(false);
  const voice: VoiceState = { lang, auto, onAuto: setAuto };
  const c: Tx = (key, values) => t(`games.chess.learn.checkmate.${key}`, values);
  const common = (key: string) => t(`games.chess.learn.${key}`);
  const start = useMemo(() => fromFen(CHECK_ROUNDS[0]!.fen), []);
  const next = () => {
    const to = STAGES[STAGES.indexOf(stage) + 1]!;
    setStage(to);
    if (to === 'done') onComplete?.(CHECKMATE_LESSON_ID);
  };
  const shared = { t, c, animate, voice, delay: advanceDelay };

  return (
    <section className="ch-learn" aria-label={c('name')}>
      <header className="ch-learn-header">
        <h2 className="ch-learn-title">{c('name')}</h2>
        <ol className="ch-learn-steps" aria-label={common('steps')}>
          {STAGES.map((s) => (
            <li
              key={s}
              aria-current={s === stage ? 'step' : undefined}
              data-done={STAGES.indexOf(s) < STAGES.indexOf(stage)}
            >
              {c(`stage.${s}`)}
            </li>
          ))}
        </ol>
      </header>

      {stage === 'meet' && (
        <LessonLayout
          board={
            <LearnBoard board={start.board} t={t} animate={animate} danger={kingSquare(start.board, 'w')} />
          }
        >
          <p className="ch-learn-text">{c('meet')}</p>
          <ReadAloud text={c('meet')} voice={voice} t={t} />
          <button type="button" className="btn" onClick={next}>
            {common('next')}
          </button>
        </LessonLayout>
      )}
      {stage === 'check' && (
        <Stage
          kind="check"
          rounds={CHECK_ROUNDS}
          render={(props) => <CheckRoundView {...props} />}
          {...shared}
          onNext={next}
        />
      )}
      {stage === 'escape' && (
        <Stage
          kind="escape"
          rounds={ESCAPE_ROUNDS}
          render={(props) => <EscapeRoundView {...props} />}
          {...shared}
          onNext={next}
        />
      )}
      {stage === 'judge' && (
        <Stage
          kind="judge"
          rounds={JUDGE_ROUNDS}
          render={(props) => <JudgeRoundView {...props} />}
          {...shared}
          onNext={next}
        />
      )}
      {stage === 'mate' && (
        <Stage
          kind="mate"
          rounds={MATE_ROUNDS}
          render={(props) => <MateRoundView {...props} />}
          {...shared}
          onNext={next}
        />
      )}
      {stage === 'done' && (
        <LessonLayout board={<LearnBoard board={start.board} t={t} animate={animate} />}>
          <p className="ch-learn-text" role="status">
            {c('done')}
          </p>
          <p className="ch-learn-text">{c('fun')}</p>
          <ReadAloud text={c('fun')} voice={voice} t={t} />
          <button type="button" className="btn" onClick={() => setStage('meet')}>
            {common('again')}
          </button>
        </LessonLayout>
      )}
    </section>
  );
}

/** Runs the rounds of one stage in order: a right answer moves on by itself, the last one shows Continue. */
function Stage<R>({
  kind,
  rounds,
  render,
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
    const id = setTimeout(() => {
      setIndex((i) => i + 1);
      setSolved(false);
    }, delay);
    return () => clearTimeout(id);
  }, [solved, delay]);

  if (finished) {
    const board = fromFen(CHECK_ROUNDS[0]!.fen).board;
    return (
      <LessonLayout board={<LearnBoard board={board} t={t} animate={animate} />}>
        <p className="ch-learn-text">{c(`intro.${kind}`)}</p>
        <p className="ch-learn-status" role="status" aria-live="polite">
          {c('allDone')}
        </p>
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
function Panel({
  kind,
  prompt,
  progress,
  message,
  extra,
  props,
}: {
  kind: string;
  prompt: string;
  progress: string;
  message: string;
  extra?: ReactNode;
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
      <p className="ch-learn-status" role="status" aria-live="polite">
        {message}
      </p>
    </>
  );
}

/** Tap the piece that attacks the king. */
function CheckRoundView(props: RoundProps<CheckRound>) {
  const { round, progress, t, c, animate, onSolved } = props;
  const pos = useMemo(() => fromFen(round.fen), [round]);
  const attacker = squareOf(round.attacker);
  const [solved, setSolved] = useState(false);
  const [wrong, setWrong] = useState(0);

  const click = (s: number) => {
    if (solved) return;
    if (s === attacker) {
      setSolved(true);
      onSolved();
    } else {
      setWrong((w) => w + 1);
    }
  };
  return (
    <LessonLayout
      board={
        <LearnBoard
          board={pos.board}
          t={t}
          animate={animate}
          danger={kingSquare(pos.board, 'w')}
          marks={new Set(solved ? [attacker] : [])}
          shake={wrong}
          onSquare={click}
        />
      }
    >
      <Panel
        kind="check"
        prompt={c('prompt.check')}
        progress={progress}
        message={solved ? c('right') : wrong > 0 ? c('wrong.check') : ''}
        props={props}
      />
    </LessonLayout>
  );
}

type Slide = { id: number; from: number; to: number; piece: Piece };

/** Select a piece and a square with the legal moves of a position, and show the result with a slide. */
function useMoveBoard(start: Position) {
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

/** Save the king in the way the question asks: run, block or capture. */
function EscapeRoundView(props: RoundProps<EscapeRound>) {
  const { round, progress, t, c, animate, onSolved } = props;
  const start = useMemo(() => fromFen(round.fen), [round]);
  const b = useMoveBoard(start);
  const [solved, setSolved] = useState(false);
  const [wrong, setWrong] = useState(0);
  const [message, setMessage] = useState('');

  const click = (s: number) => {
    if (solved) return;
    const p = b.pos.board[s];
    if (p && p[0] === 'w') {
      b.setSelected(s);
      setMessage('');
      return;
    }
    if (b.selected === null) return;
    const move = movesFrom(b.pos, b.selected).find((m) => m.to === s);
    if (!move) {
      setWrong((w) => w + 1);
      setMessage(c('escape.illegal'));
      return;
    }
    const did = rescueKind(b.pos, move);
    if (did !== round.kind) {
      setWrong((w) => w + 1);
      setMessage(c('escape.other', { did: c(`kind.${did}`), asked: c(`kind.${round.kind}`) }));
      return;
    }
    b.play(makeMove(b.pos, move), move);
    setSolved(true);
    setMessage(c('right'));
    onSolved();
  };

  const reach = b.selected === null ? [] : targetsFrom(b.pos, b.selected);
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
          danger={solved ? null : kingSquare(b.pos.board, 'w')}
          shake={wrong}
          slide={b.slide}
          onSquare={click}
        />
      }
    >
      <Panel
        kind="escape"
        prompt={c(`prompt.escape.${round.kind}`)}
        progress={progress}
        message={message}
        props={props}
      />
    </LessonLayout>
  );
}

/** Can the king still be saved? */
function JudgeRoundView(props: RoundProps<JudgeRound>) {
  const { round, progress, t, c, animate, onSolved } = props;
  const pos = useMemo(() => fromFen(round.fen), [round]);
  const [solved, setSolved] = useState(false);
  const [wrong, setWrong] = useState(0);

  const answer = (saysMate: boolean) => {
    if (solved) return;
    if (saysMate === round.mate) {
      setSolved(true);
      onSolved();
    } else {
      setWrong((w) => w + 1);
    }
  };
  return (
    <LessonLayout
      board={
        <LearnBoard
          board={pos.board}
          t={t}
          animate={animate}
          danger={kingSquare(pos.board, 'w')}
          shake={wrong}
        />
      }
    >
      <Panel
        kind="judge"
        prompt={c('prompt.judge')}
        progress={progress}
        message={
          solved ? c(round.mate ? 'judge.rightMate' : 'judge.rightSave') : wrong > 0 ? c('judge.wrong') : ''
        }
        extra={
          <div className="ch-learn-actions" role="group" aria-label={c('prompt.judge')}>
            <button type="button" className="btn btn-lg" disabled={solved} onClick={() => answer(false)}>
              {c('judge.save')}
            </button>
            <button type="button" className="btn btn-lg" disabled={solved} onClick={() => answer(true)}>
              {c('judge.mate')}
            </button>
          </div>
        }
        props={props}
      />
    </LessonLayout>
  );
}

/** Find the move that gives checkmate. A move that does not is played out, so the child sees the king escape. */
function MateRoundView(props: RoundProps<MateRound>) {
  const { round, progress, t, c, animate, delay, onSolved } = props;
  const start = useMemo(() => fromFen(round.fen), [round]);
  const mates = useMemo(() => matingMoves(start), [start]);
  const b = useMoveBoard(start);
  const timers = useTimers();
  useEffect(() => () => timers.current.forEach(clearTimeout), [timers]);
  const [solved, setSolved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(0);
  const [hint, setHint] = useState(0);
  const [message, setMessage] = useState('');

  const click = (s: number) => {
    if (solved || busy) return;
    const p = b.pos.board[s];
    if (p && p[0] === 'w') {
      b.setSelected(s);
      setMessage('');
      return;
    }
    if (b.selected === null) return;
    const move = movesFrom(b.pos, b.selected).find((m) => m.to === s);
    if (!move) {
      setWrong((w) => w + 1);
      setMessage(c('mate.illegal'));
      return;
    }
    const next = makeMove(b.pos, move);
    b.play(next, move);
    if (isCheckmate(next)) {
      setSolved(true);
      setMessage(c('mate.right'));
      onSolved();
      return;
    }
    // Not mate: the defender answers, then the position is put back for another try.
    setBusy(true);
    setWrong((w) => w + 1);
    const reply = escapeReply(next);
    setMessage(
      isStalemate(next) || !reply
        ? c('mate.stalemate')
        : !inCheck(next.board, 'b')
          ? c('mate.noCheck')
          : next.board[reply.from]?.[1] === 'K'
            ? c('mate.escaped')
            : c('mate.defended'),
    );
    const first = setTimeout(() => {
      if (reply) b.play(makeMove(next, reply), reply);
    }, delay / 2);
    const second = setTimeout(() => {
      b.reset();
      setBusy(false);
    }, delay * 2);
    timers.current = [first, second];
  };

  const reach = b.selected === null ? [] : targetsFrom(b.pos, b.selected);
  const hinted = new Set<number>();
  const target = mates[0];
  if (!solved && !busy && target && hint >= 1) hinted.add(target.from);
  if (!solved && !busy && target && hint >= 2) hinted.add(target.to);
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
          marks={hinted}
          danger={solved || busy ? kingSquare(b.pos.board, 'b') : null}
          shake={wrong}
          slide={b.slide}
          onSquare={click}
        />
      }
    >
      <Panel
        kind="mate"
        prompt={c('prompt.mate')}
        progress={progress}
        message={message || (hint >= 1 && target ? hintText(c, hint, target) : '')}
        extra={
          !solved && (
            <div className="ch-learn-actions">
              <button
                type="button"
                className="btn"
                disabled={busy || hint >= 2}
                onClick={() => setHint((h) => h + 1)}
              >
                {t('games.chess.learn.hint')}
              </button>
            </div>
          )
        }
        props={props}
      />
    </LessonLayout>
  );
}

const hintText = (c: Tx, level: number, move: ChessMove) =>
  level === 1
    ? c('mate.hint1', { from: squareName(move.from) })
    : c('mate.hint2', { from: squareName(move.from), to: squareName(move.to) });

/** Timers kept in a ref so they are cleared when the round goes away. */
function useTimers() {
  const [ref] = useState(() => ({ current: [] as ReturnType<typeof setTimeout>[] }));
  return ref;
}
