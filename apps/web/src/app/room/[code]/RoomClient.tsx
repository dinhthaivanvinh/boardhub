'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';

function Loading() {
  const t = useTranslations('online');
  return <p className="px-4 py-20 text-center text-[var(--muted)]">{t('connecting')}</p>;
}

// Client only: uses localStorage (session, settings) and a live socket.
const RoomScreen = dynamic(() => import('@/features/room/RoomScreen').then((m) => m.RoomScreen), {
  ssr: false,
  loading: Loading,
});

export function RoomClient({ code }: { code: string }) {
  return <RoomScreen code={code} />;
}
