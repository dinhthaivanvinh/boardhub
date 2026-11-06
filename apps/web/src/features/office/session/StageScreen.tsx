'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { OfficeSnapshot } from '@bg/protocol';
import { useOfficeSession, type LiveReaction } from '@/office/use-office-session';
import { DrawPlayer } from '../draw-player/DrawPlayer';
import { useOfficeSound } from '../draw-player/sounds';
import { SoundToggle } from '../draw-player/SoundToggle';
import { isRevealed } from '../draw-player/timeline';
import { ReactionLayer } from './Reactions';
import { Connecting, Herd, herdSize, joinUrl, OfficeError, QrCode, useAreaRedirect } from './shared';

/** The projector: big title, code and QR, and everyone's animal (docs/office/07 §2). No controls. */
export function StageScreen({ code }: { code: string }) {
  const { session, joinError, serverOffset, reactions } = useOfficeSession(code, 'stage', true);
  useAreaRedirect(session?.activityId);
  if (joinError && !session) return <OfficeError code={joinError} />;
  if (!session) return <Connecting />;
  return <StageView code={code} session={session} serverOffset={serverOffset} reactions={reactions} />;
}

/**
 * What the room sees: on the projector, and in the host's presentation mode (with `corner` controls).
 * The only control on the projector itself is the sound switch (a click is needed to allow sound).
 */
export function StageView({
  code,
  session,
  serverOffset,
  reactions,
  corner,
}: {
  code: string;
  session: OfficeSnapshot;
  serverOffset: number;
  reactions: LiveReaction[];
  corner?: ReactNode;
}) {
  const t = useTranslations('officeSession');
  const sound = useOfficeSound((s) => s.on);
  const people = session.participants;
  const url = joinUrl(code, session.activityId);

  return (
    <div className="office-stage" data-testid="office-stage">
      <header className="office-stage-head">
        <div>
          <p className="office-stage-kicker">{t(`activity.${session.activityId}`)}</p>
          <h1 className="office-stage-title">{session.title || t('untitled')}</h1>
        </div>
        {session.status !== 'closed' && (
          <div className="office-stage-join">
            <QrCode value={url} size={168} />
            <div>
              <p className="office-stage-join-label">{t('joinAt')}</p>
              <p className="office-stage-url">{url.replace(/^https?:\/\//, '')}</p>
              <p className="office-stage-code" data-testid="stage-code">
                {code}
              </p>
            </div>
          </div>
        )}
      </header>
      <p className="office-stage-count" aria-live="polite">
        {session.status === 'closed'
          ? t('closed')
          : session.status === 'locked'
            ? t('lockedCount', { n: people.length })
            : t('count', { n: people.length })}
      </p>
      {session.draw && (
        <DrawPlayer
          key={session.draw.drawId}
          code={code}
          draw={session.draw}
          serverOffset={serverOffset}
          sound={sound}
          big
        />
      )}
      {session.draw && !isRevealed(session.draw) ? null : people.length === 0 ? (
        <p className="office-stage-empty">{t('waitingFirst')}</p>
      ) : (
        <Herd people={people} size={herdSize(people.length)} showNames={people.length <= 60} />
      )}
      <ReactionLayer reactions={reactions} people={people} />
      <div className="office-stage-corner">
        {corner}
        <SoundToggle />
      </div>
    </div>
  );
}
