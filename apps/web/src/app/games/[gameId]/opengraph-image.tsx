import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { GAMES, isGameId } from '@/games/catalog';
import { OG_SIZE, ogCard } from '@/seo/og-card';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'BoardHub';

export default async function Image({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  if (!isGameId(gameId)) notFound();
  const t = await getTranslations();
  const { minPlayers, maxPlayers, estimatedMinutes } = GAMES[gameId].definition.meta;
  const players = minPlayers === maxPlayers ? `${minPlayers}` : `${minPlayers}–${maxPlayers}`;
  return ogCard({
    kicker: `${t('catalog.players', { players })} · ${t('catalog.minutes', { n: estimatedMinutes })}`,
    title: t(`games.${gameId}.name`),
    line: t(`games.${gameId}.shortDescription`),
  });
}
