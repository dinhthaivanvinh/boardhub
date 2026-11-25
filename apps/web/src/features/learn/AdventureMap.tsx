'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PieceGlyph } from '@bg/game-chess';
import { ADVENTURE_STEPS, type StepKey } from './adventure-steps';
import { useDoneLessons } from './use-progress';

const PIECE_OF: Record<StepKey, 'wN' | 'wP' | 'wK' | 'wB' | 'wQ' | 'wR' | null> = {
  coordinates: null,
  pieces: 'wN',
  capture: 'wP',
  checkmate: 'wK',
  openings: 'wB',
  special: 'wQ',
  tactics: 'wR',
  play: null,
};

export function Star({ on, size = 20 }: { on: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="adv-star" data-on={on}>
      <path
        d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z"
        fill={on ? '#ffc928' : '#d6e2f0'}
        stroke={on ? '#e0a300' : '#c3d3e6'}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Board() {
  return (
    <svg viewBox="0 0 32 32" width="44" height="44" aria-hidden="true">
      <rect width="32" height="32" rx="6" fill="#b58863" />
      {[0, 1, 2, 3].flatMap((r) =>
        [0, 1, 2, 3].map((c) =>
          (r + c) % 2 === 0 ? (
            <rect key={`${r}${c}`} x={c * 8} y={r * 8} width="8" height="8" fill="#f0d9b5" />
          ) : null,
        ),
      )}
    </svg>
  );
}

/** The way of learning as a game map: eight places joined by a path; each shows how far the child got there. */
export function AdventureMap() {
  const t = useTranslations('portal.map');
  const tp = useTranslations('portal.path');
  const done = useDoneLessons();
  const firstOpen = ADVENTURE_STEPS.findIndex((s) => s.lessons.some((id) => !done.has(id)));

  return (
    <ol className="adv-map" data-game="chess">
      {ADVENTURE_STEPS.map((step, i) => {
        const total = step.lessons.length;
        const n = step.lessons.filter((id) => done.has(id)).length;
        const state = total === 0 ? 'play' : n === total ? 'done' : n > 0 ? 'doing' : 'new';
        const stars = total === 0 ? 0 : Math.round((3 * n) / total);
        const nextLesson = step.lessons.find((id) => !done.has(id));
        const href = nextLesson ? `/learn/chess/${nextLesson}` : step.href;
        const piece = PIECE_OF[step.key];
        return (
          <li key={step.key} className="adv-place" data-i={i} data-state={state} data-here={i === firstOpen}>
            <Link href={href} className="adv-place-card">
              <span className="adv-place-node" aria-hidden="true">
                <span className="adv-place-no">{i + 1}</span>
                {step.key === 'coordinates' ? (
                  <Board />
                ) : step.key === 'play' ? (
                  <Image src="/scene/mascot-face.webp" alt="" width={44} height={44} />
                ) : (
                  piece && <PieceGlyph piece={piece} size={44} />
                )}
              </span>
              <span className="adv-place-body">
                <strong className="adv-place-name">{t(`${step.key}.place`)}</strong>
                <span className="adv-place-lesson">{tp(`${step.key}.title`)}</span>
                <span className="adv-place-text">{t(`${step.key}.text`)}</span>
                {total > 0 && (
                  <span className="adv-place-progress">
                    <span className="adv-bar" aria-hidden="true">
                      <span style={{ width: `${(100 * n) / total}%` }} />
                    </span>
                    <span className="adv-place-count">{t('lessons', { n, total })}</span>
                  </span>
                )}
                <span className="adv-place-foot">
                  <span className="adv-stars" aria-hidden="true">
                    {[0, 1, 2].map((s) => (
                      <Star key={s} on={s < stars} />
                    ))}
                  </span>
                  <span className="adv-place-state">{t(`state.${state}`)}</span>
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
