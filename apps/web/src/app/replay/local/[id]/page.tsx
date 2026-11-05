import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { LocalReplayClient } from './LocalReplayClient';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('replay');
  return { title: t('pageTitle'), robots: { index: false } };
}

/** A game saved in this browser (against the computer or at one screen). */
export default async function LocalReplayPage({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f]{32}$/.test(id)) notFound();
  return <LocalReplayClient id={id} />;
}
