'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Avatar } from '@bg/avatars';
import { OFFICE_REACTIONS, type OfficeParticipant, type OfficeReactionEmoji } from '@bg/protocol';
import type { LiveReaction } from '@/office/use-office-session';
import { playPop, useOfficeSound } from '../draw-player/sounds';

/** Stable pseudo-random number in [0, 1) from a reaction key, so each one floats up on its own path. */
const spread = (key: number, salt: number) => {
  const x = Math.sin(key * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** Reactions floating up from the bottom of the stage (or the host screen), with the sender's animal. */
export function ReactionLayer({
  reactions,
  people,
}: {
  reactions: LiveReaction[];
  people: OfficeParticipant[];
}) {
  const sound = useOfficeSound((s) => s.on);
  const last = useRef(0);
  useEffect(() => {
    const newest = reactions[reactions.length - 1];
    if (!newest || newest.key <= last.current) return;
    last.current = newest.key;
    if (sound) playPop();
  }, [reactions, sound]);

  return (
    <div className="reaction-layer" aria-hidden="true" data-testid="reaction-layer">
      {reactions.map((r) => {
        const who = people.find((p) => p.id === r.from);
        return (
          <span
            key={r.key}
            className="reaction"
            data-testid="reaction"
            style={
              {
                left: `${6 + spread(r.key, 1) * 88}%`,
                '--drift': `${(spread(r.key, 2) - 0.5) * 120}px`,
                '--tilt': `${(spread(r.key, 3) - 0.5) * 40}deg`,
              } as CSSProperties
            }
          >
            <span className="reaction-emoji">{r.emoji}</span>
            {who && <Avatar avatar={who.avatar} size={36} />}
          </span>
        );
      })}
    </div>
  );
}

/** The phone's emoji buttons (docs/office/07 §6). */
export function ReactionBar({ onReact }: { onReact(emoji: OfficeReactionEmoji): Promise<unknown> }) {
  const t = useTranslations('officeSession.reactions');
  const [popped, setPopped] = useState<string | null>(null);
  return (
    <div className="reaction-bar" role="group" aria-label={t('label')}>
      {OFFICE_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className={popped === emoji ? 'reaction-button reaction-button-pop' : 'reaction-button'}
          aria-label={t('send', { emoji })}
          onClick={() => {
            setPopped(emoji);
            window.setTimeout(() => setPopped((p) => (p === emoji ? null : p)), 300);
            void onReact(emoji);
          }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
