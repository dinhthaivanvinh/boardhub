import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { AccountLink } from '@/features/account/AccountLink';
import { AdminLink } from '@/features/admin/AdminLink';
import { BannedBanner } from '@/features/admin/BannedBanner';
import { LanguageSwitcher } from '@/features/settings/LanguageSwitcher';
import { MobileNav } from '@/features/settings/MobileNav';
import { NavMenus } from '@/features/settings/NavMenus';
import { TIME_ZONE } from '@/i18n/messages';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('app');
  return { title: { default: t('name'), template: `%s · ${t('name')}` }, description: t('tagline') };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f5f0' },
    { media: '(prefers-color-scheme: dark)', color: '#15140f' },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const t = await getTranslations('app');
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages} timeZone={TIME_ZONE}>
          <header className="site-header">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
              <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
                <Logo />
                {t('name')}
              </Link>
              <div className="flex items-center gap-2 sm:gap-4">
                <NavMenus />
                <AdminLink />
                <AccountLink />
                <LanguageSwitcher />
                <MobileNav />
              </div>
            </div>
          </header>
          <BannedBanner />
          <main className="min-h-[calc(100vh-8rem)]">{children}</main>
          <footer className="border-t border-[var(--border)]">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-[var(--muted)]">
              <span className="flex items-center gap-2">
                <Logo size={18} />
                {t('name')}
              </span>
              <span>{t('footer')}</span>
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
