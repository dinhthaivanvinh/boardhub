import { useTranslations } from 'next-intl';

/** "2 người chơi · ~10 phút" as two chips. */
export function GameMeta({
  meta,
}: {
  meta: { minPlayers: number; maxPlayers: number; estimatedMinutes: number };
}) {
  const t = useTranslations('catalog');
  const { minPlayers, maxPlayers, estimatedMinutes } = meta;
  const players = minPlayers === maxPlayers ? `${minPlayers}` : `${minPlayers}–${maxPlayers}`;
  return (
    <span className="flex flex-wrap gap-2 text-xs">
      <span className="chip">
        <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true" fill="currentColor">
          <path d="M7 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6.5 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1 16c0-3 2.7-5 6-5s6 2 6 5v1H1v-1Zm13.5 1v-1c0-1.6-.6-3-1.7-4 .3 0 .5-.1.7-.1 2.7 0 4.5 1.7 4.5 4.1v1h-3.5Z" />
        </svg>
        {t('players', { players })}
      </span>
      <span className="chip">
        <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true" fill="currentColor">
          <path d="M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm-.8 2h1.6v3.7l2.6 2.1-1 1.2-3.2-2.6V6Z" />
        </svg>
        {t('minutes', { n: estimatedMinutes })}
      </span>
    </span>
  );
}
