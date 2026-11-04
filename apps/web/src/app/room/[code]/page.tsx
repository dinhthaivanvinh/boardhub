import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { RoomClient } from './RoomClient';

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const t = await getTranslations('room');
  return { title: `${t('code')} ${code.toUpperCase()}`, robots: { index: false } };
}

export default async function RoomPage({ params }: Props) {
  const code = (await params).code.toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) notFound();
  return <RoomClient code={code} />;
}
