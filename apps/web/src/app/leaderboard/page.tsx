import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { LeaderboardScreen, type LeaderboardData } from '@/features/competitive/LeaderboardScreen';
import { GAME_IDS, isGameId, type GameId } from '@/games/catalog';
import { toLocale } from '@/i18n/messages';
import { serverUrl } from '@/online/api';
import { publicPage } from '@/seo/site';

type Props = { searchParams: Promise<{ game?: string }> };

const gameOf = async (searchParams: Props['searchParams']): Promise<GameId> => {
  const game = (await searchParams).game ?? '';
  return isGameId(game) ? game : GAME_IDS[0]!;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const t = await getTranslations();
  const gameId = await gameOf(searchParams);
  const name = t(`games.${gameId}.name`);
  return publicPage({
    title: `${t('leaderboard.title')}: ${name}`,
    description: t('seo.leaderboardDescription', { game: name }),
    path: `/leaderboard?game=${gameId}`,
    locale: toLocale(await getLocale()),
  });
}

/** Fetched on the server (GAME_SERVER_INTERNAL_URL inside a private network); null if unreachable. */
async function load(gameId: GameId): Promise<LeaderboardData | null> {
  const base = process.env.GAME_SERVER_INTERNAL_URL ?? serverUrl();
  try {
    const res = await fetch(`${base}/api/leaderboard/${gameId}`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(1_500),
    });
    return res.ok ? ((await res.json()) as LeaderboardData) : null;
  } catch {
    return null;
  }
}

export default async function LeaderboardPage({ searchParams }: Props) {
  const gameId = await gameOf(searchParams);
  return <LeaderboardScreen key={gameId} gameId={gameId} initial={await load(gameId)} />;
}
