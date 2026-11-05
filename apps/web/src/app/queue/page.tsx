import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { QueueTimeControlSchema } from '@bg/protocol';
import { isGameId } from '@/games/catalog';
import { QueueClient } from './QueueClient';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('queue');
  return { title: t('pageTitle'), robots: { index: false } };
}

export default async function QueuePage({ searchParams }: Props) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const gameId = one(sp.game) ?? '';
  if (!isGameId(gameId)) notFound();
  const preset = QueueTimeControlSchema.catch('blitz').parse(one(sp.tc));
  return <QueueClient gameId={gameId} preset={preset} ranked={one(sp.ranked) !== '0'} />;
}
