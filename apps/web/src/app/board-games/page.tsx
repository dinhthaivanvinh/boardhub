import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { GameMeta } from '@/features/home/GameMeta';
import { GameStatusChip } from '@/features/admin/GameStatusChip';
import { FeatureIcon, type FeatureId } from '@/features/home/icons';
import { JoinRoomForm } from '@/features/home/JoinRoomForm';
import { GAME_IDS, GAMES, UPCOMING_GAMES } from '@/games/catalog';
import { COVERS } from '@/games/covers';
import { toLocale } from '@/i18n/messages';
import { JsonLd } from '@/seo/JsonLd';
import { absolute, publicPage } from '@/seo/site';

const FEATURES: FeatureId[] = ['bot', 'online', 'ranked', 'replay'];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return publicPage({
    title: t('nav.boardGames'),
    description: `${t('app.tagline')} ${GAME_IDS.map((id) => t(`games.${id}.name`)).join(', ')}.`,
    path: '/board-games',
    locale: toLocale(await getLocale()),
  });
}

export default async function BoardGamesPage() {
  const t = await getTranslations();
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: t('catalog.title'),
          itemListElement: GAME_IDS.map((id, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: absolute(`/games/${id}`),
            name: t(`games.${id}.name`),
          })),
        }}
      />
      <section className="hero relative overflow-hidden border-b border-[var(--border)]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:py-16">
          <div>
            <p className="chip chip-accent">{t('home.badge', { n: GAME_IDS.length })}</p>
            <h1 className="mt-4 text-4xl leading-tight font-extrabold tracking-tight text-balance sm:text-5xl">
              {t('home.title')}
            </h1>
            <p className="mt-4 max-w-lg text-lg text-[var(--muted)]">{t('app.tagline')}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#games" className="btn btn-primary btn-lg">
                {t('home.browse')}
              </a>
              <Link href="/live" className="btn btn-lg">
                {t('home.watchLive')}
              </Link>
            </div>
            <div className="mt-8 max-w-xl">
              <JoinRoomForm />
            </div>
          </div>

          {/* Decorative collage; the game links are in the list below. */}
          <div className="hero-collage hidden md:block" aria-hidden="true">
            {GAME_IDS.slice(0, 4).map((id, i) => (
              <Image
                key={id}
                src={COVERS[id]}
                alt=""
                unoptimized
                priority
                className={`hero-tile hero-tile-${i}`}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10" aria-label={t('home.featuresLabel')}>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <li key={f} className="flex gap-3">
              <span className="feature-icon">
                <FeatureIcon id={f} />
              </span>
              <div>
                <h3 className="font-semibold">{t(`home.features.${f}.title`)}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{t(`home.features.${f}.text`)}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section id="games" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-16">
        <h2 className="text-2xl font-bold tracking-tight">{t('catalog.title')}</h2>
        <ul className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {GAME_IDS.map((id) => (
            <li key={id}>
              <Link href={`/games/${id}`} className="game-card group">
                <div className="game-card-cover">
                  <Image
                    src={COVERS[id]}
                    alt=""
                    unoptimized
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h3 className="flex items-center gap-2 text-xl font-semibold">
                    {t(`games.${id}.name`)}
                    <GameStatusChip gameId={id} />
                  </h3>
                  <p className="mt-2 flex-1 text-sm text-[var(--muted)]">
                    {t(`games.${id}.shortDescription`)}
                  </p>
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <GameMeta meta={GAMES[id].definition.meta} />
                    <span className="game-card-cta">
                      {t('catalog.play')}
                      <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
                        →
                      </span>
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
          {UPCOMING_GAMES.map((id) => (
            <li key={id} className="card flex flex-col justify-center opacity-60" aria-disabled="true">
              <h3 className="text-xl font-semibold">{t(`upcoming.${id}`)}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{t('catalog.comingSoon')}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
