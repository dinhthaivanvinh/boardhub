'use client';

import { useTranslations } from 'next-intl';
import { useOfficeSession } from '@/office/use-office-session';
import { DrawPlayer } from '../draw-player/DrawPlayer';
import { isRevealed } from '../draw-player/timeline';
import { Connecting, Herd, herdSize, joinUrl, OfficeError, QrCode } from './shared';

/** The projector: big title, code and QR, and everyone's animal (docs/office/07 §2). No controls. */
export function StageScreen({ code }: { code: string }) {
  const t = useTranslations('officeSession');
  const { session, joinError, serverOffset } = useOfficeSession(code, 'stage', true);
  if (joinError && !session) return <OfficeError code={joinError} />;
  if (!session) return <Connecting />;
  const people = session.participants;
  const url = joinUrl(code);

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
          big
        />
      )}
      {session.draw && !isRevealed(session.draw) ? null : people.length === 0 ? (
        <p className="office-stage-empty">{t('waitingFirst')}</p>
      ) : (
        <Herd people={people} size={herdSize(people.length)} showNames={people.length <= 60} />
      )}
    </div>
  );
}
