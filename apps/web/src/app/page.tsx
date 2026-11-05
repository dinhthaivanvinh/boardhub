import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { JoinRoomForm } from '@/features/home/JoinRoomForm';
import { OfficeArt } from '@/features/home/OfficeArt';
import { GAME_IDS } from '@/games/catalog';
import { COVERS } from '@/games/covers';
import { toLocale } from '@/i18n/messages';
import { JsonLd } from '@/seo/JsonLd';
import { absolute, publicPage, SITE_NAME } from '@/seo/site';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('portal');
  return publicPage({ description: t('tagline'), path: '/', locale: toLocale(await getLocale()) });
}

/** The portal: two areas side by side (ADR-0007). */
export default async function PortalPage() {
  const t = await getTranslations('portal');
  const locale = toLocale(await getLocale());
  return (
    <div className="hero">
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
      <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
        <h1 className="text-4xl leading-tight font-extrabold tracking-tight text-balance sm:text-5xl">
          {t('title')}
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-[var(--muted)]">{t('tagline')}</p>

        <ul className="mt-10 grid gap-6 md:grid-cols-2">
          <li>
            <Link href="/board-games" className="area-card group" data-testid="area-board-games">
              <div className="area-card-art area-card-collage" aria-hidden="true">
                {GAME_IDS.slice(0, 6).map((id) => (
                  <Image key={id} src={COVERS[id]} alt="" unoptimized className="area-card-tile" />
                ))}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-6">
                <p className="chip self-start">{t('boardGames.badge', { n: GAME_IDS.length })}</p>
                <h2 className="text-2xl font-bold">{t('boardGames.title')}</h2>
                <p className="text-[var(--muted)]">{t('boardGames.text')}</p>
                <span className="game-card-cta mt-2">
                  {t('boardGames.cta')} <span aria-hidden="true">→</span>
                </span>
              </div>
            </Link>
          </li>
          <li>
            <Link href="/office" className="area-card group" data-testid="area-office">
              <div className="area-card-art" aria-hidden="true">
                <OfficeArt className="h-full w-full" />
              </div>
              <div className="flex flex-1 flex-col gap-2 p-6">
                <p className="chip chip-accent self-start">{t('office.badge')}</p>
                <h2 className="text-2xl font-bold">{t('office.title')}</h2>
                <p className="text-[var(--muted)]">{t('office.text')}</p>
                <span className="game-card-cta mt-2">
                  {t('office.cta')} <span aria-hidden="true">→</span>
                </span>
              </div>
            </Link>
          </li>
        </ul>

        <div className="mt-10 max-w-xl">
          <JoinRoomForm />
        </div>
      </div>
    </div>
  );
}
