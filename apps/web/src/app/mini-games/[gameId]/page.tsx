import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { isMiniGameId } from '@bg/game-chess';
import { MiniGameScreen } from '@/features/learn/MiniGameScreen';
import { toLocale } from '@/i18n/messages';
import { publicPage } from '@/seo/site';

type Props = { params: Promise<{ gameId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { gameId } = await params;
  if (!isMiniGameId(gameId)) return {};
  const t = await getTranslations('games.chess.learn.mini');
  return publicPage({
    title: `${t(`${gameId}.name`)} · ${t('title')}`,
    description: t(`${gameId}.text`),
    path: `/mini-games/${gameId}`,
    locale: toLocale(await getLocale()),
  });
}

export default async function MiniGamePage({ params }: Props) {
  const { gameId } = await params;
  if (!isMiniGameId(gameId)) notFound();
  return <MiniGameScreen game={gameId} />;
}
