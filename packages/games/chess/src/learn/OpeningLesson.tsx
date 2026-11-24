'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Translator } from '@bg/ui';
import { squareName } from '../rules/board';
import type { OpeningLessonData } from './data';
import { LearnBoard, LessonLayout } from './LearnBoard';
import { ReadAloud } from './ReadAloud';
import { Status } from './Status';
import { useVoice } from './voice';
import { speak } from './speech';
import { movesFrom, parseMove, positionsOf, targetsFrom } from './logic';

type Props = {
  lesson: OpeningLessonData;
  t: Translator;
  animate: boolean;
  onComplete?(id: string): void;
  /** Pause before the opponent answers, in ms. */
  opponentDelay?: number;
  /** Language of the read-aloud voice: 'vi' or 'en'. */
  lang?: string;
  /** Shown when the line is finished, e.g. a link to the next lesson. */
  footer?: ReactNode;
};

const SUMMARY_POINTS = [0, 1, 2];

/** The child plays one side of a famous line; every move comes with the idea behind it. */
export function OpeningLesson({
  lesson,
  t,
  animate,
  onComplete,
  opponentDelay = 900,
  lang = 'vi',
  footer,
}: Props) {
  const positions = useMemo(() => positionsOf(lesson), [lesson]);
  const total = lesson.moves.length;
  const key = (k: string) => `games.chess.learn.openings.${lesson.id}.${k}`;
  const common = (k: string, values?: Record<string, string | number>) => t(`games.chess.learn.${k}`, values);

  const [ply, setPly] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [hint, setHint] = useState(0);
  const [wrong, setWrong] = useState(0);
  const voice = useVoice(lang);
  const [feedback, setFeedback] = useState<'idle' | 'wrong' | 'right'>('idle');

  const pos = positions[ply]!;
  const finished = ply >= total;
  const mine = !finished && pos.turn === lesson.side;
  const expected = finished ? null : parseMove(lesson.moves[ply]!);
  const last = ply > 0 ? parseMove(lesson.moves[ply - 1]!) : null;

  useEffect(() => {
    if (finished || mine) return;
    const id = setTimeout(() => {
      setPly((p) => p + 1);
      setFeedback('idle');
    }, opponentDelay);
    return () => clearTimeout(id);
  }, [ply, finished, mine, opponentDelay]);

  useEffect(() => {
    if (finished) onComplete?.(lesson.id);
    // Reported once when the line is finished.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  // Back goes to the previous turn of the child; as Black the first turn is after White's opening move.
  const firstPly = lesson.side === 'w' ? 0 : 1;
  const goBack = () => {
    let p = ply - 1;
    while (p > firstPly && positions[p]!.turn !== lesson.side) p--;
    setPly(Math.max(firstPly, p));
    setSelected(null);
    setHint(0);
    setFeedback('idle');
  };

  const play = (s: number) => {
    if (!mine || !expected) return;
    const own = pos.board[s];
    if (own && (own[0] === 'w') === (lesson.side === 'w')) {
      setSelected(s);
      setFeedback('idle');
      return;
    }
    if (selected === null || !movesFrom(pos, selected).some((m) => m.to === s)) return;
    if (selected === expected.from && s === expected.to) {
      setPly(ply + 1);
      setSelected(null);
      setHint(0);
      setFeedback('right');
    } else {
      setWrong((w) => w + 1);
      setFeedback('wrong');
    }
  };

  const reach = selected === null || !mine ? [] : targetsFrom(pos, selected);
  const marks = new Set<number>();
  if (last) {
    marks.add(last.from);
    marks.add(last.to);
  }
  if (mine && expected && hint >= 1) marks.add(expected.from);
  if (mine && expected && hint >= 2) marks.add(expected.to);

  // Before the child's move: the idea of the move to find. After the opponent's move: the idea behind it.
  const shown = mine ? ply : ply - 1;
  const idea = shown >= 0 && !finished ? t(key(`s${shown}`)) : '';
  const hintText =
    mine && expected && hint >= 1
      ? hint === 1
        ? common('hintFrom', { square: squareName(expected.from) })
        : common('hintTo', { from: squareName(expected.from), square: squareName(expected.to) })
      : '';

  return (
    <section className="ch-learn" aria-label={t(key('name'))}>
      <h2 className="ch-learn-title">{t(key('name'))}</h2>
      <LessonLayout
        board={
          <LearnBoard
            board={pos.board}
            flipped={lesson.side === 'b'}
            t={t}
            animate={animate}
            selected={selected}
            dots={new Set(reach.filter((s) => !pos.board[s]))}
            captures={new Set(reach.filter((s) => pos.board[s]))}
            marks={marks}
            shake={wrong}
            onSquare={play}
          />
        }
      >
        <p className="ch-learn-text">{t(key('intro'))}</p>
        <p className="ch-learn-meta">
          {common('youPlay', { color: t(`games.chess.pieces.${lesson.side === 'w' ? 0 : 1}`) })} ·{' '}
          {common('progress', { n: Math.min(ply, total), total })}
        </p>

        {!finished && shown >= 0 && (
          <p className="ch-learn-idea" role="status" aria-live="polite">
            <strong>{mine ? common('idea') : common('opponentPlayed')}</strong> {idea}
          </p>
        )}
        {!finished && mine && (
          <Status
            voice={voice}
            text={
              feedback === 'wrong'
                ? common('wrongMove')
                : feedback === 'right'
                  ? common('rightMove')
                  : common('yourTurn')
            }
            nonce={wrong}
            speakIt={feedback !== 'idle'}
          />
        )}
        {!finished && (
          <div className="ch-learn-actions">
            {ply > firstPly && (
              <button type="button" className="btn ch-back" onClick={goBack}>
                <span aria-hidden="true">←</span> {common('backMove')}
              </button>
            )}
            {mine && (
              <button
                type="button"
                className="btn"
                disabled={hint >= 2}
                onClick={() => {
                  const next = hint + 1;
                  setHint(next);
                  if (expected) {
                    speak(
                      next === 1
                        ? common('hintFrom', { square: squareName(expected.from) })
                        : common('hintTo', {
                            from: squareName(expected.from),
                            square: squareName(expected.to),
                          }),
                      lang,
                    );
                  }
                }}
              >
                <span aria-hidden="true">💡</span> {common('hint')}
              </button>
            )}
          </div>
        )}
        {hintText && <Status voice={voice} text={hintText} speakIt={false} />}
        {!finished && idea && <ReadAloud text={idea} voice={voice} t={t} />}

        {finished && (
          <div className="ch-learn-summary" role="status">
            <Status
              voice={voice}
              className="ch-learn-idea"
              text={`${common('openingDone')} ${t(key(`s${total - 1}`))}`}
            />
            <h3>{common('remember')}</h3>
            <ul>
              {SUMMARY_POINTS.map((i) => (
                <li key={i}>{t(key(`sum${i}`))}</li>
              ))}
            </ul>
            <div className="ch-learn-actions ch-done-actions">
              {footer}
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setPly(0);
                  setSelected(null);
                  setHint(0);
                  setFeedback('idle');
                }}
              >
                <span aria-hidden="true">↻</span> {common('again')}
              </button>
            </div>
          </div>
        )}
      </LessonLayout>
    </section>
  );
}
