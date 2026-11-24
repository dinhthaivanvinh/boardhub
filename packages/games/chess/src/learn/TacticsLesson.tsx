'use client';

import { useMemo, useState } from 'react';
import type { Translator } from '@bg/ui';
import { fromFen, kingSquare, makeMove, squareOf } from '../rules/board';
import { MateRoundView } from './CheckmateLesson';
import { LearnBoard, LessonLayout } from './LearnBoard';
import { movesFrom, targetsFrom } from './logic';
import { ReadAloud } from './ReadAloud';
import { Panel, type RoundProps, Stage, type Tx, useMoveBoard } from './rounds';
import { Status } from './Status';
import {
  DRAW_ROUNDS,
  type DrawKind,
  type DrawRound,
  drawKind,
  FORK_ROUNDS,
  forkMoves,
  type ForkRound,
  forkTargets,
  LADDER_ROUNDS,
  PIN_ROUNDS,
  pinnedSquares,
  type PinRound,
  pinners,
  TACTICS_LESSON_ID,
} from './tactics';
import { useVoice } from './voice';

type StageName = 'meet' | 'fork' | 'pin' | 'mate' | 'draw' | 'done';
const STAGES: StageName[] = ['meet', 'fork', 'pin', 'mate', 'draw', 'done'];

type Props = {
  t: Translator;
  animate: boolean;
  onComplete?(id: string): void;
  /** Language of the read-aloud voice: 'vi' or 'en'. */
  lang?: string;
  /** Pause before the next question after a right answer, in ms. */
  advanceDelay?: number;
};

/** Little tricks and endgames: forks, pins, mating with two rooks, and telling a draw from a win. */
export function TacticsLesson({ t, animate, onComplete, lang = 'vi', advanceDelay = 1400 }: Props) {
  const [stage, setStage] = useState<StageName>('meet');
  const voice = useVoice(lang);
  const c: Tx = (key, values) => t(`games.chess.learn.tactics.${key}`, values);
  const common = (key: string) => t(`games.chess.learn.${key}`);
  const start = useMemo(() => fromFen(FORK_ROUNDS[0]!.fen), []);
  const next = () => {
    const to = STAGES[STAGES.indexOf(stage) + 1]!;
    setStage(to);
    if (to === 'done') onComplete?.(TACTICS_LESSON_ID);
  };
  const shared = { t, c, animate, voice, delay: advanceDelay, finishedBoard: start.board, onNext: next };

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
            <LearnBoard
              board={start.board}
              t={t}
              animate={animate}
              selected={squareOf('e5')}
              marks={new Set([squareOf('d8'), squareOf('h8')])}
            />
          }
        >
          <p className="ch-learn-text">{c('meet')}</p>
          <ReadAloud text={c('meet')} voice={voice} t={t} />
          <button type="button" className="btn" onClick={next}>
            {common('next')}
          </button>
        </LessonLayout>
      )}
      {stage === 'fork' && (
        <Stage kind="fork" rounds={FORK_ROUNDS} render={(p) => <ForkRoundView {...p} />} {...shared} />
      )}
      {stage === 'pin' && (
        <Stage kind="pin" rounds={PIN_ROUNDS} render={(p) => <PinRoundView {...p} />} {...shared} />
      )}
      {stage === 'mate' && (
        <Stage kind="mate" rounds={LADDER_ROUNDS} render={(p) => <MateRoundView {...p} />} {...shared} />
      )}
      {stage === 'draw' && (
        <Stage kind="draw" rounds={DRAW_ROUNDS} render={(p) => <DrawRoundView {...p} />} {...shared} />
      )}
      {stage === 'done' && (
        <LessonLayout board={<LearnBoard board={start.board} t={t} animate={animate} />}>
          <Status voice={voice} className="ch-learn-text" text={c('done')} />
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

/** Find a move after which the moved piece attacks two big pieces and cannot be taken. A plain move is refused. */
function ForkRoundView(props: RoundProps<ForkRound>) {
  const { round, progress, t, c, animate, onSolved } = props;
  const start = useMemo(() => fromFen(round.fen), [round]);
  const forks = useMemo(() => forkMoves(start), [start]);
  const b = useMoveBoard(start);
  const [solved, setSolved] = useState(false);
  const [wrong, setWrong] = useState(0);
  const [hint, setHint] = useState(false);
  const [message, setMessage] = useState('');
  const [targets, setTargets] = useState<number[]>([]);

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
      setMessage(c('fork.illegal'));
      return;
    }
    if (!forks.some((f) => f.from === move.from && f.to === move.to)) {
      setWrong((w) => w + 1);
      setMessage(c('fork.notFork'));
      return;
    }
    setTargets(forkTargets(b.pos, move));
    b.play(makeMove(b.pos, move), move);
    setSolved(true);
    setMessage(c('fork.right'));
    onSolved();
  };

  const reach = b.selected === null ? [] : targetsFrom(b.pos, b.selected);
  const hinted = hint && !solved ? [...new Set(forks.map((f) => f.from))] : [];
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
          marks={new Set(solved ? targets : hinted)}
          shake={wrong}
          slide={b.slide}
          onSquare={click}
        />
      }
    >
      <Panel
        nonce={wrong}
        kind="fork"
        prompt={c('prompt.fork')}
        progress={progress}
        message={message || (hint && !solved ? c('fork.hint') : '')}
        extra={
          !solved &&
          !hint && (
            <div className="ch-learn-actions">
              <button type="button" className="btn" onClick={() => setHint(true)}>
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

/** Tap the white piece that is pinned to its king. */
function PinRoundView(props: RoundProps<PinRound>) {
  const { round, progress, t, c, animate, onSolved } = props;
  const pos = useMemo(() => fromFen(round.fen), [round]);
  const pinned = useMemo(() => pinnedSquares(pos), [pos]);
  const attackers = useMemo(() => pinned.flatMap((s) => pinners(pos, s)), [pos, pinned]);
  const [solved, setSolved] = useState(false);
  const [wrong, setWrong] = useState(0);
  const [hint, setHint] = useState(false);

  const click = (s: number) => {
    if (solved) return;
    if (pinned.includes(s)) {
      setSolved(true);
      onSolved();
    } else {
      setWrong((w) => w + 1);
    }
  };
  const marks = solved ? [...pinned, ...attackers] : hint ? attackers : [];
  return (
    <LessonLayout
      board={
        <LearnBoard
          board={pos.board}
          t={t}
          animate={animate}
          marks={new Set(marks)}
          danger={solved ? kingSquare(pos.board, 'w') : null}
          shake={wrong}
          onSquare={click}
        />
      }
    >
      <Panel
        nonce={wrong}
        kind="pin"
        prompt={c('prompt.pin')}
        progress={progress}
        message={solved ? c('pin.right') : wrong > 0 ? c('pin.wrong') : hint ? c('pin.hint') : ''}
        extra={
          !solved &&
          !hint && (
            <div className="ch-learn-actions">
              <button type="button" className="btn" onClick={() => setHint(true)}>
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

const DRAW_ANSWERS: DrawKind[] = ['mate', 'stalemate', 'ongoing'];

/** Black to move: checkmate, a draw by stalemate, or not over yet? */
function DrawRoundView(props: RoundProps<DrawRound>) {
  const { round, progress, t, c, animate, onSolved } = props;
  const pos = useMemo(() => fromFen(round.fen), [round]);
  const kind = useMemo(() => drawKind(pos), [pos]);
  const [solved, setSolved] = useState(false);
  const [wrong, setWrong] = useState(0);
  const checked = kind === 'mate';

  const answer = (choice: DrawKind) => {
    if (solved) return;
    if (choice === kind) {
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
          danger={checked ? kingSquare(pos.board, 'b') : null}
          shake={wrong}
        />
      }
    >
      <Panel
        nonce={wrong}
        kind="draw"
        prompt={c('prompt.draw')}
        progress={progress}
        message={solved ? c(`draw.right.${kind}`) : wrong > 0 ? c('draw.wrong') : ''}
        extra={
          <div className="ch-learn-actions" role="group" aria-label={c('prompt.draw')}>
            {DRAW_ANSWERS.map((choice) => (
              <button
                key={choice}
                type="button"
                className="btn btn-lg"
                disabled={solved}
                onClick={() => answer(choice)}
              >
                {c(`draw.${choice}`)}
              </button>
            ))}
          </div>
        }
        props={props}
      />
    </LessonLayout>
  );
}
