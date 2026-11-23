'use client';

import { useMemo, useState } from 'react';
import type { Translator } from '@bg/ui';
import { describe as describeMove, fromFen, makeMove, squareOf } from '../rules/board';
import type { Piece, PieceType } from '../rules/types';
import { PieceGlyph } from '../ui/PieceGlyph';
import {
  ATTACKED_ROUNDS,
  type AttackedRound,
  attackers,
  CAPTURE_LESSON_ID,
  capturable,
  isSafeCapture,
  PIECE_VALUE,
  recapturers,
  SAFE_ROUNDS,
  type SafeRound,
  TAKE_ROUNDS,
  type TakeRound,
  toMove,
  VALUE_ROUNDS,
  type ValueRound,
} from './capture';
import { LearnBoard, LessonLayout } from './LearnBoard';
import { movesFrom, targetsFrom } from './logic';
import { ReadAloud } from './ReadAloud';
import { Status } from './Status';
import { useVoice } from './voice';
import { Panel, type RoundProps, Stage, type Tx, useMoveBoard } from './rounds';

type StageName = 'meet' | 'take' | 'attacked' | 'safe' | 'value' | 'done';
const STAGES: StageName[] = ['meet', 'take', 'attacked', 'safe', 'value', 'done'];

type Props = {
  t: Translator;
  animate: boolean;
  onComplete?(id: string): void;
  /** Language of the read-aloud voice: 'vi' or 'en'. */
  lang?: string;
  /** Pause before the next question after a right answer, in ms. */
  advanceDelay?: number;
};

/** Taking pieces, which piece is in danger, whether a capture is safe, and what the pieces are worth. */
export function CaptureLesson({ t, animate, onComplete, lang = 'vi', advanceDelay = 1400 }: Props) {
  const [stage, setStage] = useState<StageName>('meet');
  const voice = useVoice(lang);
  const c: Tx = (key, values) => t(`games.chess.learn.capture.${key}`, values);
  const common = (key: string) => t(`games.chess.learn.${key}`);
  const start = useMemo(() => fromFen(TAKE_ROUNDS[0]!.fen), []);
  const next = () => {
    const to = STAGES[STAGES.indexOf(stage) + 1]!;
    setStage(to);
    if (to === 'done') onComplete?.(CAPTURE_LESSON_ID);
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
              selected={squareOf('d4')}
              captures={new Set([squareOf('g4')])}
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
      {stage === 'take' && (
        <Stage kind="take" rounds={TAKE_ROUNDS} render={(p) => <TakeRoundView {...p} />} {...shared} />
      )}
      {stage === 'attacked' && (
        <Stage
          kind="attacked"
          rounds={ATTACKED_ROUNDS}
          render={(p) => <AttackedRoundView {...p} />}
          {...shared}
        />
      )}
      {stage === 'safe' && (
        <Stage kind="safe" rounds={SAFE_ROUNDS} render={(p) => <SafeRoundView {...p} />} {...shared} />
      )}
      {stage === 'value' && (
        <Stage kind="value" rounds={VALUE_ROUNDS} render={(p) => <ValueRoundView {...p} />} {...shared} />
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

/** Take any black piece: select a white piece, then the piece it takes. A plain move is not accepted. */
function TakeRoundView(props: RoundProps<TakeRound>) {
  const { round, progress, t, c, animate, onSolved } = props;
  const start = useMemo(() => fromFen(round.fen), [round]);
  const b = useMoveBoard(start);
  const [solved, setSolved] = useState(false);
  const [wrong, setWrong] = useState(0);
  const [hint, setHint] = useState(false);
  const [message, setMessage] = useState('');
  const targets = useMemo(() => capturable(start), [start]);

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
      setMessage(c('take.illegal'));
      return;
    }
    if (describeMove(b.pos, move).captured === null) {
      setWrong((w) => w + 1);
      setMessage(c('take.notCapture'));
      return;
    }
    b.play(makeMove(b.pos, move), move);
    setSolved(true);
    setMessage(c('take.right'));
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
          marks={new Set(hint && !solved ? targets : [])}
          shake={wrong}
          slide={b.slide}
          onSquare={click}
        />
      }
    >
      <Panel
        nonce={wrong}
        kind="take"
        prompt={c('prompt.take')}
        progress={progress}
        message={message || (hint && !solved ? c('take.hint') : '')}
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

/** Black is to move: tap the white piece that a black piece can take. */
function AttackedRoundView(props: RoundProps<AttackedRound>) {
  const { round, progress, t, c, animate, onSolved } = props;
  const pos = useMemo(() => fromFen(round.fen), [round]);
  const danger = useMemo(() => capturable(pos), [pos]);
  const hunters = useMemo(() => attackers(pos), [pos]);
  const [solved, setSolved] = useState(false);
  const [wrong, setWrong] = useState(0);
  const [hint, setHint] = useState(false);

  const click = (s: number) => {
    if (solved) return;
    if (danger.includes(s)) {
      setSolved(true);
      onSolved();
    } else {
      setWrong((w) => w + 1);
    }
  };
  const marks = solved ? [...hunters, ...danger] : hint ? hunters : [];
  return (
    <LessonLayout
      board={
        <LearnBoard
          board={pos.board}
          t={t}
          animate={animate}
          marks={new Set(marks)}
          captures={new Set(solved ? danger : [])}
          shake={wrong}
          onSquare={click}
        />
      }
    >
      <Panel
        nonce={wrong}
        kind="attacked"
        prompt={c('prompt.attacked')}
        progress={progress}
        message={
          solved ? c('attacked.right') : wrong > 0 ? c('attacked.wrong') : hint ? c('attacked.hint') : ''
        }
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

/** White could take a piece: is it free, or does a guard take back? */
function SafeRoundView(props: RoundProps<SafeRound>) {
  const { round, progress, t, c, animate, onSolved } = props;
  const pos = useMemo(() => fromFen(round.fen), [round]);
  const move = useMemo(() => toMove(round), [round]);
  const safe = useMemo(() => isSafeCapture(pos, move), [pos, move]);
  const guards = useMemo(() => recapturers(pos, move), [pos, move]);
  const [solved, setSolved] = useState(false);
  const [wrong, setWrong] = useState(0);

  const answer = (eat: boolean) => {
    if (solved) return;
    if (eat === safe) {
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
          selected={move.from}
          captures={new Set([move.to])}
          marks={new Set(solved ? guards : [])}
          shake={wrong}
        />
      }
    >
      <Panel
        nonce={wrong}
        kind="safe"
        prompt={c('prompt.safe')}
        progress={progress}
        message={
          solved
            ? c(safe ? 'safe.rightFree' : 'safe.rightGuarded')
            : wrong > 0
              ? c(safe ? 'safe.wrongFree' : 'safe.wrongGuarded')
              : ''
        }
        extra={
          <div className="ch-learn-actions" role="group" aria-label={c('prompt.safe')}>
            <button type="button" className="btn btn-lg" disabled={solved} onClick={() => answer(true)}>
              {c('safe.eat')}
            </button>
            <button type="button" className="btn btn-lg" disabled={solved} onClick={() => answer(false)}>
              {c('safe.skip')}
            </button>
          </div>
        }
        props={props}
      />
    </LessonLayout>
  );
}

/** Two pieces: which is worth more? */
function ValueRoundView(props: RoundProps<ValueRound>) {
  const { round, progress, t, c, animate, onSolved } = props;
  const [solved, setSolved] = useState(false);
  const [wrong, setWrong] = useState(0);
  const big = PIECE_VALUE[round.left] > PIECE_VALUE[round.right] ? round.left : round.right;
  const small = big === round.left ? round.right : round.left;
  const name = (type: PieceType) => t(`games.chess.pieceNames.${type}`);
  const leftSquare = squareOf('c4');
  const rightSquare = squareOf('f4');
  const board = Array.from({ length: 64 }, (_, i): Piece | null =>
    i === leftSquare ? `w${round.left}` : i === rightSquare ? `w${round.right}` : null,
  );

  const answer = (type: PieceType) => {
    if (solved) return;
    if (type === big) {
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
          board={board}
          t={t}
          animate={animate}
          shake={wrong}
          onSquare={(sq) =>
            sq === leftSquare ? answer(round.left) : sq === rightSquare ? answer(round.right) : undefined
          }
        />
      }
    >
      <Panel
        nonce={wrong}
        kind="value"
        prompt={c('prompt.value')}
        progress={progress}
        message={
          solved
            ? c('value.right', {
                big: name(big),
                bigPoints: PIECE_VALUE[big],
                small: name(small),
                smallPoints: PIECE_VALUE[small],
              })
            : wrong > 0
              ? c('value.wrong')
              : ''
        }
        extra={
          <div className="ch-learn-actions" role="group" aria-label={c('prompt.value')}>
            {[round.left, round.right].map((type) => (
              <button
                key={type}
                type="button"
                className="btn btn-lg ch-value-btn"
                aria-label={name(type)}
                disabled={solved}
                onClick={() => answer(type)}
              >
                <PieceGlyph piece={`w${type}`} size={56} />
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
