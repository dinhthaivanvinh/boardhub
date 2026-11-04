'use client';

import dynamic from 'next/dynamic';

// Client only: the session lives in localStorage.
const ProfileScreen = dynamic(() => import('@/features/profile/ProfileScreen').then((m) => m.ProfileScreen), {
  ssr: false,
});

export function ProfileClient() {
  return <ProfileScreen />;
}
