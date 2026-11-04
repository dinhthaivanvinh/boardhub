import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { isGameId } from '@/games/catalog';
import { parseMatchSetup } from '@/game-runtime/match-setup';
import { PlayClient } from './PlayClient';

type Props = {
  params: Promise<{ gameId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { gameId } = await params;
  if (!isGameId(gameId)) return {};
  const t = await getTranslations();
  return { title: t(`games.${gameId}.name`), robots: { index: false } };
}

export default async function PlayPage({ params, searchParams }: Props) {
  const { gameId } = await params;
  if (!isGameId(gameId)) notFound();
  const setup = parseMatchSetup(gameId, await searchParams);
  return <PlayClient gameId={gameId} setup={setup} />;
}
