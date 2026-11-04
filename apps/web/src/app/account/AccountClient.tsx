'use client';

import dynamic from 'next/dynamic';

// Client only: the session lives in localStorage.
const AccountScreen = dynamic(() => import('@/features/account/AccountScreen').then((m) => m.AccountScreen), {
  ssr: false,
});

export function AccountClient() {
  return <AccountScreen />;
}
