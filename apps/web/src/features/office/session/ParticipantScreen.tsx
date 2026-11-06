'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Avatar, defaultAvatar, type AvatarData } from '@bg/avatars';
import { errorKey } from '@/game-runtime/error-key';
import { fetchMyAvatar } from '@/office/avatar-api';
import { useOfficeSession } from '@/office/use-office-session';
import { ensureToken, useSession } from '@/online/session';
import { downloadAnimalCard } from '../animal-card';
import { ParticipantDraw } from './ParticipantDraw';
import { ReactionBar } from './Reactions';
import { LiXiPhone } from '@/features/party/li-xi/LiXiPhone';
import { sessionPath } from '@/office/areas';
import { animalLabel, Connecting, OfficeError, useAreaRedirect } from './shared';

/** The phone: your animal, the "Join" button, then "waiting for the host" (docs/office/07 §6). */
export function ParticipantScreen({ code }: { code: string }) {
  const t = useTranslations('officeSession');
  const tAll = useTranslations();
  const tAvatar = useTranslations('avatar');
  const user = useSession((s) => s.user);
  const api = useOfficeSession(code, 'participant', false);
  useAreaRedirect(api.session?.activityId);
  const [avatar, setAvatar] = useState<AvatarData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const rejoined = useRef(false);
  const portrait = useRef<HTMLDivElement>(null);

  // Your saved animal (or your default one).
  useEffect(() => {
    let cancelled = false;
    void ensureToken()
      .then(async (token) => {
        const res = await fetchMyAvatar(token);
        const me = useSession.getState().user;
        if (!cancelled && me) setAvatar(res.ok && res.data ? res.data : defaultAvatar(me.id));
      })
      .catch(() => {}); // No account chosen yet: the join screen asks again.
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const { session } = api;
  const me = session?.participants.find((p) => p.id === session.me.id);

  // Coming back to a session you were already in: join again with your current animal.
  useEffect(() => {
    if (!session || !avatar || rejoined.current || session.me.screen !== 'participant') return;
    if (session.me.joined && session.status !== 'closed') {
      rejoined.current = true;
      void api.join({ avatar });
    }
  }, [api, avatar, session]);

  if (api.kicked) return <OfficeError code="office.locked" />;
  if (api.joinError && !session) return <OfficeError code={api.joinError} />;
  if (!session || !avatar || !user) return <Connecting />;
  if (session.status === 'closed') return <OfficeError code="office.closed" />;

  const joined = Boolean(me);
  const label = animalLabel(tAvatar, { name: me?.name ?? user.displayName, avatar: me?.avatar ?? avatar });

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-5 px-4 py-8 text-center">
      <div>
        <p className="chip chip-accent">{t(`activity.${session.activityId}`)}</p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">{session.title || t('untitled')}</h1>
      </div>
      <div ref={portrait} className={joined ? 'office-me office-me-in' : 'office-me'}>
        <Avatar avatar={me?.avatar ?? avatar} size={200} label={label} />
      </div>
      <p className="text-xl font-semibold" data-testid="my-name">
        {me?.name ?? user.displayName}
      </p>
      {error && (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {tAll(errorKey(error))}
        </p>
      )}
      {joined ? (
        <>
          {session.activityId === 'li-xi' && <LiXiPhone session={session} serverOffset={api.serverOffset} />}
          {session.activityId !== 'li-xi' && session.draw && (
            <ParticipantDraw
              key={session.draw.drawId}
              draw={session.draw}
              serverOffset={api.serverOffset}
              meId={session.me.id}
            />
          )}
          <ReactionBar onReact={api.react} />
          <p className="card w-full text-[var(--muted)]" role="status" data-testid="participant-status">
            ✓ {t('youAreIn')} · {t('count', { n: session.participants.length })}
            {session.activityId !== 'li-xi' && (
              <>
                <br />
                {session.history.length > 0 ? t('waitNext') : t('waitHost')}
              </>
            )}
          </p>
          <Link href={`/office/avatar?back=${sessionPath(session.activityId, code)}`} className="btn w-full">
            🐾 {t('changeAnimal')}
          </Link>
          <button
            type="button"
            className="btn w-full"
            onClick={() => {
              const svg = portrait.current?.querySelector('svg');
              const mine = me ?? { name: user.displayName, avatar };
              if (svg)
                void downloadAnimalCard(
                  svg,
                  {
                    name: mine.name,
                    line: tAvatar(`species.${mine.avatar.species}`),
                    brand: 'BoardHub',
                  },
                  `${mine.name.replace(/[^p{L}p{N}]+/gu, '-')}-animal.png`,
                );
            }}
          >
            📸 {t('downloadCard')}
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="btn btn-primary btn-lg w-full"
            disabled={joining}
            onClick={async () => {
              setJoining(true);
              setError(await api.join({ avatar }));
              setJoining(false);
            }}
          >
            {t('joinWith')}
          </button>
          <Link href={`/office/avatar?back=${sessionPath(session.activityId, code)}`} className="btn w-full">
            🐾 {t('changeAnimalFirst')}
          </Link>
          <p className="text-sm text-[var(--muted)]">{t('count', { n: session.participants.length })}</p>
        </>
      )}
    </div>
  );
}
