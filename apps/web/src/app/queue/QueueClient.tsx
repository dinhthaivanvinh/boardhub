'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type { QueueScreen as Screen } from '@/features/queue/QueueScreen';

// Client only: uses the live socket.
const QueueScreen = dynamic(() => import('@/features/queue/QueueScreen').then((m) => m.QueueScreen), {
  ssr: false,
});

export function QueueClient(props: ComponentProps<typeof Screen>) {
  return <QueueScreen {...props} />;
}
