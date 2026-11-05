import type { Metadata } from 'next';
import type { Locale } from '@/i18n/messages';

/**
 * Public address of the web app, for canonical links, the sitemap and social cards.
 * Set NEXT_PUBLIC_SITE_URL in production (e.g. https://boardhub.vn); dev falls back to localhost.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export const SITE_NAME = 'BoardHub';

export const OG_LOCALE: Record<Locale, string> = { vi: 'vi_VN', en: 'en_US' };

export const absolute = (path: string) => `${SITE_URL}${path === '/' ? '' : path}`;

/**
 * Metadata for a public page: title, description, canonical URL and the social card.
 * The image defaults to the site card (app/opengraph-image.tsx) unless the route has its own.
 */
export function publicPage(input: {
  title?: string;
  description: string;
  path: string;
  locale: Locale;
}): Metadata {
  const url = absolute(input.path);
  return {
    ...(input.title !== undefined && { title: input.title }),
    description: input.description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      url,
      locale: OG_LOCALE[input.locale],
      ...(input.title !== undefined && { title: input.title }),
      description: input.description,
    },
    twitter: {
      card: 'summary_large_image',
      ...(input.title !== undefined && { title: input.title }),
      description: input.description,
    },
  };
}

/** Pages that only make sense for one person or one room: kept out of search results. */
export const PRIVATE: Metadata['robots'] = { index: false, follow: false };
