import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { PieceGlyph, PIECE_LESSONS } from '@bg/game-chess';
import { toLocale } from '@/i18n/messages';
import { JsonLd } from '@/seo/JsonLd';
import { absolute, publicPage, SITE_NAME } from '@/seo/site';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('portal');
  return publicPage({ description: t('tagline'), path: '/', locale: toLocale(await getLocale()) });
}

const STEPS = [
  { key: 'coordinates', href: '/learn/chess/coordinates', icon: 'board' },
  { key: 'pieces', href: '/learn/chess/pawn', icon: '♟️' },
  { key: 'capture', href: '/learn/chess/capture', icon: '🍎' },
  { key: 'checkmate', href: '/learn/chess/checkmate', icon: '👑' },
  { key: 'openings', href: '/learn/chess/italian', icon: '🚀' },
  { key: 'special', href: '/learn/chess/castling', icon: '✨' },
  { key: 'tactics', href: '/learn/chess/tactics', icon: '🧠' },
  { key: 'play', href: '/games/chess', icon: '🎮' },
] as const;

/** A small chessboard, since there is no emoji for one. */
function BoardIcon() {
  return (
    <svg viewBox="0 0 32 32" width="1.6rem" height="1.6rem" className="home-board-icon">
      <rect width="32" height="32" rx="5" fill="#b58863" />
      {[0, 1, 2, 3].flatMap((r) =>
        [0, 1, 2, 3].map((c) =>
          (r + c) % 2 === 0 ? (
            <rect key={`${r}${c}`} x={c * 8} y={r * 8} width="8" height="8" fill="#f0d9b5" />
          ) : null,
        ),
      )}
    </svg>
  );
}

const FACTS = [
  { key: 'goal', icon: '🎯' },
  { key: 'board', icon: 'board' },
  { key: 'first', icon: '🤝' },
] as const;

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

      <section className="hero home-hero">
        <span className="home-blob home-blob-a" aria-hidden="true" />
        <span className="home-blob home-blob-b" aria-hidden="true" />
        <div className="mx-auto grid max-w-6xl items-center gap-6 px-4 py-6 md:grid-cols-[1.1fr_1fr] md:py-8">
          <div className="relative">
            <h1 className="home-title">{t('title')}</h1>
            <p className="home-tagline">{t('tagline')}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/learn/chess/coordinates"
                className="btn btn-primary btn-lg home-cta"
                data-testid="cta-learn"
              >
                <span aria-hidden="true">🎓</span> {t('ctaLearn')}
              </Link>
              <Link href="/games/chess" className="btn btn-lg home-cta" data-testid="cta-play">
                <span aria-hidden="true">🎮</span> {t('ctaPlay')}
              </Link>
            </div>
          </div>
          <ul className="home-parade" aria-hidden="true" data-game="chess">
            {(['wK', 'wQ', 'wR', 'wB', 'wN', 'wP'] as const).map((piece, i) => (
              <li key={piece} className="home-piece" data-i={i}>
                <PieceGlyph piece={piece} size={52} />
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
            {FACTS.map((k, i) => (
              <li key={k.key} className="card home-fact" data-i={i}>
                <span className="home-fact-icon" aria-hidden="true">
                  {k.icon === 'board' ? <BoardIcon /> : k.icon}
                </span>
                <h3 className="font-semibold">{t(`what.${k.key}.title`)}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{t(`what.${k.key}.text`)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="home-pieces">
          <h2 id="home-pieces" className="text-xl font-bold">
            {t('pieces.title')}
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" data-game="chess">
            {PIECE_LESSONS.map((l, i) => (
              <li key={l.id}>
                <Link href={`/learn/chess/${l.id}`} className="card home-piece-card" data-i={i}>
                  <span className="home-piece-bubble">
                    <PieceGlyph piece={`w${l.piece}`} size={56} />
                  </span>
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
          <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <li key={step.key}>
                <div className="card home-step h-full" data-i={i}>
                  <span className="flex items-center gap-2">
                    <span className="home-step-number" aria-hidden="true">
                      {i + 1}
                    </span>
                    <h3 className="font-semibold">{t(`path.${step.key}.title`)}</h3>
                    <span className="home-step-icon" aria-hidden="true">
                      {step.icon === 'board' ? <BoardIcon /> : step.icon}
                    </span>
                  </span>
                  <p className="mt-2 mb-3 text-sm leading-snug text-[var(--muted)]">
                    {t(`path.${step.key}.text`)}
                  </p>
                  <Link href={step.href} className="btn home-step-btn mt-auto">
                    {t(`path.${step.key}.cta`)}
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="home-final" aria-labelledby="home-final">
          <span className="home-final-emoji" aria-hidden="true">
            🌟
          </span>
          <h2 id="home-final" className="text-2xl font-extrabold">
            {t('final.title')}
          </h2>
          <p>{t('final.text')}</p>
          <Link href="/learn/chess/coordinates" className="btn btn-lg home-final-btn">
            <span aria-hidden="true">🎓</span> {t('ctaLearn')}
          </Link>
        </section>
      </div>
    </>
  );
}
