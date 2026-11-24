'use client';

import type { ReactNode } from 'react';
import type { Translator } from '@bg/ui';
import { LessonLayout } from './LearnBoard';
import { ReadAloud, type VoiceState } from './ReadAloud';
import { Status } from './Status';

/**
 * The top of every lesson: the title, the steps (the ones already done can be tapped to go back to them) and a
 * big Back button, so a child is never stuck with only "Continue".
 */
export function LessonHeader({
  title,
  stages,
  stage,
  label,
  onStage,
  t,
}: {
  title: string;
  stages: readonly string[];
  stage: string;
  label(stage: string): string;
  onStage(stage: string): void;
  t: Translator;
}) {
  const index = stages.indexOf(stage);
  return (
    <header className="ch-learn-header">
      <h2 className="ch-learn-title">{title}</h2>
      <ol className="ch-learn-steps" aria-label={t('games.chess.learn.steps')}>
        {stages.map((s, i) => (
          <li key={s} aria-current={s === stage ? 'step' : undefined} data-done={i < index} data-i={i % 6}>
            {i < index ? (
              <button type="button" className="ch-step-btn" onClick={() => onStage(s)}>
                <span aria-hidden="true">⭐ </span>
                {label(s)}
              </button>
            ) : (
              label(s)
            )}
          </li>
        ))}
      </ol>
      {index > 0 && (
        <button type="button" className="btn ch-back" onClick={() => onStage(stages[index - 1]!)}>
          <span aria-hidden="true">←</span> {t('games.chess.learn.back')}
        </button>
      )}
    </header>
  );
}

/** The finished screen of a lesson: a big star, the result read aloud, and what to do next. */
export function DoneCard({
  t,
  voice,
  message,
  fun,
  glyph,
  onAgain,
  footer,
}: {
  t: Translator;
  voice: VoiceState;
  message: string;
  fun?: string;
  /** Something to show with the star, e.g. the piece that was learned. */
  glyph?: ReactNode;
  onAgain(): void;
  /** Extra actions, e.g. the link to the next lesson. */
  footer?: ReactNode;
}) {
  return (
    <LessonLayout
      board={
        <div className="ch-celebrate" aria-hidden="true">
          <span className="ch-celebrate-star">🌟</span>
          {glyph}
          {['✨', '🎉', '⭐', '🎈', '✨', '🎉'].map((c, i) => (
            <span key={i} className="ch-confetti" data-i={i}>
              {c}
            </span>
          ))}
        </div>
      }
    >
      <h3 className="ch-done-title">{t('games.chess.learn.great')}</h3>
      <Status voice={voice} className="ch-learn-text" text={message} />
      {fun && (
        <>
          <p className="ch-learn-text">{fun}</p>
          <ReadAloud text={fun} voice={voice} t={t} />
        </>
      )}
      <div className="ch-learn-actions ch-done-actions">
        {footer}
        <button type="button" className="btn" onClick={onAgain}>
          <span aria-hidden="true">↻</span> {t('games.chess.learn.again')}
        </button>
      </div>
    </LessonLayout>
  );
}
