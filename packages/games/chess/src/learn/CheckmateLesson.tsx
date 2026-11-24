'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Translator } from '@bg/ui';
import { fromFen, inCheck, kingSquare, makeMove, squareName, squareOf } from '../rules/board';
import type { ChessMove } from '../rules/types';
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
import { DoneCard, LessonHeader } from './LessonChrome';
import { ReadAloud } from './ReadAloud';
import { useVoice } from './voice';
import { Panel, type RoundProps, Stage, type Tx, useMoveBoard, useTimers } from './rounds';

type Stage = 'meet' | 'check' | 'escape' | 'judge' | 'mate' | 'done';
const STAGES: Stage[] = ['meet', 'check', 'escape', 'judge', 'mate', 'done'];

type Props = {
  t: Translator;
  animate: boolean;
  onComplete?(id: string): void;
  /** Language of the read-aloud voice: 'vi' or 'en'. */
  lang?: string;
  /** Shown on the finished screen, e.g. a link to the next lesson. */
  footer?: ReactNode;
  /** Pause before the next question after a right answer, and before a wrong try is shown undone, in ms. */
  advanceDelay?: number;
};

/** Check, how to save the king, mate or not, and finding mate in one: "Bắt vua". */
export function CheckmateLesson({ t, animate, onComplete, lang = 'vi', footer, advanceDelay = 1400 }: Props) {
  const [stage, setStage] = useState<Stage>('meet');
  const voice = useVoice(lang);
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
            <LearnBoard board={start.board} t={t} animate={animate} danger={kingSquare(start.board, 'w')} />
          }
        >
          <p className="ch-learn-text">{c('meet')}</p>
          <ReadAloud text={c('meet')} voice={voice} t={t} />
          <button type="button" className="btn btn-primary ch-next" onClick={next}>
            {common('next')}
          </button>
        </LessonLayout>
      )}
      {stage === 'check' && (
        <Stage
          finishedBoard={start.board}
          kind="check"
          rounds={CHECK_ROUNDS}
          render={(props) => <CheckRoundView {...props} />}
          {...shared}
          onNext={next}
        />
      )}
      {stage === 'escape' && (
        <Stage
          finishedBoard={start.board}
          kind="escape"
          rounds={ESCAPE_ROUNDS}
          render={(props) => <EscapeRoundView {...props} />}
          {...shared}
          onNext={next}
        />
      )}
      {stage === 'judge' && (
        <Stage
          finishedBoard={start.board}
          kind="judge"
          rounds={JUDGE_ROUNDS}
          render={(props) => <JudgeRoundView {...props} />}
          {...shared}
          onNext={next}
        />
      )}
      {stage === 'mate' && (
        <Stage
          finishedBoard={start.board}
          kind="mate"
          rounds={MATE_ROUNDS}
          render={(props) => <MateRoundView {...props} />}
          {...shared}
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
        nonce={wrong}
        kind="check"
        prompt={c('prompt.check')}
        progress={progress}
        message={solved ? c('right') : wrong > 0 ? c('wrong.check') : ''}
        props={props}
      />
    </LessonLayout>
  );
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
        nonce={wrong}
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
        nonce={wrong}
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
/** `after` is shown in place of the hint button once the round is solved (e.g. a button to the next puzzle). */
export function MateRoundView(props: RoundProps<MateRound> & { after?: ReactNode }) {
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
        nonce={wrong}
        kind="mate"
        prompt={c('prompt.mate')}
        progress={progress}
        message={message || (hint >= 1 && target ? hintText(c, hint, target) : '')}
        extra={
          solved ? (
            props.after
          ) : (
            <div className="ch-learn-actions">
              <button
                type="button"
                className="btn"
                disabled={busy || hint >= 2}
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

const hintText = (c: Tx, level: number, move: ChessMove) =>
  level === 1
    ? c('mate.hint1', { from: squareName(move.from) })
    : c('mate.hint2', { from: squareName(move.from), to: squareName(move.to) });
