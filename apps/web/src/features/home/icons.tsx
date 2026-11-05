export type FeatureId = 'bot' | 'online' | 'ranked' | 'replay';

const PATHS: Record<FeatureId, string> = {
  // robot
  bot: 'M12 2a1 1 0 0 1 1 1v1.1A7 7 0 0 1 19 11v5a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-5a7 7 0 0 1 6-6.9V3a1 1 0 0 1 1-1Zm-3 9.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM2 12h1.5v4H2a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Zm18.5 0H22a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-1.5v-4Z',
  // two people
  online:
    'M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM1 20c0-3.9 3.4-6.5 7.5-6.5S16 16.1 16 20v1H1v-1Zm16.5 1v-1c0-2.1-.8-4-2.2-5.3l1.2-.2c3.4 0 6.5 2.1 6.5 5.5v1h-5.5Z',
  // trophy
  ranked:
    'M6 2h12v2h3v3a5 5 0 0 1-4.6 5 6 6 0 0 1-3.4 3.4V18h3v3H8v-3h3v-2.6A6 6 0 0 1 7.6 12 5 5 0 0 1 3 7V4h3V2Zm0 4H5v1a3 3 0 0 0 1.3 2.5A6 6 0 0 1 6 8V6Zm12 0v2c0 .5 0 1-.2 1.5A3 3 0 0 0 19 7V6h-1Z',
  // replay arrow
  replay:
    'M12 4a8 8 0 1 1-7.7 10.2l1.9-.6A6 6 0 1 0 7.8 7.8L10 10H3V3l2.4 2.4A8 8 0 0 1 12 4Zm-1.5 4.5 5 3.5-5 3.5v-7Z',
};

export function FeatureIcon({ id }: { id: FeatureId }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <path d={PATHS[id]} />
    </svg>
  );
}
