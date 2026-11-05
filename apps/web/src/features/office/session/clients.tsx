'use client';

import dynamic from 'next/dynamic';
import { Connecting } from './shared';

export const ParticipantClient = dynamic(
  () => import('./ParticipantScreen').then((m) => m.ParticipantScreen),
  { ssr: false, loading: Connecting },
);
export const HostClient = dynamic(() => import('./HostScreen').then((m) => m.HostScreen), {
  ssr: false,
  loading: Connecting,
});
export const StageClient = dynamic(() => import('./StageScreen').then((m) => m.StageScreen), {
  ssr: false,
  loading: Connecting,
});
export const CreateClient = dynamic(() => import('./CreateSessionForm').then((m) => m.CreateSessionForm), {
  ssr: false,
  loading: Connecting,
});
