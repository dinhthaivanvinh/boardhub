'use client';

import { useTranslations } from 'next-intl';
import type { AdminGameSetting } from '@bg/protocol';
import { GAME_IDS } from '@/games/catalog';
import { adminGames, setGameEnabled } from '@/online/admin-api';
import { ErrorLine, Loading, PageHeader, useLoad } from './ui/common';

/** /admin/settings/games (M4b): turn board games on and off. */
export function GamesScreen() {
  const t = useTranslations('admin');
  return (
    <>
      <PageHeader title={t('crumbs.settings')} />
      <Games />
    </>
  );
}

function Games() {
  const t = useTranslations();
  const { data, setData, error, setError, reload } = useLoad(adminGames);
  if (!data) return error ? <ErrorLine code={error} onRetry={() => void reload()} /> : <Loading />;
  const byId = new Map(data.games.map((g) => [g.gameId, g]));
  // Same order as the catalog; games the server has but this web build does not are listed last.
  const ids = [
    ...GAME_IDS.filter((id) => byId.has(id)),
    ...data.games.map((g) => g.gameId).filter((id) => !GAME_IDS.includes(id as never)),
  ];

  const toggle = async (g: AdminGameSetting) => {
    const res = await setGameEnabled(g.gameId, !g.enabled);
    setError(res.ok ? null : res.code);
    if (res.ok) setData({ games: data.games.map((x) => (x.gameId === g.gameId ? res.data : x)) });
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[var(--muted)]">{t('admin.gamesHint')}</p>
      <ErrorLine code={error} />
      <ul className="flex flex-col gap-2">
        {ids.map((id) => {
          const g = byId.get(id)!;
          const name = t.has(`games.${id}.name`) ? t(`games.${id}.name`) : id;
          return (
            <li key={id} className="card flex items-center justify-between gap-3 py-3">
              <span className="font-medium">{name}</span>
              <label className="flex items-center gap-2 text-sm">
                <span className={g.enabled ? '' : 'text-[var(--danger)]'}>
                  {g.enabled ? t('admin.on') : t('admin.off')}
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  className="admin-switch"
                  checked={g.enabled}
                  onChange={() => void toggle(g)}
                  aria-label={t('admin.toggle', { game: name })}
                  data-testid={`admin-game-${id}`}
                />
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
