import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { PieceGlyph, PIECE_LESSONS } from '@bg/game-chess';
import { toLocale } from '@/i18n/messages';
import { AdventureMap } from '@/features/learn/AdventureMap';
import { HomeProgress } from '@/features/learn/HomeProgress';
import { JsonLd } from '@/seo/JsonLd';
import { absolute, publicPage, SITE_NAME } from '@/seo/site';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('portal');
  return publicPage({ description: t('tagline'), path: '/', locale: toLocale(await getLocale()) });
}

const BENEFITS = [
  { key: 'know', mascot: 'reading' },
  { key: 'think', mascot: 'thinking' },
  { key: 'challenge', mascot: 'cheer' },
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

      <section className="adv-hero" aria-labelledby="adv-hero-title">
        <div className="adv-hero-text">
          <h1 id="adv-hero-title" className="adv-hero-title">
            {t('title')}
          </h1>
          <p className="adv-hero-sub">{t('tagline')}</p>
          <div className="adv-hero-cta">
            <Link href="/learn/chess/coordinates" className="adv-btn adv-btn-primary" data-testid="cta-learn">
              {t('ctaLearn')}
            </Link>
            <Link href="/games/chess" className="adv-btn adv-btn-light" data-testid="cta-play">
              {t('ctaPlay')}
            </Link>
          </div>
          <ul className="adv-hero-perks">
            {(['age', 'steps', 'rewards'] as const).map((k) => (
              <li key={k}>{t(`perks.${k}`)}</li>
            ))}
          </ul>
        </div>
        <Image
          src="/home/hero-cheer.webp"
          alt=""
          width={640}
          height={656}
          priority
          className="adv-hero-mascot"
        />
      </section>

      <div className="adv-home">
        <HomeProgress />

        <section aria-labelledby="home-benefits">
          <h2 id="home-benefits" className="adv-section-title">
            {t('benefits.title')}
          </h2>
          <ul className="adv-benefits">
            {BENEFITS.map((k, i) => (
              <li key={k.key} className="adv-benefit" data-i={i}>
                <Image
                  src={`/scene/mascot-${k.mascot}.webp`}
                  alt=""
                  width={120}
                  height={170}
                  loading="lazy"
                />
                <h3>{t(`benefits.${k.key}.title`)}</h3>
                <p>{t(`benefits.${k.key}.text`)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="home-pieces">
          <h2 id="home-pieces" className="adv-section-title">
            {t('pieces.title')}
          </h2>
          <ul className="adv-pieces" data-game="chess">
            {PIECE_LESSONS.map((l, i) => (
              <li key={l.id} className="adv-piece" data-i={i}>
                <span className="adv-piece-art">
                  <PieceGlyph piece={`w${l.piece}`} size={84} />
                </span>
                <h3>{tp(`pieceNames.${l.piece}`)}</h3>
                <p>{t(`pieces.tag.${l.id}`)}</p>
                <Link href={`/learn/chess/${l.id}`} className="adv-btn adv-btn-light adv-piece-btn">
                  {t('pieces.explore')}
                  <span className="sr-only"> {tp(`pieceNames.${l.piece}`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="home-path" className="adv-map-section">
          <h2 id="home-path" className="adv-section-title">
            {t('map.title')}
          </h2>
          <p className="adv-section-sub">{t('path.text')}</p>
          <AdventureMap />
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
