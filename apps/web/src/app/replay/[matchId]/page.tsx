import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ReplayClient } from './ReplayClient';

type Props = { params: Promise<{ matchId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('replay');
  return { title: t('pageTitle'), robots: { index: false } };
}

export default async function ReplayPage({ params }: Props) {
  const { matchId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(matchId)) notFound();
  return <ReplayClient matchId={matchId} />;
}
