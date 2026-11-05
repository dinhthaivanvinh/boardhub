'use client';

import dynamic from 'next/dynamic';
import type { GameId } from '@/games/catalog';

// Client only: data comes from the game server, whose address is known in the browser.
const LeaderboardScreen = dynamic(
  () => import('@/features/competitive/LeaderboardScreen').then((m) => m.LeaderboardScreen),
  { ssr: false },
);

export function LeaderboardClient({ initialGame }: { initialGame: GameId }) {
  return <LeaderboardScreen initialGame={initialGame} />;
}
