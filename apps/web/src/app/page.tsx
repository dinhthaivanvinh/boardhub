import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { PieceGlyph, PIECE_LESSONS } from '@bg/game-chess';
import { JoinRoomForm } from '@/features/home/JoinRoomForm';
import { GAME_IDS } from '@/games/catalog';
import { COVERS } from '@/games/covers';
import { toLocale } from '@/i18n/messages';
import { JsonLd } from '@/seo/JsonLd';
import { absolute, publicPage, SITE_NAME } from '@/seo/site';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('portal');
  return publicPage({ description: t('tagline'), path: '/', locale: toLocale(await getLocale()) });
}

const STEPS = [
  { key: 'coordinates', href: '/learn/chess/coordinates' },
  { key: 'pieces', href: '/learn/chess/pawn' },
  { key: 'checkmate', href: '/learn/chess/checkmate' },
  { key: 'openings', href: '/learn/chess/italian' },
  { key: 'special', href: '/learn/chess/castling' },
  { key: 'play', href: '/games/chess' },
] as const;

const FACTS = ['goal', 'board', 'first'] as const;

/** The home page: an introduction to chess, with the way to learn it and to play it (ADR-0010). */
export default async function HomePage() {
  const t = await getTranslations('portal');
  const tp = await getTranslations('games.chess');
  const locale = toLocale(await getLocale());
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: SITE_NAME,
          url: absolute('/'),
          inLanguage: locale,
          description: t('tagline'),
        }}
      />

      <section className="hero">
        <div className="mx-auto grid max-w-6xl items-center gap-6 px-4 py-5 md:grid-cols-[1fr_auto] md:py-6">
          <div>
            {/* Not shown, but every page needs its h1 for screen readers and search engines. */}
            <h1 className="sr-only">{t('title')}</h1>
            <div className="flex flex-wrap gap-3">
              <Link href="/learn/chess" className="btn btn-primary btn-lg" data-testid="cta-learn">
                {t('ctaLearn')}
              </Link>
              <Link href="/games/chess" className="btn btn-lg" data-testid="cta-play">
                {t('ctaPlay')}
              </Link>
            </div>
          </div>
          <ul className="hidden grid-cols-3 gap-2 md:grid" aria-hidden="true" data-game="chess">
            {(['wK', 'wQ', 'wR', 'wB', 'wN', 'wP'] as const).map((piece) => (
              <li key={piece} className="home-piece">
                <PieceGlyph piece={piece} size={40} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-6 md:py-8">
        <section aria-labelledby="home-what">
          <h2 id="home-what" className="text-xl font-bold">
            {t('what.title')}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">{t('what.text')}</p>
          <ul className="mt-4 grid gap-3 md:grid-cols-3">
            {FACTS.map((k) => (
              <li key={k} className="card">
                <h3 className="font-semibold">{t(`what.${k}.title`)}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{t(`what.${k}.text`)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="home-pieces">
          <h2 id="home-pieces" className="text-xl font-bold">
            {t('pieces.title')}
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" data-game="chess">
            {PIECE_LESSONS.map((l) => (
              <li key={l.id}>
                <Link href={`/learn/chess/${l.id}`} className="card home-piece-card">
                  <PieceGlyph piece={`w${l.piece}`} size={56} />
                  <strong>{tp(`pieceNames.${l.piece}`)}</strong>
                  <span className="text-sm text-[var(--muted)]">{t(`pieces.tag.${l.id}`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="home-path">
          <h2 id="home-path" className="text-xl font-bold">
            {t('path.title')}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">{t('path.text')}</p>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.key}>
                <Link href={step.href} className="card home-step group h-full">
                  <span className="flex items-center gap-2">
                    <span className="home-step-number" aria-hidden="true">
                      {i + 1}
                    </span>
                    <h3 className="font-semibold">{t(`path.${step.key}.title`)}</h3>
                  </span>
                  <p className="mt-2 text-sm leading-snug text-[var(--muted)]">
                    {t(`path.${step.key}.text`)}
                  </p>
                  <span className="game-card-cta mt-2">
                    {t(`path.${step.key}.cta`)} <span aria-hidden="true">→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="home-more" className="grid gap-6 md:grid-cols-2">
          <Link href="/board-games" className="area-card group" data-testid="area-board-games">
            <div className="area-card-art area-card-collage" aria-hidden="true">
              {GAME_IDS.slice(0, 6).map((id) => (
                <Image key={id} src={COVERS[id]} alt="" unoptimized className="area-card-tile" />
              ))}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-6">
              <p className="chip self-start">{t('more.badge', { n: GAME_IDS.length })}</p>
              <h2 id="home-more" className="text-2xl font-bold">
                {t('more.title')}
              </h2>
              <p className="text-[var(--muted)]">{t('more.text')}</p>
              <span className="game-card-cta mt-2">
                {t('more.cta')} <span aria-hidden="true">→</span>
              </span>
            </div>
          </Link>
          <div className="flex flex-col justify-center gap-3">
            <h2 className="text-xl font-bold">{t('join.title')}</h2>
            <p className="text-[var(--muted)]">{t('join.text')}</p>
            <JoinRoomForm />
          </div>
        </section>
      </div>
    </>
  );
}
