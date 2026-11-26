import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Nunito } from 'next/font/google';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { LANGUAGE_CHOICE, toLocale } from '@/i18n/messages';
import { OG_LOCALE, SITE_NAME, SITE_URL } from '@/seo/site';
import { AccountLink } from '@/features/account/AccountLink';
import { AuthPrompt } from '@/features/account/AuthPrompt';
import { ProgressSync } from '@/features/learn/ProgressSync';
import { VisitPing } from '@/features/stats/VisitPing';
import { AdminLink } from '@/features/admin/AdminLink';
import { BannedBanner } from '@/features/admin/BannedBanner';
import { LanguageSwitcher } from '@/features/settings/LanguageSwitcher';
import { MobileNav } from '@/features/settings/MobileNav';
import { NavMenus } from '@/features/settings/NavMenus';
import { HomeLink } from '@/features/home/HomeLink';
import { TIME_ZONE } from '@/i18n/messages';
import { NAV_LINKS } from '@/features/settings/nav-links';
import './globals.css';

const FOOTER_LINKS = [
  { href: '/', key: 'home' as const },
  ...NAV_LINKS.map((l) => ({ href: l.href, key: l.key })),
];

/** A round, friendly face for a young audience; the system fonts stay as the fallback. */
const rounded = Nunito({ subsets: ['latin', 'vietnamese'], display: 'swap', variable: '--font-rounded' });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('app');
  const locale = toLocale(await getLocale());
  return {
    metadataBase: new URL(SITE_URL),
    applicationName: SITE_NAME,
    title: { default: t('name'), template: `%s · ${t('name')}` },
    description: t('tagline'),
    openGraph: { type: 'website', siteName: SITE_NAME, locale: OG_LOCALE[locale] },
    twitter: { card: 'summary_large_image' },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f9ff' },
    { media: '(prefers-color-scheme: dark)', color: '#15140f' },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const t = await getTranslations('app');
  const tn = await getTranslations('nav');
  return (
    <html lang={locale} className={rounded.variable}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages} timeZone={TIME_ZONE}>
          <header className="site-header">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
              <HomeLink className="site-brand flex items-center gap-2 font-bold tracking-tight">
                <Logo size={40} />
                {t('name')}
              </HomeLink>
              <span className="site-slogan" aria-hidden="true">
                {t('slogan')}
              </span>
              <div className="flex items-center gap-2 sm:gap-4">
                <NavMenus />
                <AdminLink />
                <AccountLink />
                {LANGUAGE_CHOICE && <LanguageSwitcher />}
                <MobileNav />
              </div>
            </div>
          </header>
          <BannedBanner />
          <AuthPrompt />
          <ProgressSync />
          <VisitPing />
          <main className="min-h-[calc(100vh-8rem)]">{children}</main>
          <footer className="site-footer">
            <div className="site-footer-inner">
              <HomeLink className="site-footer-brand">
                <Logo size={28} />
                {t('name')}
              </HomeLink>
              <nav aria-label={t('footerLinks')} className="site-footer-links">
                {FOOTER_LINKS.map((l) => (
                  <Link key={l.href} href={l.href}>
                    {tn(l.key)}
                  </Link>
                ))}
              </nav>
              <span className="site-footer-copy">{t('copyright', { year: new Date().getFullYear() })}</span>
            </div>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

/** Four tiles in the colours of the pieces: the BoardHub mark. */
function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <rect x="2" y="2" width="13" height="13" rx="4" fill="#f97316" />
      <rect x="17" y="2" width="13" height="13" rx="4" fill="#1d4ed8" />
      <rect x="2" y="17" width="13" height="13" rx="4" fill="#15803d" />
      <rect x="17" y="17" width="13" height="13" rx="4" fill="#b91c1c" />
      <circle cx="23.5" cy="23.5" r="3.5" fill="#fff" opacity="0.9" />
    </svg>
  );
}
