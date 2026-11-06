'use client';

import dynamic from 'next/dynamic';
import { Connecting } from '@/features/office/session/shared';

export const LiXiCreateClient = dynamic(() => import('./LiXiCreateForm').then((m) => m.LiXiCreateForm), {
  ssr: false,
  loading: Connecting,
});
