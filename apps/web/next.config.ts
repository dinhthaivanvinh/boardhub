import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const config: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript source.
  transpilePackages: [
    '@bg/engine',
    '@bg/ui',
    '@bg/bots',
    '@bg/game-caro',
    '@bg/game-four-in-a-row',
    '@bg/game-xiangqi',
    '@bg/game-reversi',
    '@bg/game-co-ganh',
    '@bg/game-o-an-quan',
    '@bg/game-ban-tau',
    '@bg/game-chess',
    '@bg/avatars',
    '@bg/office-core',
    '@bg/office-lucky-animal',
    '@bg/office-li-xi',
  ],
  // Let phones and other machines on the home network use `pnpm dev` through the LAN IP
  // (Next.js blocks dev assets for hosts other than localhost). Dev only; `*` is one label of the hostname.
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*'],
  // The pre-recorded lesson voice (public/audio): a sentence's file is named after its text, so it can be kept for
  // a day; the list of files is checked more often.
  // There is no list of lessons any more: the home page has the path.
  async redirects() {
    return [{ source: '/learn/chess', destination: '/', permanent: false }];
  },
  async headers() {
    return [
      {
        source: '/audio/:lang/:file*.mp3',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
      {
        source: '/audio/:lang/index.json',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=300, stale-while-revalidate=86400' }],
      },
    ];
  },
};

export default withNextIntl(config);
