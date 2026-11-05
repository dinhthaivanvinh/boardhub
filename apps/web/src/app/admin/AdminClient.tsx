'use client';

import dynamic from 'next/dynamic';

// Client only: the session lives in localStorage.
const AdminScreen = dynamic(() => import('@/features/admin/AdminScreen').then((m) => m.AdminScreen), {
  ssr: false,
});

export function AdminClient() {
  return <AdminScreen />;
}
