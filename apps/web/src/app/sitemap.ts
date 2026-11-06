import type { MetadataRoute } from 'next';
import { GAME_IDS } from '@/games/catalog';
import { absolute } from '@/seo/site';

/** Every public page: the portal, the areas, each game's rules page and the rankings. */
export default function sitemap(): MetadataRoute.Sitemap {
  const page = (path: string, priority: number, changeFrequency: 'daily' | 'weekly' | 'monthly') => ({
    url: absolute(path),
    changeFrequency,
    priority,
  });
  return [
    page('/', 1, 'weekly'),
    page('/board-games', 0.9, 'weekly'),
    ...GAME_IDS.map((id) => page(`/games/${id}`, 0.8, 'monthly')),
    page('/office', 0.8, 'monthly'),
    page('/party', 0.8, 'monthly'),
    ...GAME_IDS.map((id) => page(`/leaderboard?game=${id}`, 0.5, 'daily')),
    page('/live', 0.4, 'daily'),
  ];
}
