'use client';

import dynamic from 'next/dynamic';

// Client only: the replay is computed in the browser from the move list.
const ReplayScreen = dynamic(() => import('@/features/replay/ReplayScreen').then((m) => m.ReplayScreen), {
  ssr: false,
});

export function ReplayClient({ matchId }: { matchId: string }) {
  return <ReplayScreen matchId={matchId} />;
}
