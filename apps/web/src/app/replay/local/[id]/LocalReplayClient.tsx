'use client';

import dynamic from 'next/dynamic';

// Client only: the game is read from this browser's IndexedDB.
const LocalReplayScreen = dynamic(
  () => import('@/features/replay/ReplayScreen').then((m) => m.LocalReplayScreen),
  { ssr: false },
);

export function LocalReplayClient({ id }: { id: string }) {
  return <LocalReplayScreen id={id} />;
}
