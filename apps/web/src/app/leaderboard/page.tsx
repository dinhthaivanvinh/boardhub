import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { GAME_IDS, isGameId } from '@/games/catalog';
import { LeaderboardClient } from './LeaderboardClient';

type Props = { searchParams: Promise<{ game?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('leaderboard');
  return { title: t('title') };
}

export default async function LeaderboardPage({ searchParams }: Props) {
  const game = (await searchParams).game ?? '';
  return <LeaderboardClient initialGame={isGameId(game) ? game : GAME_IDS[0]!} />;
}
