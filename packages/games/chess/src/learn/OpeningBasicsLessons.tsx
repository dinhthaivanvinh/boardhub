'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Translator } from '@bg/ui';
import { fromFen, kingSquare, makeMove, squareName } from '../rules/board';
import type { ChessMove, Piece, Position } from '../rules/types';
import { LearnBoard, LessonLayout } from './LearnBoard';
import { DoneCard, LessonHeader } from './LessonChrome';
import { movesFrom, parseMove, targetsFrom } from './logic';
import {
  CASTLE_ROUNDS,
  type CastleRound,
  CENTER_ROUNDS,
  type CenterRound,
  centerVerdict,
  CHOICE_ROUNDS,
  type ChoiceRound,
  DEFEND_ROUNDS,
  type DefendRound,
  defenceVerdict,
  DEVELOP_ROUNDS,
  type DevelopRound,
  developVerdict,
  EARLY_MATE_LESSON_ID,
  isCastle,
  OPENING_BASICS_LESSON_ID,
  roundPosition,
  sameMove,
  SPOT_ROUNDS,
  type SpotRound,
  TRAP_LINE,
  TRAP_SQUARE,
  trapFrames,
} from './opening-basics';
import { ReadAloud, type VoiceState } from './ReadAloud';
import { Panel, type RoundProps, Stage, type Tx, useMoveBoard, useTimers } from './rounds';
import { Status } from './Status';
import { waitUntilSilent } from './speech';
import { useVoice } from './voice';

type Props = {
  t: Translator;
  animate: boolean;
  onComplete?(id: string): void;
  /** Language of the read-aloud voice: 'vi' or 'en'. */
  lang?: string;
  /** Shown on the finished screen, e.g. a link to the next lesson. */
  footer?: ReactNode;
  /** Pause before the next question after a right answer, and before a wrong try is undone, in ms. */
  advanceDelay?: number;
};

/**
 * What a move is worth in a round: right, or why not (with the answer that shows it, when there is one). A right
 * move with `then` does not end the task: the move stays and `then` is called once the message has been heard.
 */
type Judged = { ok: boolean; text: string; reply?: ChessMove; then?: () => void };

/** The shape both lessons share: the idea, a few stages, then the star. */
function useStages(stages: readonly string[], id: string, onComplete?: (id: string) => void) {
  const [stage, setStage] = useState(stages[0]!);
  const next = () => {
    const to = stages[stages.indexOf(stage) + 1]!;
    setStage(to);
    if (to === stages[stages.length - 1]) onComplete?.(id);
  };
  return { stage, setStage: (to: string) => setStage(to), next };
}

function Frame({
  c,
  t,
  voice,
  stages,
  stage,
  setStage,
  next,
  board,
  flipped,
  footer,
  children,
}: {
  c: Tx;
  t: Translator;
  voice: VoiceState;
  stages: readonly string[];
  stage: string;
  setStage(stage: string): void;
  next(): void;
  board: readonly (Piece | null)[];
  flipped: boolean;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="ch-learn" aria-label={c('name')}>
      <LessonHeader
        title={c('name')}
        stages={stages}
        stage={stage}
        label={(s) => c(`stage.${s}`)}
        onStage={setStage}
        t={t}
      />
      {stage === 'meet' && (
        <LessonLayout board={<LearnBoard board={board} flipped={flipped} t={t} animate={false} />}>
          <p className="ch-learn-text">{c('meet')}</p>
          <ReadAloud text={c('meet')} voice={voice} t={t} />
          <button type="button" className="btn btn-primary ch-next" onClick={next}>
            {t('games.chess.learn.next')}
          </button>
        </LessonLayout>
      )}
      {children}
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

/**
 * One move to find on the board. A legal move that is not the one asked for is shown (with the answer to it, if
 * the judge has one) and then taken back. The hint shows the piece first, then the square.
 */
function MoveTask({
  kind,
  start,
  prompt,
  suggest,
  illegal,
  judge,
  flipped = false,
  props,
}: {
  kind: string;
  start: Position;
  prompt: string;
  suggest: ChessMove;
  illegal: string;
  judge(pos: Position, move: ChessMove): Judged;
  flipped?: boolean;
  props: RoundProps<unknown>;
}) {
  const { t, c, animate, delay, progress, onSolved } = props;
  const b = useMoveBoard(start);
  const timers = useTimers();
  useEffect(() => () => timers.current.forEach(clearTimeout), [timers]);
  const [solved, setSolved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(0);
  const [hint, setHint] = useState(0);
  const [message, setMessage] = useState('');
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const mine = start.turn;

  const click = (s: number) => {
    if (solved || busy) return;
    if (b.pos.board[s]?.[0] === mine) {
      b.setSelected(s);
      setMessage('');
      return;
    }
    if (b.selected === null) return;
    const move = movesFrom(b.pos, b.selected).find((m) => m.to === s);
    if (!move) {
      setWrong((w) => w + 1);
      setMessage(illegal);
      return;
    }
    const verdict = judge(b.pos, move);
    const next = makeMove(b.pos, move);
    b.play(next, move);
    setMessage(verdict.text);
    if (verdict.ok) {
      setSolved(true);
      const { then } = verdict;
      if (!then) {
        onSolved();
        return;
      }
      timers.current = [
        setTimeout(() => {
          void waitUntilSilent().then(() => {
            if (alive.current) then();
          });
        }, delay),
      ];
      return;
    }
    setBusy(true);
    setWrong((w) => w + 1);
    const { reply } = verdict;
    timers.current = [
      setTimeout(() => {
        if (reply) b.play(makeMove(next, reply), reply);
      }, delay / 2),
      setTimeout(() => {
        b.reset();
        setBusy(false);
      }, delay * 2),
    ];
  };

  const reach = b.selected === null ? [] : targetsFrom(b.pos, b.selected);
  const hinted = new Set<number>();
  if (!solved && !busy && hint >= 1) hinted.add(suggest.from);
  if (!solved && !busy && hint >= 2) hinted.add(suggest.to);
  const hintText =
    hint === 1
      ? t('games.chess.learn.hintFrom', { square: squareName(suggest.from) })
      : hint === 2
        ? t('games.chess.learn.hintTo', { from: squareName(suggest.from), square: squareName(suggest.to) })
        : '';

  return (
    <LessonLayout
      board={
        <LearnBoard
          board={b.board}
          flipped={flipped}
          t={t}
          animate={animate}
          selected={b.selected}
          dots={new Set(reach.filter((s) => !b.pos.board[s]))}
          captures={new Set(reach.filter((s) => b.pos.board[s]))}
          marks={hinted}
          shake={wrong}
          slide={b.slide}
          onSquare={click}
        />
      }
    >
      <Panel
        nonce={wrong}
        kind={kind}
        prompt={prompt}
        progress={progress}
        message={message || hintText}
        extra={
          solved ? null : (
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
          )
        }
        props={{ c, t, voice: props.voice }}
      />
    </LessonLayout>
  );
}

// ---------------------------------------------------------------------------------------------------------
// "3 nguyên tắc mở đầu"

const BASICS_STAGES = ['meet', 'center', 'develop', 'safe', 'choose', 'done'] as const;

export function OpeningBasicsLesson({
  t,
  animate,
  onComplete,
  lang = 'vi',
  footer,
  advanceDelay = 1400,
}: Props) {
  const flow = useStages(BASICS_STAGES, OPENING_BASICS_LESSON_ID, onComplete);
  const voice = useVoice(lang);
  const c: Tx = (key, values) => t(`games.chess.learn.${OPENING_BASICS_LESSON_ID}.${key}`, values);
  const board = useMemo(() => roundPosition(CENTER_ROUNDS[0]!).board, []);
  const shared = { t, c, animate, voice, delay: advanceDelay, finishedBoard: board, onNext: flow.next };

  return (
    <Frame
      {...flow}
      c={c}
      t={t}
      voice={voice}
      stages={BASICS_STAGES}
      board={board}
      flipped={false}
      footer={footer}
    >
      {flow.stage === 'center' && (
        <Stage kind="center" rounds={CENTER_ROUNDS} render={(p) => <CenterView {...p} />} {...shared} />
      )}
      {flow.stage === 'develop' && (
        <Stage kind="develop" rounds={DEVELOP_ROUNDS} render={(p) => <DevelopView {...p} />} {...shared} />
      )}
      {flow.stage === 'safe' && (
        <Stage kind="safe" rounds={CASTLE_ROUNDS} render={(p) => <CastleView {...p} />} {...shared} />
      )}
      {flow.stage === 'choose' && (
        <Stage kind="choose" rounds={CHOICE_ROUNDS} render={(p) => <ChoiceView {...p} />} {...shared} />
      )}
    </Frame>
  );
}

function CenterView(props: RoundProps<CenterRound>) {
  const { round, c } = props;
  const start = useMemo(() => roundPosition(round), [round]);
  return (
    <MoveTask
      kind="center"
      start={start}
      prompt={c('prompt.center')}
      suggest={parseMove(round.suggest)}
      illegal={c('illegal')}
      judge={(pos, move) => {
        const verdict = centerVerdict(pos, move);
        return { ok: verdict === 'good', text: c(`center.${verdict}`) };
      }}
      props={props}
    />
  );
}

function DevelopView(props: RoundProps<DevelopRound>) {
  const { round, c } = props;
  const start = useMemo(() => roundPosition(round), [round]);
  return (
    <MoveTask
      kind="develop"
      start={start}
      prompt={c('prompt.develop')}
      suggest={parseMove(round.suggest)}
      illegal={c('illegal')}
      judge={(pos, move) => {
        const verdict = developVerdict(pos, move);
        return { ok: verdict === 'good', text: c(`develop.${verdict}`) };
      }}
      props={props}
    />
  );
}

function CastleView(props: RoundProps<CastleRound>) {
  const { round, c } = props;
  const start = useMemo(() => fromFen(round.fen), [round]);
  return (
    <MoveTask
      kind="safe"
      start={start}
      prompt={c('prompt.safe')}
      suggest={parseMove(round.suggest)}
      illegal={c('illegal')}
      judge={(pos, move) => {
        const ok = isCastle(pos, move);
        return { ok, text: c(ok ? 'safe.good' : 'safe.notCastle') };
      }}
      props={props}
    />
  );
}

/** Three moves in words: tap the one that follows the three ideas. */
function ChoiceView(props: RoundProps<ChoiceRound>) {
  const { round, progress, t, c, animate, onSolved } = props;
  const pos = useMemo(() => roundPosition(round), [round]);
  const [solved, setSolved] = useState<ChessMove | null>(null);
  const [wrong, setWrong] = useState(0);
  const [flaw, setFlaw] = useState('');

  const label = (move: ChessMove) =>
    isCastle(pos, move)
      ? c('choose.castle')
      : c('choose.option', {
          piece: t(`games.chess.pieceNames.${pos.board[move.from]![1]}`),
          square: squareName(move.to),
        });

  return (
    <LessonLayout
      board={
        <LearnBoard
          board={solved ? makeMove(pos, solved).board : pos.board}
          t={t}
          animate={animate}
          marks={new Set(solved ? [solved.from, solved.to] : [])}
          shake={wrong}
        />
      }
    >
      <Panel
        nonce={wrong}
        kind="choose"
        prompt={c('prompt.choose')}
        progress={progress}
        message={solved ? c(`choose.right.${round.id}`) : flaw ? c(`choose.wrong.${flaw}`) : ''}
        extra={
          <div className="ch-learn-actions" role="group" aria-label={c('prompt.choose')}>
            {round.options.map((option) => {
              const move = parseMove(option.move);
              return (
                <button
                  key={option.move}
                  type="button"
                  className="btn btn-lg"
                  data-move={option.move}
                  disabled={solved !== null}
                  onClick={() => {
                    if (option.flaw === null) {
                      setSolved(move);
                      onSolved();
                    } else {
                      setFlaw(option.flaw);
                      setWrong((w) => w + 1);
                    }
                  }}
                >
                  {label(move)}
                </button>
              );
            })}
          </div>
        }
        props={props}
      />
    </LessonLayout>
  );
}

// ---------------------------------------------------------------------------------------------------------
// "Coi chừng chiếu hết nhanh": the child plays Black.

const TRAP_STAGES = ['meet', 'watch', 'spot', 'defend', 'replay', 'done'] as const;

export function EarlyMateLesson({ t, animate, onComplete, lang = 'vi', footer, advanceDelay = 1400 }: Props) {
  const flow = useStages(TRAP_STAGES, EARLY_MATE_LESSON_ID, onComplete);
  const voice = useVoice(lang);
  const c: Tx = (key, values) => t(`games.chess.learn.${EARLY_MATE_LESSON_ID}.${key}`, values);
  const board = useMemo(() => trapFrames()[0]!.board, []);
  const shared = { t, c, animate, voice, delay: advanceDelay, finishedBoard: board, onNext: flow.next };

  return (
    <Frame {...flow} c={c} t={t} voice={voice} stages={TRAP_STAGES} board={board} flipped footer={footer}>
      {flow.stage === 'watch' && <Watch t={t} c={c} animate={animate} voice={voice} onNext={flow.next} />}
      {flow.stage === 'spot' && (
        <Stage kind="spot" rounds={SPOT_ROUNDS} render={(p) => <SpotView {...p} />} {...shared} />
      )}
      {flow.stage === 'defend' && (
        <Stage kind="defend" rounds={DEFEND_ROUNDS} render={(p) => <DefendView {...p} />} {...shared} />
      )}
      {flow.stage === 'replay' && (
        <Stage kind="replay" rounds={[null]} render={(p) => <Replay {...p} />} {...shared} />
      )}
    </Frame>
  );
}

/** The four-move mate, one move per tap. */
function Watch({
  t,
  c,
  animate,
  voice,
  onNext,
}: {
  t: Translator;
  c: Tx;
  animate: boolean;
  voice: VoiceState;
  onNext(): void;
}) {
  const frames = useMemo(trapFrames, []);
  const [ply, setPly] = useState(0);
  const pos = frames[ply]!;
  const last = ply > 0 ? parseMove(TRAP_LINE[ply - 1]!) : null;
  const ended = ply === TRAP_LINE.length;
  return (
    <LessonLayout
      board={
        <LearnBoard
          board={pos.board}
          flipped
          t={t}
          animate={animate}
          marks={new Set(last ? [last.from, last.to] : [])}
          danger={ended ? kingSquare(pos.board, 'b') : null}
        />
      }
    >
      <p className="ch-learn-text">{c('intro.watch')}</p>
      <Status voice={voice} text={ply > 0 ? c(`watch.s${ply - 1}`) : ''} />
      {ended ? (
        <button type="button" className="btn btn-primary ch-next" onClick={onNext}>
          {t('games.chess.learn.next')}
        </button>
      ) : (
        <button type="button" className="btn btn-primary ch-next" onClick={() => setPly((p) => p + 1)}>
          {c('watch.next')}
        </button>
      )}
    </LessonLayout>
  );
}

/** Tap the weak square. After two wrong tries it lights up. */
function SpotView(props: RoundProps<SpotRound>) {
  const { round, progress, t, c, animate, onSolved } = props;
  const pos = useMemo(() => roundPosition(round), [round]);
  const [solved, setSolved] = useState(false);
  const [wrong, setWrong] = useState(0);
  return (
    <LessonLayout
      board={
        <LearnBoard
          board={pos.board}
          flipped
          t={t}
          animate={animate}
          marks={new Set(solved || wrong >= 2 ? [TRAP_SQUARE] : [])}
          shake={wrong}
          onSquare={(s) => {
            if (solved) return;
            if (s === TRAP_SQUARE) {
              setSolved(true);
              onSolved();
            } else {
              setWrong((w) => w + 1);
            }
          }}
        />
      }
    >
      <Panel
        nonce={wrong}
        kind="spot"
        prompt={c('prompt.spot')}
        progress={progress}
        message={solved ? c('spot.right') : wrong > 0 ? c('spot.wrong') : ''}
        props={props}
      />
    </LessonLayout>
  );
}

const judgeDefence =
  (c: Tx, rightText: string) =>
  (pos: Position, move: ChessMove): Judged => {
    const verdict = defenceVerdict(pos, move);
    return verdict.kind === 'good'
      ? { ok: true, text: rightText }
      : { ok: false, text: c(`defend.${verdict.kind}`), reply: verdict.reply };
  };

function DefendView(props: RoundProps<DefendRound>) {
  const { round, c } = props;
  const start = useMemo(() => roundPosition(round), [round]);
  return (
    <MoveTask
      kind="defend"
      start={start}
      flipped
      prompt={c(`prompt.defend.${round.id}`)}
      suggest={parseMove(round.suggest)}
      illegal={c('illegal')}
      judge={judgeDefence(c, c('defend.good'))}
      props={props}
    />
  );
}

type ReplayStep = {
  /** White's moves that lead here, from the start. */
  line: string[];
  prompt: 'pawn' | 'knight' | 'defend';
  suggest: string;
};

const [FIRST_ATTACK, , SECOND_ATTACK] = DEFEND_ROUNDS;

/** The child's moves of the whole game: two named ones, then stopping the attack (twice after ...g6). */
export const REPLAY_STEPS: ReplayStep[] = [
  { line: TRAP_LINE.slice(0, 1), prompt: 'pawn', suggest: 'e7e5' },
  { line: TRAP_LINE.slice(0, 3), prompt: 'knight', suggest: 'b8c6' },
  { line: FIRST_ATTACK!.line, prompt: 'defend', suggest: FIRST_ATTACK!.suggest },
  { line: SECOND_ATTACK!.line, prompt: 'defend', suggest: SECOND_ATTACK!.suggest },
];

/** Only ...g6 lets the queen come back for a second try. */
const queenComesBack = (step: number, move: ChessMove) => step === 2 && sameMove(move, parseMove('g7g6'));

/** One task after another through the whole game; White's moves are already on the board of each. */
function Replay(props: RoundProps<null>) {
  const { c } = props;
  const [step, setStep] = useState(0);
  const current = REPLAY_STEPS[step]!;
  const start = useMemo(() => roundPosition(current), [current]);
  const goOn: Judged = { ok: true, text: c('replay.goOn'), then: () => setStep(step + 1) };

  const judge = (pos: Position, move: ChessMove): Judged => {
    if (current.prompt !== 'defend') {
      return sameMove(move, parseMove(current.suggest)) ? goOn : { ok: false, text: c('replay.notThat') };
    }
    const verdict = judgeDefence(c, c('replay.right'))(pos, move);
    return verdict.ok && queenComesBack(step, move) ? goOn : verdict;
  };

  return (
    <MoveTask
      key={step}
      kind="replay"
      start={start}
      flipped
      prompt={c(`prompt.replay.${current.prompt}`)}
      suggest={parseMove(current.suggest)}
      illegal={c('illegal')}
      judge={judge}
      props={props}
    />
  );
}
