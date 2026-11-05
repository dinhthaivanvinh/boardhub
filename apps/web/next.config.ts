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
  ],
  // Let phones and other machines on the home network use `pnpm dev` through the LAN IP
  // (Next.js blocks dev assets for hosts other than localhost). Dev only; `*` is one label of the hostname.
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*'],
};

export default withNextIntl(config);
