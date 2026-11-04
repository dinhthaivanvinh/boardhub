import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const config: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript source.
  transpilePackages: ['@bg/engine', '@bg/ui', '@bg/bots', '@bg/game-caro', '@bg/game-four-in-a-row'],
};

export default withNextIntl(config);
