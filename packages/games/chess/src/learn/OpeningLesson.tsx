'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Translator } from '@bg/ui';
import { squareName } from '../rules/board';
import type { OpeningLessonData } from './data';
import { LearnBoard, LessonLayout } from './LearnBoard';
import { canSpeak, speak, stopSpeaking } from './speech';
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
};

const SUMMARY_POINTS = [0, 1, 2];

/** The child plays one side of a famous line; every move comes with the idea behind it. */
export function OpeningLesson({ lesson, t, animate, onComplete, opponentDelay = 900, lang = 'vi' }: Props) {
  const positions = useMemo(() => positionsOf(lesson), [lesson]);
  const total = lesson.moves.length;
  const key = (k: string) => `games.chess.learn.openings.${lesson.id}.${k}`;
  const common = (k: string, values?: Record<string, string | number>) => t(`games.chess.learn.${k}`, values);

  const [ply, setPly] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [hint, setHint] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [voice, setVoice] = useState(false);
  const [autoRead, setAutoRead] = useState(false);
  useEffect(() => {
    setVoice(canSpeak());
    return stopSpeaking;
  }, []);
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

  // Read-aloud: on demand with the buttons, or by itself when the child turned it on.
  useEffect(() => {
    if (autoRead && idea) speak(idea, lang);
    // Only when the position changes, not when the toggle is turned off.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRead, shown]);

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
          <p className="ch-learn-status" role="status" aria-live="polite">
            {feedback === 'wrong'
              ? common('wrongMove')
              : feedback === 'right'
                ? common('rightMove')
                : common('yourTurn')}
          </p>
        )}
        {!finished && mine && (
          <div className="ch-learn-actions">
            <button
              type="button"
              className="btn"
              disabled={hint >= 2}
              onClick={() => {
                const next = hint + 1;
                setHint(next);
                if (voice && expected) {
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
              {common('hint')}
            </button>
          </div>
        )}
        {hintText && (
          <p className="ch-learn-status" role="status" aria-live="polite">
            {hintText}
          </p>
        )}
        {voice && !finished && idea && (
          <div className="ch-learn-actions">
            <button
              type="button"
              className="btn"
              onClick={() => speak(hintText ? `${idea} ${hintText}` : idea, lang)}
            >
              🔊 {common('readAloud')}
            </button>
            <label className="ch-learn-toggle">
              <input
                type="checkbox"
                checked={autoRead}
                onChange={(e) => (setAutoRead(e.target.checked), stopSpeaking())}
              />{' '}
              {common('autoRead')}
            </label>
          </div>
        )}

        {finished && (
          <div className="ch-learn-summary" role="status">
            <p className="ch-learn-idea">
              <strong>{common('openingDone')}</strong> {t(key(`s${total - 1}`))}
            </p>
            <h3>{common('remember')}</h3>
            <ul>
              {SUMMARY_POINTS.map((i) => (
                <li key={i}>{t(key(`sum${i}`))}</li>
              ))}
            </ul>
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
              {common('again')}
            </button>
          </div>
        )}
      </LessonLayout>
    </section>
  );
}
