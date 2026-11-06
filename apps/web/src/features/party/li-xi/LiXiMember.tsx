'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Avatar, type AvatarData } from '@bg/avatars';
import type { OfficeSnapshot } from '@bg/protocol';
import { useOfficeSound } from '@/features/office/draw-player/sounds';
import { SoundToggle } from '@/features/office/draw-player/SoundToggle';
import { ReactionBar, ReactionLayer } from '@/features/office/session/Reactions';
import { animalLabel } from '@/features/office/session/shared';
import { errorKey } from '@/game-runtime/error-key';
import { sessionPath } from '@/office/areas';
import type { OfficeSessionApi } from '@/office/use-office-session';
import { LiXiPhone } from './LiXiPhone';
import { LiXiStage } from './LiXiStage';

/**
 * A member's phone during Lì xì: straight into the Tết room (no "join" step — they come in with their
 * saved animal, and can change it from here), with everyone else in the room, plus their own line on
 * top ("Your turn!", their envelope). Sound is off until they turn it on: the TV plays it for the room.
 */
export function LiXiMember({
  code,
  session,
  api,
  avatar,
  name,
}: {
  code: string;
  session: OfficeSnapshot;
  api: OfficeSessionApi;
  avatar: AvatarData;
  name: string;
}) {
  const t = useTranslations('officeSession');
  const tAll = useTranslations();
  const tAvatar = useTranslations('avatar');
  const sound = useOfficeSound((s) => s.on);
  const me = session.participants.find((p) => p.id === session.me.id);
  const tried = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  // Scanning the QR code is enough: come in with your animal.
  useEffect(() => {
    // (Coming back to a session you were in is the participant screen's rejoin.)
    if (
      me ||
      session.me.joined ||
      tried.current ||
      session.status !== 'open' ||
      session.me.screen !== 'participant'
    )
      return;
    tried.current = true;
    setJoining(true);
    void api.join({ avatar }).then((code) => {
      setError(code);
      setJoining(false);
    });
  }, [api, avatar, me, session.me.joined, session.me.screen, session.status]);

  const back = `/office/avatar?back=${sessionPath(session.activityId, code)}`;
  const shown = me ?? { name, avatar };

  return (
    <div className="office-stage office-stage-tet lixi-member" data-testid="li-xi-member">
      <header className="lixi-member-head">
        <div className="min-w-0">
          <p className="office-stage-kicker">{t(`activity.${session.activityId}`)}</p>
          <h1 className="lixi-member-title">{session.title || t('untitled')}</h1>
        </div>
        <Link href={back} className="lixi-member-me" aria-label={t('changeAnimal')}>
          <Avatar avatar={shown.avatar} size={44} label={animalLabel(tAvatar, shown)} />
          <span className="lixi-member-name" data-testid="my-name">
            {shown.name}
          </span>
        </Link>
      </header>

      {me ? (
        <div className="lixi-member-mine">
          <LiXiPhone session={session} serverOffset={api.serverOffset} />
        </div>
      ) : (
        <div className="lixi-member-join">
          {error && (
            <p role="alert" className="text-sm">
              {tAll(errorKey(error))}
            </p>
          )}
          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={joining}
            onClick={async () => {
              setJoining(true);
              setError(await api.join({ avatar }));
              setJoining(false);
            }}
          >
            {t('joinWith')}
          </button>
        </div>
      )}

      <LiXiStage session={session} serverOffset={api.serverOffset} big={false} sound={sound} music={sound} />

      {me && (
        <div className="lixi-member-foot">
          <ReactionBar onReact={api.react} />
          <p className="lixi-member-count" role="status" data-testid="participant-status">
            ✓ {t('youAreIn')} · {t('count', { n: session.participants.length })}
          </p>
          <Link href={back} className="btn w-full">
            🐾 {t('changeAnimal')}
          </Link>
        </div>
      )}
      <ReactionLayer reactions={api.reactions} people={session.participants} />
      <div className="office-stage-corner">
        <SoundToggle />
      </div>
    </div>
  );
}
