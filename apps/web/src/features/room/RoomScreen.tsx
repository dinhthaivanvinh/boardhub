'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { errorKey } from '@/game-runtime/error-key';
import { RulesButton } from '@/features/rules/RulesButton';
import { isGameId } from '@/games/catalog';
import { useRoom } from '@/online/use-room';
import { ChatPanel } from './ChatPanel';
import { Lobby } from './Lobby';
import { OnlineMatchView } from './OnlineMatchView';
import { timeControlLabel } from './shared';

export function RoomScreen({ code }: { code: string }) {
  const t = useTranslations();
  const router = useRouter();
  const api = useRoom(code);
  const { room } = api;

  if (api.joinError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p role="alert" className="text-lg">
          {api.joinError === 'room.not_found' ? t('room.notFound', { code }) : t(errorKey(api.joinError))}
        </p>
        <Link href="/" className="btn mt-6">
          {t('notFound.back')}
        </Link>
      </div>
    );
  }

  if (!room) {
    return <p className="px-4 py-20 text-center text-[var(--muted)]">{t('online.connecting')}</p>;
  }

  const showMatch = room.status !== 'lobby' && api.match && api.match.snapshot.matchId === room.matchId;

  return (
    <div data-game={room.gameId} className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 lg:py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
          {t(`games.${room.gameId}.name`)}{' '}
          <span className="font-mono text-base text-[var(--muted)]">#{room.code}</span>
        </h1>
        <div className="flex gap-2">
          {isGameId(room.gameId) && (
            <RulesButton
              gameId={room.gameId}
              config={room.config}
              extra={[
                { label: t('setup.timeControl'), value: timeControlLabel(t, room.timeControl) },
                {
                  label: t('setup.disconnectPolicy'),
                  value: t(`setup.disconnectPolicies.${room.disconnectPolicy}`),
                },
              ]}
            />
          )}
          <button
            type="button"
            className="btn"
            onClick={async () => {
              await api.leave();
              router.push('/');
            }}
          >
            {t('room.leave')}
          </button>
        </div>
      </div>

      {api.connection === 'offline' && (
        <p role="status" className="rounded-lg bg-[var(--danger)] px-3 py-2 text-sm text-white">
          {t('online.reconnecting')}
        </p>
      )}
      {api.actionError && (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {t(errorKey(api.actionError))}
        </p>
      )}

      {showMatch ? <OnlineMatchView api={api} /> : <Lobby api={api} />}

      <div className="max-w-xl">
        <ChatPanel messages={api.chat} myUserId={api.userId} onSend={api.sendChat} />
      </div>
    </div>
  );
}
