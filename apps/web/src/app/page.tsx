import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { GAME_IDS, GAMES, UPCOMING_GAMES } from '@/games/catalog';

export default async function HomePage() {
  const t = await getTranslations();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">{t('catalog.title')}</h1>
      <p className="mt-2 text-[var(--muted)]">{t('app.tagline')}</p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GAME_IDS.map((id) => {
          const { minPlayers, maxPlayers, estimatedMinutes } = GAMES[id].definition.meta;
          const players = minPlayers === maxPlayers ? `${minPlayers}` : `${minPlayers}–${maxPlayers}`;
          return (
            <li key={id}>
              <Link
                href={`/games/${id}`}
                className="card block h-full transition-shadow hover:shadow-lg focus-visible:shadow-lg"
              >
                <h2 className="text-xl font-semibold">{t(`games.${id}.name`)}</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">{t(`games.${id}.shortDescription`)}</p>
                <p className="mt-4 text-sm">
                  {t('catalog.players', { players })} · {t('catalog.minutes', { n: estimatedMinutes })}
                </p>
                <span className="btn btn-primary mt-4">{t('catalog.play')}</span>
              </Link>
            </li>
          );
        })}
        {UPCOMING_GAMES.map((id) => (
          <li key={id} className="card opacity-60" aria-disabled="true">
            <h2 className="text-xl font-semibold">{t(`upcoming.${id}`)}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">{t('catalog.comingSoon')}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
