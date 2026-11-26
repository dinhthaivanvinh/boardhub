import type { Metadata, Viewport } from 'next';
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
import { Logo } from '@/features/home/Logo';
import { SiteFooter } from '@/features/home/SiteFooter';
import { TIME_ZONE } from '@/i18n/messages';
import './globals.css';

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
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
