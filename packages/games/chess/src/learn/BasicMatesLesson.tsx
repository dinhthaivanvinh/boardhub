'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Translator } from '@bg/ui';
import { fromFen, kingSquare, makeMove } from '../rules/board';
import type { ChessMove, Piece, Position } from '../rules/types';
import {
  BASIC_MATES_LESSON_ID,
  judgeMateMove,
  type MateDrill,
  type MateDrillId,
  MATE_DRILLS,
  mateHint,
  ROOK_CHALLENGE,
} from './basic-mates';
import { LearnBoard, LessonLayout } from './LearnBoard';
import { DoneCard, LessonHeader } from './LessonChrome';
import { movesFrom, targetsFrom } from './logic';
import { ReadAloud } from './ReadAloud';
import { Panel, type RoundProps, Stage, type Tx, type Slide, useTimers } from './rounds';
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
  /** Pause before the black king answers, and before a bad move is taken back, in ms. */
  advanceDelay?: number;
};

/** The steps in the header; the rook challenge is an extra after the end, not one of them. */
const STAGES = ['meet', 'rooks', 'queen', 'done'] as const;
type StageName = (typeof STAGES)[number] | 'rook';

/** Mating a lone king: two rooks, then queen and king; rook and king as a challenge. */
export function BasicMatesLesson({
  t,
  animate,
  onComplete,
  lang = 'vi',
  footer,
  advanceDelay = 1000,
}: Props) {
  const [stage, setStage] = useState<StageName>('meet');
  const voice = useVoice(lang);
  const c: Tx = (key, values) => t(`games.chess.learn.${BASIC_MATES_LESSON_ID}.${key}`, values);
  const board = useMemo(() => fromFen(MATE_DRILLS[0]!.fen).board, []);

  const next = () => {
    const to = STAGES[STAGES.indexOf(stage as (typeof STAGES)[number]) + 1]!;
    setStage(to);
    if (to === 'done') onComplete?.(BASIC_MATES_LESSON_ID);
  };
  const drill = (d: MateDrill, onNext: () => void) => (
    <Stage
      key={d.id}
      kind={d.id}
      rounds={[d]}
      render={(p) => <DrillView {...p} />}
      finishedBoard={board}
      t={t}
      c={c}
      animate={animate}
      voice={voice}
      delay={advanceDelay}
      onNext={onNext}
    />
  );

  return (
    <section className="ch-learn" aria-label={c('name')}>
      <LessonHeader
        title={c('name')}
        stages={STAGES}
        stage={stage === 'rook' ? 'done' : stage}
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
      {stage === 'rooks' && drill(MATE_DRILLS[0]!, next)}
      {stage === 'queen' && drill(MATE_DRILLS[1]!, next)}
      {stage === 'rook' && drill(ROOK_CHALLENGE, () => setStage('done'))}
      {stage === 'done' && (
        <DoneCard
          t={t}
          voice={voice}
          message={c('done')}
          fun={c('fun')}
          onAgain={() => setStage('meet')}
          footer={
            <>
              {footer}
              <button type="button" className="btn" onClick={() => setStage('rook')}>
                {c('challenge')}
              </button>
            </>
          }
        />
      )}
    </section>
  );
}

/**
 * One game against the lone king. A move that draws or drops a piece is shown and then taken back, only that
 * move. Too many moves without mate and the board is set up again.
 */
function DrillView(props: RoundProps<MateDrill>) {
  const { round, t, c, animate, delay, onSolved } = props;
  const start = useMemo(() => fromFen(round.fen), [round]);
  const [pos, setPos] = useState<Position>(start);
  const [slide, setSlide] = useState<(Slide & { count: number }) | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [busy, setBusy] = useState(false);
  const [solved, setSolved] = useState(false);
  const [wrong, setWrong] = useState(0);
  const [hint, setHint] = useState(0);
  const [message, setMessage] = useState('');
  const timers = useTimers();
  const [alive] = useState(() => ({ current: true }));
  useEffect(() => {
    alive.current = true;
    // `later` adds to this same list, so the cleanup sees every timer.
    const pending = timers.current;
    return () => {
      alive.current = false;
      pending.forEach(clearTimeout);
    };
  }, [alive, timers]);

  const id = round.id as MateDrillId;
  const advice = useMemo(() => mateHint(id, pos), [id, pos]);

  /** Shows `move` from `from`: the board becomes the position after it, the piece slides there. */
  const show = (from: Position, move: ChessMove) => {
    const after = makeMove(from, move);
    setPos(after);
    setSlide((s) => {
      const count = (s?.count ?? 0) + 1;
      return { id: count, count, from: move.from, to: move.to, piece: after.board[move.to] as Piece };
    });
    return after;
  };
  const goBack = (to: Position) => {
    setPos(to);
    setSlide(null);
    setBusy(false);
  };
  const later = (ms: number, run: () => void) => {
    timers.current.push(setTimeout(run, ms));
  };

  const click = (s: number) => {
    if (solved || busy) return;
    if (pos.board[s]?.[0] === 'w') {
      setSelected(s);
      setMessage('');
      return;
    }
    if (selected === null) return;
    const move = movesFrom(pos, selected).find((m) => m.to === s);
    if (!move) {
      setWrong((w) => w + 1);
      setMessage(c('illegal'));
      return;
    }
    const step = judgeMateMove(pos, move);
    const before = pos;
    setSelected(null);
    setHint(0);
    const after = show(before, move);
    if (step.kind === 'mate') {
      setSolved(true);
      setMessage(c('right'));
      onSolved();
      return;
    }
    setBusy(true);
    if (step.kind === 'stalemate' || step.kind === 'lost') {
      setWrong((w) => w + 1);
      setMessage(c(step.kind));
      if (step.kind === 'lost') later(delay / 2, () => show(after, step.reply));
      // The child cannot read the reason: take the move back only after it has been heard.
      later(delay * 2, () => void waitUntilSilent().then(() => alive.current && goBack(before)));
      return;
    }
    setMessage('');
    const tooLong = moves + 1 >= round.limit;
    setMoves(moves + 1);
    later(delay / 2, () => {
      show(after, step.reply);
      if (!tooLong) {
        setBusy(false);
        return;
      }
      setMessage(c('tooLong'));
      later(
        delay * 2,
        () =>
          void waitUntilSilent().then(() => {
            if (!alive.current) return;
            setMoves(0);
            goBack(start);
          }),
      );
    });
  };

  const restart = () => {
    setMoves(0);
    setSelected(null);
    setHint(0);
    setMessage('');
    goBack(start);
  };

  const reach = selected === null ? [] : targetsFrom(pos, selected);
  const hinted = new Set<number>();
  if (!solved && !busy && advice.move) {
    if (hint >= 1) hinted.add(advice.move.from);
    if (hint >= 2) hinted.add(advice.move.to);
  }
  const hintText = hint === 0 ? '' : advice.move ? c('mateNow') : c(`tip.${advice.tip}`);
  /** Words have one level; a mate in one also shows the square at the second. */
  const lastHint = advice.move ? 2 : 1;
  // The sliding piece is drawn by the slide, so it leaves the board array.
  const shown = slide ? pos.board.map((p, i) => (i === slide.to ? null : p)) : pos.board;

  return (
    <LessonLayout
      board={
        <LearnBoard
          board={shown}
          t={t}
          animate={animate}
          selected={selected}
          dots={new Set(reach.filter((s) => !pos.board[s]))}
          captures={new Set(reach.filter((s) => pos.board[s]))}
          marks={hinted}
          danger={solved ? kingSquare(pos.board, 'b') : null}
          shake={wrong}
          slide={slide}
          onSquare={click}
        />
      }
    >
      <Panel
        nonce={wrong}
        kind={id}
        prompt={c(`prompt.${id}`)}
        progress=""
        message={message || hintText}
        extra={
          solved ? null : (
            <>
              <p className="text-sm" data-testid="mate-moves">
                {c('moves', { count: moves })}
              </p>
              <div className="ch-learn-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={busy || hint >= lastHint}
                  onClick={() => {
                    setHint((h) => h + 1);
                    setMessage('');
                  }}
                >
                  {t('games.chess.learn.hint')}
                </button>
                <button type="button" className="btn" disabled={busy} onClick={restart}>
                  {c('restart')}
                </button>
              </div>
            </>
          )
        }
        props={props}
      />
    </LessonLayout>
  );
}
