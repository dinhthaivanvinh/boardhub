import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/seo/site';

/** Public catalog and rules are crawlable; rooms, matches and personal pages are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/room/',
          '/play/',
          '/replay/',
          '/queue',
          '/profile',
          '/account',
          '/admin',
          '/office/new',
          '/office/avatar',
          '/office/s/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
