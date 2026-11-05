'use client';

import dynamic from 'next/dynamic';

// Client only: data comes from the game server, whose address is known in the browser.
const LiveScreen = dynamic(() => import('@/features/competitive/LiveScreen').then((m) => m.LiveScreen), {
  ssr: false,
});

export function LiveClient() {
  return <LiveScreen />;
}
